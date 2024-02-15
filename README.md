<p align="center">
  <br/><br/>
  <picture>
    <source height="100" media="(prefers-color-scheme: dark)" srcset="./docs/assets/logo-dark.svg">
    <img height="100" alt="Foundry" src="./docs/assets/logo-light.svg">
  </picture>
</p>

<h4 align="center">A library for building type-safe Node.js APIs</h4>

<p align="center">
  <a href="#installation">Installation</a> • 
  <a href="#examples">Examples</a> •
  <a href="#documentation">Documentation</a> 
</p>

<hr/>

# Build type-safe APIs

Catena is an lightweight library for building end-to-end type-safe APIs on top of Express. It's inspired by tRPC but unlike tRPC, you can just plug it into your existing Express codebase.
The main goal is to have a unified chain of useful steps to safely handle requests with a great DX and minimal overhead.

# Installation

```
npm i @sonic-tech/catena zod express
```

# Examples

Short examples of how to use Catena. Find more in-depth examples [here](/examples/)

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

There are so many occuasions where you want to validate parts of the incoming data. Here's how Catena does it.

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
import { Handler, HttpError } from '@sonic-tech/catena'
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

# Documentation

Find an in-depth documentation about:

-   [Setting up Catena with Express](#setting-up-catena--express)
-   [Core Concepts](#core-concepts)
    -   [Chaining](#chaining)
        -   [Validators](#validators)
        -   [Middlewares](#middlewares-1)
        -   [Resolver](#resolver)
        -   [Transformer](#transformer)
    -   [Type-sharing across codebases](#type-sharing-across-codebases)

## Setting up Catena + Express

Catena currently supports Express; work is underway to support Next.js.

To setup Catena with Express make sure to do the following:

-   Install `express` and `@types/express` using yarn/npm/pnpm/bun
-   Suffix all Catena handlers with `.express()` (!). This function will transform the Catena chain into an Express request handler. Without appending this method, you're going to get a type-error and the handler will not work.

## Core Concepts

### Chaining

Catena features a handler that is assembled as a chain out of the following elements. Only the `resolve` element is required, all other elements are optional.

-   **`validate`**: Chain [zod](https://github.com/colinhacks/zod)-powered validators for `body`, `params`, `query` and `headers` that only allow requests that match the zod schema
-   **`middleware`**: Middlewares can return values into a shared "context", which is type-safe and accessible to all following chain elements. To block further request processing, e.g. because the requesting entity is not authorized, throw `HttpError`
-   **`resolve`**: The resolver should be used to handle all business logic, like a normal express handler would do. It either returns data that is passed to the transformer or may use the `res` object to send a response without a transformer
-   **`transform`**: The transformer can be used to generate a DTO that can be send as response body by just returning it

The elements in this chain are processed one after the other. So if a middleware is executed after a validator, you can be sure that the validation has been passed. If there are multiple chained middlewares, you always access the context of all previous middlewares in the following middlewares.

#### Validators

Validators are virtual middlewares that validate the given request data using zod. You can create validators for `body`, `params`, `query` and `headers`. Objects validated by validators are type guarded for all following middlewares and the resolver.

##### Method Signature

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

Using just a object is more readable, while using `z.object` has the advantage of being able to infer the validator type and use it e.g. in services as argument type. Example:

```ts
const bodyValidation = z.object({
    email: z.string().email(),
})

new Handler().validate('body', bodyValidation) //.resolve ...

const myServiceMethod = (body: z.infer<typeof bodyValidation>) => {
    // ...
}
```

#### Middlewares

#### Resolver

#### Transformer

### Type-sharing across codebases

Response types can be inferred and be shared with other parts of the codebase, e.g. the frontend.

The handler chain exposes a custom type called `tranformedData`. It's the inferred type of the return value of the [transformer](#transformer) and thus the type of the data that is used as response data.

You can use this best while being in a Monorepo to be able to share the types most easily.

### Usage Example

**Backend**

```ts backend/handler.ts
const myRequestHandler = new Handler()
    .validate(...)
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

/**
 * {
 *  data: {
 *    uuid: string;
 *    email: string;
 *    age: number;
 *  }
 * }
*/
export type UserResponseData = typeof myRequestHandler.tranformedData;

```

**Frontend**

```ts frontend/requests.ts
// It's important to only import using `import type`. This way, no business logic will be leaked to the frontend but just the type
import type { UserResponseData } from 'backend/handler'

/**
 * Type accessible as
 * {
 *  data: {
 *    uuid: string;
 *    email: string;
 *    age: number;
 *  }
 * }
 */

const myRequest: UserResponseData = await fetch('/user').then((res) => res.json())
```
