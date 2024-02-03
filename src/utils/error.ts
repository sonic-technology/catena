export enum HTTPStatus {
    OK = 200,
    BAD_REQUEST = 400,
    UNAUTHORIZED = 401,
    FORBIDDEN = 403,
    NOT_FOUND = 404,
    INTERNAL_SERVER_ERROR = 500,
}

export const HTTPStatusText: Record<HTTPStatus, string> = {
    [HTTPStatus.OK]: 'OK',
    [HTTPStatus.BAD_REQUEST]: 'Bad Request',
    [HTTPStatus.UNAUTHORIZED]: 'Unauthorized',
    [HTTPStatus.FORBIDDEN]: 'Forbidden',
    [HTTPStatus.NOT_FOUND]: 'Not Found',
    [HTTPStatus.INTERNAL_SERVER_ERROR]: 'Internal Server Error',
}

export class HTTPError extends Error {
    constructor(
        public readonly status: number,
        message: string
    ) {
        super(message)
    }
}
