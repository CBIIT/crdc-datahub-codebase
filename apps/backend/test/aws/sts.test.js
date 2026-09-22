jest.mock('aws-sdk', () => {
    const assumeRole = jest.fn();
    return {
        STS: jest.fn(() => ({ assumeRole })),
        S3: jest.fn(),
        SQS: jest.fn(),
        QuickSight: jest.fn(),
        Credentials: jest.fn(),
    };
});
jest.mock('aws-sdk/lib/maintenance_mode_message', () => ({ suppress: true }));
jest.mock('../../config', () => ({
    role_arn: 'arn:aws:iam::123456789012:role/test-submission',
}));

const AWS = require('aws-sdk');
const { AWSService } = require('../../services/aws-request');

describe('AWSService.createTempCredentials', () => {
    const roleArn = 'arn:aws:iam::123456789012:role/test-submission';
    const bucketName = 'test-bucket';
    const rootPath = 'submissions/abc';
    let awsService;
    let assumeRole;
    let configurationService;

    beforeEach(() => {
        jest.clearAllMocks();
        assumeRole = new AWS.STS().assumeRole;
        configurationService = {
            findByType: jest.fn().mockReturnValue({ value: 1 }),
        };
        awsService = new AWSService(configurationService);
        assumeRole.mockImplementation((_params, cb) => cb(new Error('Error assuming role')));
    });

    test('rejects when assumeRole fails and sends the expected STS request', async () => {
        await expect(awsService.createTempCredentials(bucketName, rootPath))
            .rejects.toThrow('Error assuming role');

        expect(assumeRole).toHaveBeenCalledTimes(1);
        expect(assumeRole).toHaveBeenCalledWith(
            {
                RoleArn: roleArn,
                RoleSessionName: expect.stringMatching(/^Temp_Session_\d+$/),
                DurationSeconds: 3600,
                Policy: JSON.stringify({
                    Version: '2012-10-17',
                    Statement: [{
                        Effect: 'Allow',
                        Action: ['s3:GetObject', 's3:PutObject'],
                        Resource: [`arn:aws:s3:::${bucketName}/${rootPath}/*`],
                    }],
                }),
            },
            expect.any(Function),
        );
    });
});
