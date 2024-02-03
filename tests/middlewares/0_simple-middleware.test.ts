import { z } from 'zod'

import request from 'supertest'
import express from 'express'
import { Handler } from '../../src/index.js'
import { HTTPError } from '../../src/utils/error.js'

const app = express()

const simpleMiddlewareHandler = new Handler()
    .validate('params', { userId: z.string() })
    .validate('query', { fail: z.string() })
    .middleware(async (req) => {
        if (req.query.fail === 'yes') {
            throw new HTTPError(400, 'This should fail')
        }

        if (req.query.fail === 'unknown') {
            throw new Error('This should fail')
        }

        return {
            name: 'John Doe',
        }
    })
    .resolve(async (req, res, context) => {
        return { name: context.name }
    })
    .transform((data) => {
        return {
            data: {
                name: data.name,
            },
            meta: {},
        }
    })
    .express()

app.get('/user/:userId', simpleMiddlewareHandler)

// ALWAYS APPEND ERROR HANDLER AFTER ROUTES
app.use((err: any, req: any, res: any, next: any) => {
    if (err instanceof HTTPError) {
        return res.status(err.status).send(err.message)
    }

    res.status(500).send('Something broke!')
})

// TESTS

describe('Middleware Tests', () => {
    describe('Single Middleware', () => {
        it('should return 200 on success', (done) => {
            request(app)
                .get('/user/1?fail=no')
                .expect(200)
                .then((res) => {
                    expect(res.body).toEqual({
                        data: {
                            name: 'John Doe',
                        },
                        meta: {},
                    })

                    done()
                })
                .catch(done)
        })

        it('should return 400 on fail', (done) => {
            request(app).get('/user/1?fail=yes').expect(400).end(done)
        })

        it('should return 500 on non-HttpError fail', (done) => {
            request(app).get('/user/1?fail=unknown').expect(500).end(done)
        })
    })
})
