# Catena

Catena is a lightweight and extensible library for building robust Node.js APIs, fast.
Catena's main purpose is to build request handler functions for frameworks like Express in a modern and type-safe way.

### Features

◆ Built-in validations for `body`, `params`, `query`, `headers` using [zod](https://github.com/colinhacks/zod)<br/><br/>
◆ Request type-safety<br/> - `body`, `params`, `query`, `headers` are stricly typed through the validations and passed to the `resolver`<br/> - Middlewares also have access to the validated data. Moreover, returned data from middlewares can be used within `resolver` and `transformer`. Also type-safe of course. <br/><br/>
◆ Built-in transformers<br/> - First, resolve the request using the `resolver`. Then use the `tranformer` to construct a DTO to pass to the client in a secure manner<br/><br/>
◆ Server-to-Client type sharing<br/> - You can infer the type of the data returned by `transformer`, export it and import it as type in the frontend. No manual interface creation & updating required<br/><br/>

### Code example

`backend`

```ts userController.ts
const MyHeaderValidations = z.object({
    auth: z.string(),
})

const MyOtherMiddleware = (req, res, next) => {
    return ...
}

const getUserHandler = new Handler()
    .validate('params', { userUuid: z.string(), organizationId: z.string() })
    .validate('headers', MyHeaderValidations)
    .middleware(MyOtherMiddleware)
    .middleware(async (req, context) => {
        // context includes the return values of all previous middlewares
        if(context.myOtherMiddlewareValue !== true) {
            throw new HttpError(400, "Bad Request")
        }

        // req.headers is type-safe
        if (req.headers.auth !== '<valid>') {
            throw new HttpError(401, 'Unauthorized')
        }

        const organization = await OrganizationService.getOrganization(req.params.organizationId)

        return organization
    })
    .resolve(async (req, context) => {
        const myUser = await UserService.getUser({
            // context.organization is type-safe. Context includes the return values of all middlewares (they must return objects)
            orgId: context.organization.id,
            // req.params is type-safe
            userId: req.params.userId,
        })

        return myUser
    })
    .transform((data, res) => {
        return {
            data: {
                // data is type-safe and includes the return value of .resolve
                uuid: data.uuid,
                name: data.name,
                email: data.email,
                organization: {
                    uuid: data.organization.uuid,
                    name: data.organization.name,
                },
            },
            meta: {}
        }
    })
    .express()

app.get('/user/:userUuid', getUserHandler)
// GetUserResponse is the return object value of transform
export type GetUserResponse = typeof getUserHandler.transformedData
```

`frontend`

```ts myQuery.ts
import type { GetUserResponse } from 'api/dist/controllers/authController.ts'

//...
const CALLS = {
    [AuthCallKeys.GET_ME]: {
        getKey: (orgUuid: string, userUuid: string) => [AuthCallKeys.GET_ME, orgUuid, userUuid],
        call: (sonicApi: SonicApi, orgUuid: string, userUuid: string) =>
            sonicApi
                // !!! No extra interface needed, just use the type that can be imported from the API
                .get<GetUserResponse[]>(`/orgs/${orgUuid}/users/${deviceUuid}`)
                .then(({ data }) => data),
    },
}
```

## Important Caveats

-   Headers must be validated lower-case only, because express passes them only in lower case, no matter what you've originally sent
-   You need to pass a JSON parser middleware like `express.json()` to your app
