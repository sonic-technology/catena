import express from 'express'
import type { Request as ExpressDefaultRequest, Response, NextFunction } from 'express'
import {
    baseObjectInputType,
    baseObjectOutputType,
    objectUtil,
    z,
    ZodError,
    ZodObject,
    ZodRawShape,
    ZodTypeAny,
} from 'zod'
import { HTTPError, HTTPStatus, HTTPStatusText } from './utils/error.js'
export { HTTPError, HTTPStatus, HTTPStatusText } from './utils/error.js'

export type CustomRequest<
    RequestType,
    ReqBody = any,
    ReqQuery = any,
    ReqHeaders = any,
    ReqParams = any
> = Omit<RequestType, 'body' | 'query' | 'headers' | 'params'> & {
    body: ReqBody
    query: ReqQuery
    headers: ReqHeaders
    params: ReqParams
}

type Middleware<
    ReqType = ExpressDefaultRequest,
    ReqBody = any,
    ReqQuery = any,
    ReqHeaders = any,
    ReqParams = any,
    PrevContext = {},
    NewContext = {}
> = (
    req: CustomRequest<ReqType, ReqBody, ReqQuery, ReqHeaders, ReqParams>,
    res: Response,
    next: NextFunction,
    prevContext: PrevContext
) => NonNullable<NewContext> | Promise<NonNullable<NewContext>> | void | Promise<void>

class ValidationError extends Error {
    public statusCode: number
    public errors: { message: string; path: string[] }[]
    public location: string

    constructor(zodError: ZodError, location: string) {
        super('Validation failed')

        // HTTP status code for validation errors
        this.statusCode = 400

        // Extract relevant error details from ZodError
        this.errors = JSON.parse(zodError.message).map((el: any) => ({
            message: el.message,
            path: el.path,
        }))

        this.location = location
    }
}

export type HandlerReturnType<TransformedData> = express.RequestHandler & {
    transformedData: TransformedData
}

export class Handler<
    /**
     * Set this to the type of the data that will be returned by the transformer function.
     */
    GlobalOutputData extends {
        data: Record<string, unknown> | string | null
        meta: Record<string, unknown> | null
    },
    RequestType = ExpressDefaultRequest,
    ReqBody = any,
    ReqQuery = any,
    ReqHeaders = any,
    ReqParams = any,
    ResolvedData = any,
    Context = {}
