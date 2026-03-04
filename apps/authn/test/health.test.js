const config = require("../config");
const request = require('supertest');

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

const app = require('../app');

describe('GET /health test', ()=> {
    test(`ping`, async () => {
        const res = await request(app)
            .get('/api/authn/ping')
            .expect(200);
        expect(res.text).toBe('pong');
    });

    test(`version & date`, async () => {
        const res = await request(app)
            .get('/api/authn/version')
            .expect(200);
        expect(res._body.version).toBe(config.version);
    });

});
