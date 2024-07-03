import { z } from 'zod'

import request from 'supertest'
import express from 'express'
import { Handler } from '../../src/index.js'
import { HTTPError } from '../../src/utils/error.js'

const globalData = {
    username: 'test1',
    password: 'test2',
    organization: 'test3',
    filters: 'test4',
    authorization: 'test5',
}

const app = express()
// JSON parser middleware is required for body validation!
app.use(express.json())

const bodyValidationBaseTest = new Handler()
    .validate('body', {
        user: z
            .object({
                username: z.string(),
                password: z.string(),
            })
            .transform((data) => {
                return {
                    // flip it
                    username: data.password,
                    password: data.username,
                }
            }),
    })
    .validate('params', {
        organization: z.enum([globalData.organization]),
        test: z.string().refine((data) => data === 'test', {
            message: 'Test must be test',
        }),
    })
    .validate('query', {
        filters: z.string().transform(async (data) => {
            // wait for 1 second
            await new Promise((resolve) => setTimeout(resolve, 1000))

            return data.toUpperCase()
        }),
    })
    .validate('headers', {
        authorization: z.string().transform((data) => {
            return data.toLowerCase()
        }),
    })
    .middleware(async (req, res, next) => {
        if (req.body.user.username === 'FAIL') {
            throw new HTTPError(401, 'Username cannot be FAIL')
        }

        next()
    })
    .resolve(async (req) => {
        const oldPassword = req.body.user.password
        const oldUsername = req.body.user.username

        req.body.user.username = oldPassword
        req.body.user.password = oldUsername

        return {
            name: req.body.user.username,
            password: req.body.user.password,
            organization: req.params.organization,
            filters: req.query.filters,
            authorization: req.headers.authorization,
        }
    })
    .transform((data) => {
        return {
            data: {
                name: data.name,
                password: data.password,
                organization: data.organization,
                filters: data.filters,
                authorization: data.authorization,
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

app.post('/validation/:organization/:test', bodyValidationBaseTest)

// ALWAYS APPEND ERROR HANDLER AFTER ROUTES
app.use((err: any, req: any, res: any, next: any) => {
    if (err instanceof HTTPError) {
        return res.status(err.status).send(err.message)
    }

    res.status(500).send('Something broke!')
})

// TESTS
describe('Validation Tests', () => {
    describe('Transform validations', () => {
        it('should return 200 on success', (done) => {
            request(app)
                .post(
                    '/validation/' +
                        globalData.organization +
                        '/test' +
                        '?filters=' +
                        globalData.filters
                )
                .send({
                    user: {
                        username: globalData.username,
                        password: globalData.password,
                    },
                })
                .set('Content-Type', 'application/json')
                .set('Accept', 'application/json')
                .set({ Authorization: globalData.authorization })
                .expect(200)
                .then((res) => {
                    expect(res.body).toEqual({
                        data: {
                            name: globalData.username,
                            password: globalData.password,
                            organization: globalData.organization,
                            filters: globalData.filters.toUpperCase(),
                            authorization: globalData.authorization,
                        },
                        meta: {},
                    })

                    done()
                })
                .catch(done)
        })

        it('should return 400 on invalid body', (done) => {
            request(app)
                .post(
                    '/validation/' +
                        globalData.organization +
                        '/test' +
                        '?filters=' +
                        globalData.filters
                )
                .expect(400)
                .end(done)
        })

        it('should return 400 on invalid params (refined)', (done) => {
            request(app)
                .post(
                    '/validation/' +
                        globalData.organization +
                        '/not-test' +
                        '?filters=' +
                        globalData.filters
                )
                .send({
                    user: {
                        username: globalData.username,
                        password: globalData.password,
                    },
                })
                .set('Content-Type', 'application/json')
                .set('Accept', 'application/json')
                .set({ Authorization: globalData.authorization })
                .expect(400)
                .end(done)
        })

        it('should return 400 on invalid params', (done) => {
            request(app)
                .post('/validation/WRONGVALUE/test' + '?filters=' + globalData.filters)
                .send({
                    user: {
                        username: globalData.username,
                        password: globalData.password,
                    },
                })
                .set('Content-Type', 'application/json')
                .set('Accept', 'application/json')
                .set({ Authorization: globalData.authorization })
                .expect(400)
                .end(done)
        })

        it('should return 400 on invalid query', (done) => {
            request(app)
                .post('/validation/' + globalData.organization + '/test?otherQueryThanFilters=FAIL')
                .send({
                    user: {
                        username: globalData.username,
                        password: globalData.password,
                    },
                })
                .set('Content-Type', 'application/json')
                .set('Accept', 'application/json')
                .set({ Authorization: globalData.authorization })
                .expect(400)
                .end(done)
        })

        it('should return 400 on invalid headers', (done) => {
            request(app)
                .post(
                    '/validation/' + globalData.organization + '/test?filters=' + globalData.filters
                )
                .send({
                    user: {
                        username: globalData.username,
                        password: globalData.password,
                    },
                })
                .set('Content-Type', 'application/json')
                .set('Accept', 'application/json')
                .set({ NotProvided: 'FAIL' })
                .expect(400)
                .end(done)
        })

        it('should return 400 on middleware validation fail', (done) => {
            request(app)
                .post(
                    '/validation/' + globalData.organization + '/test?filters=' + globalData.filters
                )
                .send({
                    user: {
                        username: globalData.password,
                        password: 'FAIL',
                    },
                })
                .set('Content-Type', 'application/json')
                .set('Accept', 'application/json')
                .set({ Authorization: globalData.authorization })
                .expect(401)
                .end(done)
        })
    })
})
