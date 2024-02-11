<p align="center">
  <br/><br/>
  <picture>
    <source height="100" media="(prefers-color-scheme: dark)" srcset="./docs/assets/logo-dark.svg">
    <img height="100" alt="Foundry" src="./docs/assets/logo-light.svg">
  </picture>
</p>

<h4 align="center">A library for building type-safe Node.js APIs</h4>

<p align="center">
  <a href="#quickstart">Quickstart</a> • 
  <a href="#examples">Examples</a> 
</p>

<hr/>

# Build type-safe APIs

Catena is an lightweight library for building end-to-end type-safe APIs on top of Express. It's inspired by tRPC but unlike tRPC, you can just plug it into your existing Express codebase.
The main goal is to have a unified chain of useful steps to safely handle requests with a great DX and minimal overhead.

# Installation

```
npm i @sonic-tech/catena zod
```

# Chaining

Catena features a handler that is assembled as a chain out of the following elements. Only the `resolve` element is required, all other elements are optional.

-   **`validate`**: Chain [zod](https://github.com/colinhacks/zod)-powered validators for `body`, `params`, `query` and `headers` that only allow requests that match the zod schema
-   **`middleware`**: Middlewares can return values into a shared "context", which is type-safe and accessible to all following chain elements. To block further request processing, e.g. because the requesting entity is not authorized, throw `HttpError`
-   **`resolve`**: The resolver should be used to handle all business logic, like a normal express handler would do. It either returns data that is passed to the transformer or may use the `res` object to send a response without a transformer
-   **`transform`**: The transformer can be used to generate a DTO that can be send as response body by just returning it

# Demo

A quick demo of how Catena works. Find more examples [here](/examples/)

## A simple handler

The first example is as simple as it gets. Looks like a normal express handler and also does the same.

```ts
// ...
import { Handler } from '@sonic-tech/catena'

const app = express()

app.get(
    '/',
    new Handler().resolve((req, res) => {
        res.status(200).send('Hello World')
    })
)
```

## Validating requests

There are so many occuasions where you want to validate parts of the incoming data. Here's how Catena does it.

```ts
// ...
import { Handler } from '@sonic-tech/catena'

const app = express()

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
)
```

## Transformers

If you want to have a secure and unified way of returning data to the client, use transformers.
Transformers let you create and send JSON DTOs based on the data that the resolver returned.

```ts
// ...
import { Handler } from '@sonic-tech/catena'

const app = express()

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

)
```

## Middlewares

Catena extends middlewares by establishing a shared context that can be based from one middleware to another and finally to the resolver. You can write inline middlewares or just pass in a function.

```ts
// ...
import { Handler, HttpError } from '@sonic-tech/catena'
import { AnotherMiddleware } from "..."

const app = express()

app.get(
    '/user/:uuid',
    new Handler().
    .validate("params", {
        uuid: z.string().uuid()
    })
    .validate("headers", {
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

)
```
