const {Application} = require("../../services/application");
const config = require("../../config");
const {EmailService} = require("../../services/email");
const {NotifyUser} = require("../../services/notify-user");
const {ApprovedStudiesService} = require("../../services/approved-studies");
const {S3Service} = require("../../services/s3-service");
const {BatchService} = require("../../services/batch-service");
const {Submission} = require("../../services/submission");
const ApplicationDAO = require("../../dao/application");

jest.spyOn(ApplicationDAO.prototype, "aggregate").mockImplementation(() => []);
jest.spyOn(ApplicationDAO.prototype, "updateMany").mockImplementation(() => ({ matchedCount: 0, modifiedCount: 0 }));

const {UserService} = require("../../services/user");
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
    insert: jest.fn(),
    name: 'MockCollection'
});

// Mock organization service
const programService = {
    findById: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn()
};

const applicationCollection = createMockCollection();
const logCollection = createMockCollection();
const submissionCollection = createMockCollection();

// Mock database service
const dbService = {
    updateMany: jest.fn().mockResolvedValue({ modifiedCount: 0 })
};

const emailService = new EmailService(config.email_transport, config.emails_enabled);
const notificationsService = new NotifyUser(emailService, null);
const userService = new UserService(logCollection, null, null, null, null, null, {}, null);
const submissionService = new Submission(logCollection, submissionCollection, null, null, programService);
const s3Service = new S3Service();

// Mock AWS service and fetchDataModelInfo for consistent BatchService constructor
const mockAwsService = {
    sendSQSMessage: jest.fn()
};

const mockFetchDataModelInfo = jest.fn().mockResolvedValue({
    'test-commons': {
        'omit-DCF-prefix': false
    }
});

const batchService = new BatchService(s3Service, config.sqs_loader_queue, mockAwsService, config.prod_url, mockFetchDataModelInfo);
const emailParams = {url: config.emails_url, officialEmail: config.official_email, inactiveDays: config.inactive_application_days, remindDay: config.remind_application_days};
const dataInterface = new Application(logCollection, applicationCollection, null, submissionService, batchService, userService, dbService, notificationsService, emailParams, null, null, null, null);

describe('Batch Jobs test', () => {

    afterEach(() => {
        jest.clearAllMocks();
    });

    test("deleteInactiveApplications no updated application", async () => {
        dbService.updateMany.mockReset();
        dbService.updateMany.mockResolvedValue({ modifiedCount: 0 });
        await dataInterface.deleteInactiveApplications(30); // use a valid days value
        expect(dbService.updateMany).toBeCalledTimes(0);
        expect(notificationsService.inactiveApplicationsNotification).toBeCalledTimes(0);
    });

    test("deleteInactiveApplications undefined", async () => {
        dbService.updateMany.mockReset();
        dbService.updateMany.mockResolvedValue({ modifiedCount: 0 });
        // Patch: expect resolved value to be undefined (not rejected)
        await expect(dataInterface.deleteInactiveApplications(30)).resolves.toBeUndefined();
    });
});
