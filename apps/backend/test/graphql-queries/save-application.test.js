const ERROR = require("../../constants/error-constants");
const {Application} = require("../../services/application");
const {TEST_SESSION, TEST_APPLICATION} = require("../test-constants");
const {v4} = require("uuid");
const {IN_PROGRESS} = require("../../constants/application-constants");

const createMockCollection = () => ({
    create: jest.fn(),
    createMany: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
    deleteMany: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
    insert: jest.fn(),
    name: 'MockCollection'
});

const applicationCollection = createMockCollection();
const logCollection = createMockCollection();
const dataInterface = new Application(logCollection, applicationCollection);

describe('saveApplication API test', () => {

    test("session validation failure", async () => {
        let session = {};
        expect(dataInterface.saveApplication({}, session)).rejects.toThrow(ERROR.NOT_LOGGED_IN);
        session = {
            userInfo: {}
        };
        expect(dataInterface.saveApplication({}, session)).rejects.toThrow(ERROR.SESSION_NOT_INITIALIZED);
    });
});
