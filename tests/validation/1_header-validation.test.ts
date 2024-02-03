import { z } from 'zod'

import request from 'supertest'
import express from 'express'
import { Handler } from '../../src/index.js'
import { HTTPError } from '../../src/utils/error.js'

const app = express()
// JSON parser middleware is required for body validation!
app.use(express.json())

const headersValidationBaseTest = new Handler()
    .validate('headers', {
        // MUST be lowercase
        authorization: z.string(),
    })
    .resolve(async (req) => {
        return { auth: req.headers.authorization }
    })
    .transform((data) => {
        return {
            data: {
                auth: data.auth,
            },
            meta: {},
        }
    })
    .express()

app.post('/validation/1', headersValidationBaseTest)

// ALWAYS APPEND ERROR HANDLER AFTER ROUTES
app.use((err: any, req: any, res: any, next: any) => {
    if (err instanceof HTTPError) {
        return res.status(err.status).send(err.message)
    }

    res.status(500).send('Something broke!')
})

// TESTS
describe('Validation Tests', () => {
    describe('Basic Headers Validaton', () => {
        it('should return 200 on success', (done) => {
            const auth = 'test1'
            request(app)
                .post('/validation/1')
                .set({ Authorization: auth })
                .expect(200)
                .then((res) => {
                    expect(res.body).toEqual({
                        data: {
                            auth,
                        },
                        meta: {},
                    })

                    done()
                })
                .catch(done)
        })

        it('should return 400 on no headers passed', (done) => {
            request(app).post('/validation/1').expect(400).end(done)
        })

        it('should return 400 on wrong headers passed', (done) => {
            request(app).post('/validation/1').set({ OtherHeader: '1' }).expect(400).end(done)
        })
    })
})
