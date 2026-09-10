const {Submission} = require("../../services/submission");
const {DataRecordService} = require("../../services/data-record-service");
const config = require("../../config");
const {EmailService} = require("../../services/email");
const {NotifyUser} = require("../../services/notify-user");
const {User} = require("../../crdc-datahub-database-drivers/services/user");
const {S3Service} = require("../../services/s3-service");
const {Program} = require("../../services/program-service");

jest.mock("../../crdc-datahub-database-drivers/services/user");
jest.mock("../../services/notify-user");

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
    aggregate: jest.fn(),
    insert: jest.fn(),
    name: 'MockCollection'
});

// Mock database service
const dbService = {
    updateMany: jest.fn().mockResolvedValue({ modifiedCount: 0 })
};

const userCollection = createMockCollection();
const logCollection = createMockCollection();
const submissionCollection = createMockCollection();

const emailService = new EmailService(config.email_transport, config.emails_enabled);
const notificationsService = new NotifyUser(emailService, null);
const userService = new User(userCollection);
const dataRecordService = new DataRecordService({}, config.file_queue, config.metadata_queue, null);
const s3Service = new S3Service();
const programService = new Program({});
const subInterface = new Submission(logCollection, submissionCollection, null, userService, programService, notificationsService, dataRecordService, "dev2", null, null, null, s3Service)

describe('Submission service test', () => {

    afterEach(() => {
        jest.clearAllMocks();
    });

    test("deleteInactiveApplications no accessed submissions", async () => {
        submissionCollection.aggregate.mockImplementation(() => {
            return [];
        });
        await subInterface.deleteInactiveSubmissions();
        expect(dbService.updateMany).toBeCalledTimes(0);

    });
});
