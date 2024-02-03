import { z } from 'zod'

import request from 'supertest'
import express from 'express'
import { Handler } from '../../src/index.js'
import { HTTPError } from '../../src/utils/error.js'

const app = express()
// JSON parser middleware is required for body validation!
app.use(express.json())

const bodyValidationBaseTest = new Handler()
    .validate('body', {
        user: z.object({
            username: z.string(),
            password: z.string(),
        }),
    })
    .resolve(async (req) => {
        return { name: req.body.user.username, password: req.body.user.password }
    })
    .transform((data) => {
        return {
            data: {
                name: data.name,
                password: data.password,
            },
            meta: {},
        }
    })
    .express()

const validateBody = z.object({
    user: z.object({
        username: z.string(),
        password: z.string(),
    }),
})

const bodyValidationExternalValidatorTest = new Handler()
    .validate('body', validateBody)
    .resolve(async (req) => {
        return { name: req.body.user.username, password: req.body.user.password }
    })
    .transform((data) => {
        return {
            data: {
                name: data.name,
                password: data.password,
            },
            meta: {},
        }
    })
    .express()

app.post('/validation/1', bodyValidationBaseTest)
app.post('/validation/2', bodyValidationExternalValidatorTest)

// ALWAYS APPEND ERROR HANDLER AFTER ROUTES
app.use((err: any, req: any, res: any, next: any) => {
    if (err instanceof HTTPError) {
        return res.status(err.status).send(err.message)
    }

    res.status(500).send('Something broke!')
})

// TESTS
describe('Validation Tests', () => {
    describe('Basic Body Validaton', () => {
        it('should return 200 on success', (done) => {
            const user = {
                username: 'test1',
                password: 'test2',
            }
            request(app)
                .post('/validation/1')
                .send({
                    user,
                })
                .set('Content-Type', 'application/json')
                .set('Accept', 'application/json')
                .expect(200)
                .then((res) => {
                    expect(res.body).toEqual({
                        data: {
                            name: user.username,
                            password: user.password,
                        },
                        meta: {},
                    })

                    done()
                })
                .catch(done)
        })

        it('should return 400 on no body passed', (done) => {
            request(app).post('/validation/1').expect(400).end(done)
        })

        it('should return 400 on missing username', (done) => {
            const user = {
                password: 'test2',
            }
            request(app)
                .post('/validation/1')
                .send({
                    user,
                })
                .set('Content-Type', 'application/json')
                .set('Accept', 'application/json')
                .expect(400)
                .end(done)
        })

        it('should return 400 on wrongly formatted data', (done) => {
            request(app)
                .post('/validation/1')
                .send('string')
                .set('Content-Type', 'text/plain')
                .expect(400)
                .end(done)

            request(app)
                .post('/validation/1')
                .send(undefined)
                .set('Content-Type', 'unset')
                .expect(400)
                .end(done)
        })
    })

    describe('External Validator Object Body Validaton', () => {
        it('should return 200 on success', (done) => {
            const user = {
                username: 'test1',
                password: 'test2',
            }
            request(app)
                .post('/validation/2')
                .send({
                    user,
                })
                .set('Content-Type', 'application/json')
                .set('Accept', 'application/json')
                .expect(200)
                .then((res) => {
                    expect(res.body).toEqual({
                        data: {
                            name: user.username,
                            password: user.password,
                        },
                        meta: {},
                    })

                    done()
                })
                .catch(done)
        })

        it('should return 400 on no body passed', (done) => {
            request(app).post('/validation/2').expect(400).end(done)
        })

        it('should return 400 on missing username', (done) => {
            const user = {
                password: 'test2',
            }
            request(app)
                .post('/validation/2')
                .send({
                    user,
                })
                .set('Content-Type', 'application/json')
                .set('Accept', 'application/json')
                .expect(400)
                .end(done)
        })

        it('should return 400 on wrongly formatted data', (done) => {
            request(app)
                .post('/validation/2')
                .send('string')
                .set('Content-Type', 'text/plain')
                .expect(400)
                .end(done)

            request(app)
                .post('/validation/2')
                .send(undefined)
                .set('Content-Type', 'unset')
                .expect(400)
                .end(done)
        })
    })
})
