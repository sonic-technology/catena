import { z } from 'zod'

import request from 'supertest'
import express from 'express'
import { Handler } from '../../src/index.js'
import { HTTPError, HTTPStatus } from '../../src/utils/error.js'

const app = express()

const resolverErrorHandler = new Handler()
    .validate('params', { userId: z.string() })
    .resolve(async (req, res, context) => {
        throw new HTTPError(HTTPStatus.BAD_REQUEST, 'This should fail in resolver')
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

const transformerErrorHandler = new Handler()
    .validate('params', { userId: z.string() })
    .resolve(async (req, res, context) => {
        return 'ok'
    })
    .transform((data) => {
        throw new HTTPError(HTTPStatus.BAD_REQUEST, 'This should fail in transformer')
        return {
            data: {
                name: 'Hello World',
            },
            meta: {},
        }
    })
    .express()

app.get('/resolver/:userId', resolverErrorHandler)
app.get('/transformer/:userId', transformerErrorHandler)

// ALWAYS APPEND ERROR HANDLER AFTER ROUTES
app.use((err: any, req: any, res: any, next: any) => {
    res.status(500).send('Something broke!')
})

// TESTS

describe('Error Handling', () => {
    it('should return error as expected for Resolver', (done) => {
        request(app)
            .get('/resolver/1')
            .expect(400)
            .then((res) => {
                expect(res.body).toEqual({
                    errors: [
                        {
                            message: 'This should fail in resolver',
                        },
                    ],
                    type: 'Bad Request',
                })

                done()
            })
            .catch(done)
    })

    it('should return error as expected for Transformer', (done) => {
        request(app)
            .get('/transformer/1')
            .expect(400)
            .then((res) => {
                expect(res.body).toEqual({
                    errors: [
                        {
                            message: 'This should fail in transformer',
                        },
                    ],
                    type: 'Bad Request',
                })

                done()
            })
            .catch(done)
    })
})
