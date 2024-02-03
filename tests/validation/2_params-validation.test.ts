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
    .validate('params', {
        Username: z.enum([globalData.username]),
        organization: z.string(),
    })
    .resolve(async (req) => {
        return { username: req.params.Username, organization: req.params.organization }
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

app.post('/validation/:organization/:Username', paramsValidationBaseTest)

// ALWAYS APPEND ERROR HANDLER AFTER ROUTES
app.use((err: any, req: any, res: any, next: any) => {
    if (err instanceof HTTPError) {
        return res.status(err.status).send(err.message)
    }

    res.status(500).send('Something broke!')
})

// TESTS
describe('Validation Tests', () => {
    describe('Params Base Validaton', () => {
        it('should return 200 on success', (done) => {
            const params = {
                Username: globalData.username,
                organization: 'test2',
            }
            request(app)
                .post(`/validation/${params.organization}/${params.Username}`)
                .expect(200)
                .then((res) => {
                    expect(res.body).toEqual({
                        data: {
                            username: params.Username,
                            organization: params.organization,
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
                .post(`/validation/${wrongParams.organization}/${wrongParams.Username}`)
                .expect(400)
                .end(done)
        })
    })
})
