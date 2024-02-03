import { z } from 'zod'

import request from 'supertest'
import express from 'express'
import { Handler } from '../../src/index.js'
import { HTTPError } from '../../src/utils/error.js'

const app = express()
// JSON parser middleware is required for body validation!
app.use(express.json())

const globalData = {
    username: 'test1',
}

const paramsValidationBaseTest = new Handler()
    .validate('query', {
        Username: z.enum([globalData.username]),
        organization: z.string(),
    })
    .resolve(async (req) => {
        return { username: req.query.Username, organization: req.query.organization }
    })
    .transform((data) => {
        return {
            data: {
                username: data.username,
                organization: data.organization,
            },
            meta: {},
        }
    })
    .express()

app.post('/validation/1', paramsValidationBaseTest)

// ALWAYS APPEND ERROR HANDLER AFTER ROUTES
app.use((err: any, req: any, res: any, next: any) => {
    if (err instanceof HTTPError) {
        return res.status(err.status).send(err.message)
    }

    res.status(500).send('Something broke!')
})

// TESTS
describe('Validation Tests', () => {
    describe('Query Base Validaton', () => {
        it('should return 200 on success', (done) => {
            const queryParams = {
                Username: globalData.username,
                organization: 'test2',
            }
            request(app)
                .post(
                    `/validation/1?organization=${queryParams.organization}&Username=${queryParams.Username}`
                )
                .expect(200)
                .then((res) => {
                    expect(res.body).toEqual({
                        data: {
                            username: queryParams.Username,
                            organization: queryParams.organization,
                        },
                        meta: {},
                    })

                    done()
                })
                .catch(done)
        })

        it('should return 400 on wrong params passed', (done) => {
            const wrongParams = {
                Username: 1,
                organization: 2,
            }

            request(app)
                .post(
                    `/validation/1?organization=${wrongParams.organization}&Username=${wrongParams.Username}`
                )
                .expect(400)
                .end(done)
        })

        it('should return 400 on missing params passed', (done) => {
            request(app).post(`/validation/1`).expect(400).end(done)
        })
    })
})
