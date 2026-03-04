const request = require('supertest');
const session = require('express-session');
const {NIH, LOGIN_GOV} = require("../constants/idp-constants");

// Mock database dependencies before requiring app
jest.mock("../crdc-datahub-database-drivers/database-connector", () => ({
    DatabaseConnector: jest.fn().mockImplementation(() => ({
        connect: jest.fn().mockResolvedValue({}),
        disconnect: jest.fn().mockResolvedValue({}),
        client: {}
    }))
}));

jest.mock("../crdc-datahub-database-drivers/mongodb-collection", () => ({
    MongoDBCollection: jest.fn().mockImplementation(() => ({
        insert: jest.fn().mockResolvedValue({}),
        find: jest.fn().mockResolvedValue([]),
        findOne: jest.fn().mockResolvedValue(null)
    }))
}));

jest.mock("../crdc-datahub-database-drivers/services/user", () => ({
    User: jest.fn().mockImplementation(() => ({
        isEmailAndIDPLoginPermitted: jest.fn().mockResolvedValue(true)
    }))
}));

jest.mock("../crdc-datahub-database-drivers/mongo-health-check", () => ({
    MongoDBHealthCheck: jest.fn().mockResolvedValue(true)
}));

// Mock session middleware to use memory store instead of MongoDB
jest.mock("../crdc-datahub-database-drivers/session-middleware", () => {
    const session = require('express-session');
    return jest.fn().mockImplementation((secret, timeout) => {
        return session({
            secret: secret || 'test-secret',
            resave: false,
            saveUninitialized: true,
            cookie: { maxAge: timeout || 1800000 }
        });
    });
});

jest.mock("../idps/nih");
jest.mock("../services/nih-auth");

const app = require('../app');

describe('GET /auth test', ()=> {
    const LOGOUT_ROUTE = '/api/authn/logout';
    const LOGIN_ROUTE = '/api/authn/login';
    const mockLoginResult = { name: '', tokens: '', email: '', idp: '' };

    afterEach(() => {
        jest.clearAllMocks();
    });

    test(`auth nih login called once`, async () => {
        const nihClient = require('../idps/nih');
        nihClient.login.mockReturnValue(Promise.resolve(mockLoginResult));
        const res = await request(app)
            .post(LOGIN_ROUTE)
            .send({code: 'code', IDP: NIH});
        expect(res.status).toBe(200);
        expect(nihClient.login).toBeCalledTimes(1);
    }, 10000);

    test(`auth login.gov login called once`, async () => {
        const nihClient = require('../idps/nih');
        nihClient.login.mockReturnValue(Promise.resolve(mockLoginResult));
        const res = await request(app)
            .post(LOGIN_ROUTE)
            .send({code: 'code', IDP: LOGIN_GOV});
        expect(res.status).toBe(200);
        expect(nihClient.login).toBeCalledTimes(1);
    }, 10000);

    test(`auth logout nih`, async () => {
        const nihClient = require('../idps/nih');
        nihClient.logout.mockReturnValue(Promise.resolve());
        const res = await request(app)
            .post(LOGOUT_ROUTE)
            .send({IDP: NIH});
        expect(res.status).toBe(200);
        expect(nihClient.logout).toBeCalledTimes(1);
    }, 10000);

    test(`auth logout login.gov`, async () => {
        const nihClient = require('../idps/nih');
        nihClient.logout.mockReturnValue(Promise.resolve());
        const res = await request(app)
            .post(LOGOUT_ROUTE)
            .send({IDP: LOGIN_GOV});
        expect(res.status).toBe(200);
        expect(nihClient.logout).toBeCalledTimes(1);
    }, 10000);
});
