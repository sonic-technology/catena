import { z } from 'zod'

import request from 'supertest'
import express, { Request } from 'express'
import { Handler } from '../../src/index.js'
import { HTTPError } from '../../src/utils/error.js'

const app = express()

const mergedMiddlewareHandler = new Handler()
    .validate('params', { userId: z.string() })
    .validate('query', {
        failInMiddlewareOne: z.string().optional(),
        failInMiddlewareTwo: z.string().optional(),
    })
    .middleware(async (req) => {
        if (req.query.failInMiddlewareOne === 'yes') {
            throw new HTTPError(400, 'This should fail')
        }

        return {
            name: 'John Doe',
            age: 12,
        }
    })
    .middleware((req) => {
        // no return value
    })
    .middleware(async (req, res, next, context) => {
        if (req.query.failInMiddlewareTwo === 'yes') {
            throw new HTTPError(401, 'This should fail in middleware two')
        }

        if (context.name !== 'John Doe') {
            throw new Error('Middleware two should have the previous context applied')
        }

        return {
            age: 20,
        }
    })
    .resolve(async (req, res, context) => {
        return { name: context.name, age: context.age }
    })
    .transform((data) => {
        return {
            data: {
                name: data.name,
                age: data.age,
            },
            meta: {},
        }
    })
    .express()

app.get('/user/:userId', mergedMiddlewareHandler)

// ALWAYS APPEND ERROR HANDLER AFTER ROUTES
app.use((err: any, req: any, res: any, next: any) => {
    if (err instanceof HTTPError) {
        return res.status(err.status).send(err.message)
    }

    res.status(500).send('Something broke!')
})

// TESTS

describe('Chained Middlewares', () => {
    it('should return 200 on success', (done) => {
        request(app)
            .get('/user/1')
            .expect(200)
            .then((res) => {
                expect(res.body).toEqual({
                    data: {
                        name: 'John Doe',
                        age: 20,
                    },
                    meta: {},
                })
                done()
            })
            .catch(done)
    })

    it('should return 400 on fail in first middleware', (done) => {
        request(app).get('/user/1?failInMiddlewareOne=yes').expect(400).end(done)
    })

    it('should return 400 on fail in second middleware and not execute second middleware', (done) => {
        request(app)
            .get('/user/1?failInMiddlewareOne=yes&failInMiddlewareTwo=yes')
            .expect(400)
            .end(done)
    })

    it('should return 401 on fail in second middleware', (done) => {
        request(app).get('/user/1?failInMiddlewareTwo=yes').expect(401).end(done)
    })
})
