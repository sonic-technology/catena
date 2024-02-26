<p align="center">
  <br/><br/>
  <picture>
    <source height="100" media="(prefers-color-scheme: dark)" srcset="./docs/assets/logo-dark.svg">
    <img height="100" alt="Catena" src="./docs/assets/logo-light.svg">
  </picture>
</p>

<h4 align="center">A library for building type-safe Node.js APIs</h4>

<p align="center">
  <a href="#installation">Installation</a> • 
  <a href="#examples">Examples</a> •
  <a href="#setting-up-catena--express">Documentation</a> 
</p>

<hr/>

# Build type-safe APIs

Catena is an lightweight library for building end-to-end type-safe APIs on top of Express. It's inspired by tRPC but unlike tRPC, you can just plug it into your existing Express codebase.
The main goal is to have a unified chain of useful steps to safely handle requests with a great DX and minimal overhead.

<figure>
<img src="./docs/assets/demo.gif" alt="Demo" />
<figcaption>
    <p align="center">
    A demo of type sharing between route handler (backend) and frontend, inspired by tRPC. 
    </p>
</figcaption>
</figure>

# Installation

1. Install Catena and its peer depencencies

```
npm i @sonic-tech/catena zod express
```

2. Also make sure that you have Express' types installed

```
npm i -D @types/express
```

# Documentation