> {
    private _resolver?: (
        req: CustomRequest<RequestType, ReqBody, ReqQuery, ReqHeaders, ReqParams>,
        res: Response,
        context: Context
    ) => any
    private _transformer?: (
        data: ResolvedData,
        res: Response
    ) => GlobalOutputData | Promise<GlobalOutputData>

    private _chain: (<T>(
        req: CustomRequest<RequestType, ReqBody, ReqQuery, ReqHeaders, ReqParams>,
        res: Response,
        next: NextFunction,
        context: Partial<Context>
    ) => Partial<Context> | Promise<Partial<Context>>)[] = []

    /**
     * Function to add a single middleware to the chain
     * @param mw The middleware to add
     */
    middleware<NewContext>(
        mw: Middleware<RequestType, ReqBody, ReqQuery, ReqHeaders, ReqParams, Context, NewContext>
    ): Handler<
        GlobalOutputData,
        RequestType,
        ReqBody,
        ReqQuery,
        ReqHeaders,
        ReqParams,
        ResolvedData,
        // existing context merged with new context. If new context has a key that already exists in existing context, the new context key will be used as type
        Omit<Context, keyof NewContext> & NewContext
    > {
        this._chain.push(async (req, res, next, context) => {
            const contextData = (await mw(req, res, next, context as Context)) as Partial<Context>

            if (contextData === undefined || contextData === null) {
                // return old context if new context is undefined or null
                return context
            }
            return contextData
        })
        return this as any
    }

    /**
     *
     * @param type the location of the data to validate. Can be "body", "query", "headers", or "params"
     * @param schema the schema to validate against. Can be a zod object or a raw object containing zod types
     */
    validate<
        T extends 'body' | 'query' | 'headers' | 'params',
        K extends ZodRawShape,
        // copied from zod/lib/types.d.ts objectType. Adjusted to K instead of T
        U extends ZodObject<
            K,
            'strip',
            ZodTypeAny,
            {
                [k_1 in keyof objectUtil.addQuestionMarks<
                    baseObjectOutputType<K>,
                    {
                        [k in keyof baseObjectOutputType<K>]: undefined extends baseObjectOutputType<K>[k]
                            ? never
                            : k
                    }[keyof K]
                >]: objectUtil.addQuestionMarks<
                    baseObjectOutputType<K>,
                    {
                        [k in keyof baseObjectOutputType<K>]: undefined extends baseObjectOutputType<K>[k]
                            ? never
                            : k
                    }[keyof K]
                >[k_1]
            },
            {
                [k_2 in keyof baseObjectInputType<K>]: baseObjectInputType<K>[k_2]
            }
        >
    >(
        type: T,
        schema: K | U
    ): Handler<
        GlobalOutputData,
        RequestType,
        T extends 'body' ? z.infer<U> : ReqBody,
        T extends 'query' ? z.infer<U> : ReqQuery,
        T extends 'headers' ? z.infer<U> : ReqHeaders,
        T extends 'params' ? z.infer<U> : ReqParams
    > {
        // validation logic here
        const validationMiddleware = (
            req: CustomRequest<RequestType, ReqBody, ReqQuery, ReqHeaders, ReqParams>,
            res: Response,
            next: NextFunction
        ) => {
            try {
                // if the request body is not an object, don't validate it
                if (typeof req[type] !== 'object') {
                    throw new HTTPError(400, 'Invalid request body (not an object)')
                }

                const value = req[type]

                function isZodObject(object: K | U): object is U {
                    return '_def' in object
                }

                // if it's already an zod object, just use it. Else, make it a zod object first
                if (isZodObject(schema)) {
                    schema.parse(value)
                    next()
                } else {
                    // Have to ignore the following because of an unresolved type issue. Still works as expected
                    // @ts-ignore
                    const combinedSchema: U = z.object<K>(schema)

                    combinedSchema.parse(value)
                    next()
                }
            } catch (err) {
                if (err instanceof ZodError) {
                    throw new ValidationError(err, type)
                }

                throw err
            }

            return {}
        }

        this._chain.push(validationMiddleware)
        return this as any
    }

    /**
     * Define the resolver function for the handler. The resolver returns data that needs to be picked up by the transformer function
     * @param fn The function to run after all validations and middlewares have been processed
     */
    resolve<Data>(
        fn: (
            req: CustomRequest<RequestType, ReqBody, ReqQuery, ReqHeaders, ReqParams>,
            res: Response,
            context: Context
        ) => Data | Promise<Data>
    ): Handler<
        GlobalOutputData,
        RequestType,
        ReqBody,
        ReqQuery,
        ReqHeaders,
        ReqParams,
        Data,
        Context
    > {
        this._resolver = fn
        return this as any
    }
    /**
     * Define the transformer function for the handler. The transformer function receives the data returned by the resolver and is responsible for sending the response. Useful for creating DTOs
     * @param fn The function to run after the resolver has been run. This function is responsible for sending the response
     * @returns
     */
    transform<T extends GlobalOutputData>(
        fn: (data: ResolvedData, res: Response) => T | Promise<T>
    ): Handler<T, RequestType, ReqBody, ReqQuery, ReqHeaders, ReqParams, ResolvedData> {
        this._transformer = fn

        // @ts-ignore
        return this
    }

    getOutputTypes(): GlobalOutputData {
        return {} as GlobalOutputData
    }

    express(): HandlerReturnType<GlobalOutputData> {
        const runner = async (
            req: CustomRequest<RequestType, ReqBody, ReqQuery, ReqHeaders, ReqParams>,
            res: Response,
            next: NextFunction
        ) => {
            let index = 0

            let context: Context = {} as Context

            const runNextChainItem = async () => {
                // If there are no more middlewares to run, run the resolver
                if (index >= this._chain.length) {
                    // All middlewares and validations have been processed
                    try {
                        const result = await this._resolver!(req, res, context)
                        if (this._transformer) {
                            const transformerValue = await this._transformer(result, res)
                            if (transformerValue !== undefined) {
                                if (
                                    typeof transformerValue === 'object' &&
                                    transformerValue !== null
                                ) {
                                    res.json(transformerValue)
                                } else {
                                    res.send(transformerValue)
                                }
                            }
                            return
                        } else {
                            return
                        }
                    } catch (err) {
                        next(err)
                        return
                    }
                }

                // Otherwise, run the next middleware
                const currentMiddleware = this._chain[index++]
                try {
                    const returnedContextValue = await currentMiddleware?.(
                        req,
                        res,
                        (err) => {
                            if (err instanceof Error) {
                                throw err
                            }
                        },
                        context
                    )

                    // only append object values to context
                    if (
                        returnedContextValue !== undefined &&
                        returnedContextValue !== null &&
                        typeof returnedContextValue === 'object' &&
                        !Array.isArray(returnedContextValue)
                    ) {
                        context = { ...context, ...returnedContextValue }
                    }

                    // If a middleware has already sent a response, don't run the next middleware
                    if (res.headersSent) return

                    await runNextChainItem()
                } catch (err) {
                    if (err instanceof ValidationError) {
                        return res.status(err.statusCode).json({
                            errors: err.errors,
                            location: err.location,
                            type: HTTPStatusText[err.statusCode as HTTPStatus],
                        })
                    } else if (err instanceof HTTPError) {
                        return res.status(err.status).json({
                            errors: [err.message],
                            type: HTTPStatusText[err.status as HTTPStatus],
                        })
                    } else {
                        // call the native next express error handler
                        next(err)
                        return
                    }
                }
            }

            await runNextChainItem()
        }

        return runner as unknown as HandlerReturnType<GlobalOutputData>
    }
}
