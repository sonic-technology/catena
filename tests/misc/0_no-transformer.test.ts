import { z } from "zod"

import request from "supertest"
import express from "express"
import { Handler } from "../../src/index.js"
import { HTTPError } from "../../src/utils/error.js"

const app = express()
// JSON parser middleware is required for body validation!
app.use(express.json())

const miscBaseTest = new Handler()
    .resolve(async (req, res) => {
        res.status(204).send()
    })
    .express()

const redirectBaseTest = new Handler()
    .resolve(async (req, res) => {
        res.redirect(301, "/")
    })
    .express()

app.post("/misc/1", miscBaseTest)
app.post("/misc/2", redirectBaseTest)

// ALWAYS APPEND ERROR HANDLER AFTER ROUTES
app.use((err: any, req: any, res: any, next: any) => {
    if (err instanceof HTTPError) {
        return res.status(err.status).send(err.message)
    }

    res.status(500).send("Something broke!")
})

// TESTS
describe("Misc Tests", () => {
    it("should return a custom status code without transformer", (done) => {
        request(app).post(`/misc/1`).expect(204).end(done)
    })

    it("should redirect with correct code", (done) => {
        request(app).post(`/misc/2`).expect(301).expect("Location", "/").end(done)
    })
})