-   [Examples](#examples)
-   [Setting up Catena with Express](#setting-up-catena--express)
-   [Core Concepts](#core-concepts)
    -   [Chaining](#chaining)
        -   [Validators](#validators)
        -   [Middlewares](#middlewares-1)
        -   [Resolver](#resolver)
        -   [Transformer](#transformer)
    -   [Type-sharing across codebases](#type-sharing-across-codebases)
    -   [File-based Routing](#file-based-routing)

# Examples

## A simple handler

The first example is as simple as it gets. Looks like a normal express handler and also does the same.

```ts
// ...
import { Handler } from '@sonic-tech/catena'

const app = express()
app.use(express.json())

app.get(
    '/',
    new Handler()
        .resolve((req, res) => {
            res.status(200).send('Hello World')
        })
        // Make sure that `.express()` always is the last method in the handler chain. It converts the logical chain into an express handler.
        .express()
)
```

## Validating requests

There are many occasions where you want to validate parts of the incoming data. Here's how Catena does it.

```ts
// ...
import { Handler } from '@sonic-tech/catena'

const app = express()
app.use(express.json());


app.post(
    '/user/:uuid',
    new Handler().
        .validate("params", {
            uuid: z.string().uuid()
        })
        .validate("body", {
            username: z.string().optional(),
            age: z.number().min(13).optional(),
            email: z.string().email(),
        })
        .resolve(async (req, res) => {
            // All 4 properties are strongly typed based on the zod schemas
            const { uuid } = req.params
            const { username, age, email } = req.body

            // ...

            res.status(200).send("User created!")
        })
        .express()
)
```

## Transformers

If you want to have a secure and unified way of returning data to the client, use transformers.
Transformers let you create and send JSON DTOs based on the data that the resolver returned.

This is the recommended way of returning data to the client.

```ts
// ...
import { Handler } from '@sonic-tech/catena'

const app = express()
app.use(express.json());


app.get(
    '/user/:uuid',
    new Handler().
        .validate("params", {
            uuid: z.string().uuid()
        })
        .resolve(async (req, res) => {
            const userIncludingPassword = await UserService.getUser(req.uuid)

            return userIncludingPassword
        })
        .transform((data) => {
            return {
                data: {
                    uuid: data.uuid,
                    email: data.email
                }
            }
        })
        .express()
)
```

## Middlewares

Catena extends middlewares by establishing a shared context that can be passed from one middleware to another and finally to the resolver. You can write inline middlewares or just pass in a function.

```ts
// ...
import { Handler, HTTPError } from '@sonic-tech/catena'
import { AnotherMiddleware } from "..."

const app = express()
app.use(express.json());


app.get(
    '/user/:uuid',
    new Handler().
        .validate("params", {
            uuid: z.string().uuid()
        })
        .validate("headers", {
            // key in header validations must always be lower-case!
            authorization: z.string()
        })
        .middleware((req) => {j
            const requestingUser = await SecurityService.getAuthorizedUser(req.headers.authorization);
            if (!requestingUser) {
                // Throw errors when you want to stop further request processing while returning an error at the same time
                throw new HTTPError(400, 'This should fail')
            }

            return {
                requestingUser
            }
        })
        .middleware(AnotherMiddleware)
        .resolve(async (req, res, context) => {
            // You can access the merged type-safe context of all middlewares in the resolver
            const { requestingUser } = context


            const userIncludingPassword = await UserService.getUser(req.uuid)

            return userIncludingPassword
        })
        .transform((data) => {
            return {
                data: {
                    uuid: data.uuid,
                    email: data.email
                }
            }
        })
        .express()
)
```

## Setting up Catena + Express

Catena currently supports Express; work is underway to support Next.js.

To setup Catena with Express make sure to do the following:

-   Install `express` and `@types/express` using yarn/npm/pnpm/bun
-   Suffix all Catena handlers with `.express()` (!). This function will transform the Catena chain into an Express request handler. Without appending this method, you're going to get a type-error and the handler will not work.

Also, you have to use the `express.json()` (or body-parser) middleware in order for the validators to work with JSON content.

```ts
const app = express()
app.use(express.json())
```

## Core Concepts

## Chaining

Catena features a handler that is assembled as a chain out of the following elements. Only the `resolve` element is required, all other elements are optional.

-   **`validate`**: Chain [zod](https://github.com/colinhacks/zod)-powered validators for `body`, `params`, `query` and `headers` that only allow requests that match the zod schema
-   **`middleware`**: Middlewares can return values into a shared "context", which is type-safe and accessible to all following chain elements. To block further request processing, e.g. because the requesting entity is not authorized, throw `HTTPError`
-   **`resolve`**: The resolver should be used to handle all business logic, like a normal express handler would do. It either returns data that is passed to the transformer or may use the `res` object to send a response without a transformer
-   **`transform`**: The transformer can be used to generate a DTO that can be send as response body by just returning it

The elements in this chain are processed one after the other. So if a middleware is executed after a validator, you can be sure that the validation has been passed. If there are multiple chained middlewares, you always access the context of all previous middlewares in the following middlewares.

All Catena chain elements are bundled into one actual Express handler with the `.express()` method at the end of the chain. Internally, we are not calling Express' `next()` until all chain elements have completed or there has been an uncaught error. If there is an uncaught error, that is not `HTTPError`, we are calling `next(err)`. You may then handle errors on router level or append another middleware.

## Validators

Validators are virtual middlewares that validate the given request data using zod. You can create validators for `body`, `params`, `query` and `headers`. Objects validated by validators are type guarded for all following middlewares and the resolver.

### Method Signature

`.validate(type: "body" | "params" | "query" | "headers", zodObject: object | z.object)`

The second parameter can either be a `z.object()` or just a normal object that contains keys with zod validations as values. So both of the following usages are valid:

```ts
new Handler().validate('body', {
    email: z.string().email(),
})
// .resolve ...
```

```ts
new Handler().validate(
    'body',
    z.object({
        email: z.string().email(),
    })
    // .resolve ...
)
```

Using just an object is more readable, while using `z.object` has the advantage of being able to infer the validator type and use it e.g. in services as argument type. Example:

```ts
const bodyValidation = z.object({
    email: z.string().email(),
})

new Handler().validate('body', bodyValidation) //.resolve ...

const myServiceMethod = (body: z.infer<typeof bodyValidation>) => {
    // ...
}
```

### Caveats

-   For `headers` validations, **always** use lower-case only keys! ~~`Authorization: z.string()`~~ --> `authorization: z.string()`. The reason for this is that Express converts all headers to lower case to comply with the RFC for HTTP requests, which states that header keys are case-insensitive.

## Middlewares

Middlewares are functions that you can connect prior to the resolver in order to add custom logic such as authorization, non-trivial validation, etc. before the resolver is executed.

### Middleware method signature

```ts
.middleware(req: RequestWithValidations, res: Response, next: NextFunction, context: MiddlewareContext)
```

-   `req` extends the default express object with the type-safe inference made by the validators on `body`, `params`, `query` and `headers`.
-   `res` is the default Express `Response` object
-   `next` is the default Express `NextFunction`
-   `context` is a simple object that is empty at the beginning of the first middleware in the chain. It can be filled with any values by the middlewares and passed to other middlewares and the resolver, see below

### Catena Middlewares

Catena exposes a more straightforward way to write middlewares, while also supporting all existing middlewares.

#### Context

Instead of overwriting or extending some parts of the `req` object to pass along context, you can just return an object. This object will be merged with the existing `context` object and will be accessible to all following middlewares and the resolver (type-safe, of course).

```ts
import { Handler, HTTPError } from '@sonic-tech/catena'

new Handler()
    .validate('params', {
        uuid: z.string().uuid(),
    })
    .middleware(async (req) => {
        const user = await UserService.getUser(req.params.uuid) // -> { email: "...", uuid: "..." }

        return {
            user,
        }
    })
    .middleware(async (req, res, next, context) => {
        // email and uuid can be extracted from the context type-safely
        const { email, uuid } = context.user

        if (!email.endsWith('@mycompany.com')) {
            throw new HTTPError(403, 'Company not allowed')
        }

        const organization = await OrganizationService().getByUser(uuid)

        return {
            organization,
        }
    })
    .resolve(async (req, res, context) => {
        /**
         * The resolver has access to both user and organization
         * since the context objects have been merged
         */
        const { user, organization } = context

        // ...
    })
```

A middleware does not need to return anything. If it returns void, the context objects stays as is.

Sending something to the client using `res.send` causes the chain to stop, i.e. the next chain element is not executed.

#### Errors

Instead of using `res.send` to send error messages, you can import `HTTPError` from Catena and use `throw new HTTPError(statusCode, errorMessage)` which will automatically resolve the request using the given status code and a standardized error message. An example can be seen in the code snippet of the last section.

### Existing Middlewares

You can also use any middleware that works with express out of the box using the default `(req, res, next)` syntax.

```ts
import { MySecondMiddleware } from "../middlewares"
const MyExistingMiddleware = (req, res, next) => {
    if(!req.body.continue) {
        res.status(400).send("Bad Request")
        return
    }

    next()
}

new Handler()
    .middleware(MyExistingMiddleware)
    .middleware(MySecondMiddleware)
    .resolve(...)
    .transform(...)
```

## Resolver

The resolver may be used as the core handler of the request, just as you used the handler function before.

### Method Signature

```ts
.resolve((req: RequestWithValidations, res: Response, context: MiddlewareContext) => any | Promise<any>)
```

-   The `req` is the default Express request object, except that `req.body`, `req.params`, `req.query` and `req.headers` are typed by the infered zod validations from the validators
-   The `res` object is the default Express response object
-   The `context` object is the merged Context you passed along the middlewares

### Context

As with middlewares, you can access the merged context of all previous middlewares (= all middlewares) through the `context` object.

### Return Values

You can use `res` to send responses directly to the client without a transformer.

However, it is recommended to return values instead. Those values are then passed to the [Transformer](#transformer) instead of being sent to the client directly.

```ts
new Handler()
    .middleware(() => {
        return {
            user: {
                uuid: '...',
            },
        }
    })
    .resolve((req, res, context) => {
        const { user } = context

        const subscription = await UserService.getUserSubscription(user.uuid)

        // Just pass the data to the transformer instead of using res.send.
        return subscription
    })
    .transform((data) => {
        // data has the type of "subscription"
        return {
            userSubscriptionUuid: data.uuid,
        }
    })
```

## Transformer

Transformers can be used to create sanitized data transfer objects based on the resolved data. This enables your resolver to just handle the business logic, independent of what single values should or should not be returned to the client.

For example, the resolver might get a user object from the database for a given query. Of course you don't want to return the user's password to the client. To keep things clean, just pass the user object from the resolver (which shouldn't have to care about sanitizing values) to the transformer, which then takes the given object and only returns values that are appropriate to be returned.

Example

```ts
new Handler()
    .validate('params', {
        uuid: z.string().uuid(),
    })
    .resolve(async (req) => {
        const { uuid } = req.params

        // This object contains confidential information, like a password
        const user = await UserService.getUser(uuid)

        return user
    })
    .transform((data) => {
        return {
            uuid: data.uuid,
            email: data.email,
            // leave out the password, since we don't want to send it to the client
        }
    })
```

You may return any value. If you choose to return an object or array, they are send with `res.json()`. All other return values are send with `res.send()`.

If you want to use a different status code, set headers, cookie, etc. you can use e.g. `res.status(201)` before the return statement. We'll use this `res` object for sending the response internally

## Type-sharing across codebases

Request and response types of API handlers can be inferred and exported. You can use this to share your types e.g. with the frontend, like tRPC does.

Each handler exposes a `types` interface that contains `request` and `response` types.

The request type contains the expected types for `body`, `query`, `params` and `headers`.

The `response` type represents the type of the value that is returned by the transformer.

### Example

**Backend**

```ts backend/handler.ts
const myRequestHandler = new Handler()
    .validate("body", {
        email: z.string().email()
    })
    .resolve(...)
    .transform((data) => {
        return {
            data: {
                uuid: data.uuid,
                email: data.email,
                age: data.age
            }
        }
    })

app.get("/user", myRequestHandler);


export type GetUserTypes = typeof myRequestHandler.types;

```

**Frontend**

```ts frontend/requests.ts
// It's important to only import using `import type`. This way, no business logic will be leaked to the frontend but just the type
import type { GetUserTypes } from 'backend/handler'

/**
 * Body type inferred as
 * {
 *   email: string
 * }
 */

const body: GetUserTypes['request']['body'] = {
    email: 'test@test.com',
}

const myRequestResponse = await fetch('/user', {
    body: JSON.stringify(body),
})

/**
 * Type inferred as
 * {
 *  data: {
 *    uuid: string;
 *    email: string;
 *    age: number;
 *  }
 */
const responseData: GetUserTypes['response'] = await myRequestResponse.json()
```

## File-based Routing

We found [express-file-routing](https://github.com/matthiaaas/express-file-routing) to be a great addition to projects that use Catena, if you like file-based routing.

An example of Catena + file-based routing:

```ts
// /users/[uuid].ts

export const POST = new Handler()
    .validate('params', {
        uuid: z.string().uuid(),
    })
    .validate('body', {
        email: z.string().email().optional(),
        firstName: z.string().optional(),
        lastName: z.string().optional(),
    })
    .resolve((req) => {
        const updatedUser = new UserService.updateUser(req.params.uuid)

        return updatedUser
    })
    .transform((user) => {
        return {
            uuid: user.uuid,
            email: user.email,
            name: user.firstName + ' ' + user.lastName,
        }
    })
```
