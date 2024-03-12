import { z } from 'zod'

import request from 'supertest'
import express from 'express'
import { Handler } from '../../src/index.js'
import { HTTPError } from '../../src/utils/error.js'

const app = express()

const resolverErrorHandler = new Handler()
    .validate('params', { userId: z.string() })
    .resolve(async (req, res, context) => {
        throw new HTTPError(400, 'This should fail')
    })
    .transform((data) => {
        return {
            data: {
                name: 'Hello World',
            },
            meta: {},
        }
    })
    .express()

app.get('/user/:userId', resolverErrorHandler)

// ALWAYS APPEND ERROR HANDLER AFTER ROUTES
app.use((err: any, req: any, res: any, next: any) => {
    res.status(500).send('Something broke!')
})

// TESTS

describe('Error Tests', () => {
    describe('Resolver Error', () => {
        it('should return 400 ', (done) => {
            request(app)
                .get('/user/1')
                .expect(400)
                .then((res) => {
                    expect(res.body).toEqual({
                        errors: [
                            {
                                message: 'This should fail',
                            },
                        ],
                        type: 'Bad Request',
                    })

                    done()
                })
                .catch(done)
        })
    })
})
