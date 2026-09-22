jest.mock('aws-sdk', () => {
    const assumeRole = jest.fn((_params, cb) => cb(new Error('Error assuming role')));
    return {
        STS: jest.fn(() => ({ assumeRole })),
        S3: jest.fn(),
        Credentials: jest.fn(),
    };
});
jest.mock('aws-sdk/lib/maintenance_mode_message', () => ({ suppress: true }));

const AWS = require('aws-sdk');

const roleARN = 'arn:aws:iam::420434175168:role/crdcdh-test-submission';

describe('sts credential test', () => {
    test("session errors", (done) => {
        const sts = new AWS.STS();
        const assumeRoleParams = {
            RoleArn: roleARN,
            RoleSessionName: 'TemporarySession'
        };
        sts.assumeRole(assumeRoleParams, (err, data) => {
            expect(err).toBeDefined();
            expect(data).toBeUndefined();
            done();
        });
    });
});
