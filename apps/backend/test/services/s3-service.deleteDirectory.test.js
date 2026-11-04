const { S3Service } = require('../../services/s3-service');

/**
 * deleteDirectory must report a partial deleteObjects failure and stop paging.
 * A permanently undeletable key is returned by every listing, so continuing
 * after Errors would loop.
 */

/**
 * @param {{contents?: object[], truncated?: boolean, token?: string}} [page]
 * @returns {object}
 */
function listResult({ contents, truncated = false, token } = {}) {
    const result = { IsTruncated: truncated };
    if (contents !== undefined) {
        result.Contents = contents;
    }
    if (token) {
        result.NextContinuationToken = token;
    }
    return result;
}

describe('S3Service.deleteDirectory', () => {
    let service;
    let listObjectsV2;
    let deleteObjects;

    beforeEach(() => {
        service = new S3Service();
        listObjectsV2 = jest.fn();
        deleteObjects = jest.fn();
        service.s3 = {
            listObjectsV2: jest.fn(() => ({ promise: listObjectsV2 })),
            deleteObjects: jest.fn(() => ({ promise: deleteObjects })),
        };
        jest.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('returns false and does not continue when deleteObjects reports errors', async () => {
        listObjectsV2.mockResolvedValueOnce(listResult({
            contents: [{ Key: 'prefix/a.txt' }, { Key: 'prefix/b.txt' }],
            truncated: true,
            token: 'next',
        }));
        deleteObjects.mockResolvedValueOnce({
            Errors: [{ Key: 'prefix/b.txt', Code: 'AccessDenied', Message: 'locked' }],
        });

        await expect(service.deleteDirectory('bucket', 'prefix')).resolves.toBe(false);

        expect(service.s3.listObjectsV2).toHaveBeenCalledTimes(1);
        expect(service.s3.deleteObjects).toHaveBeenCalledTimes(1);
        expect(console.error).toHaveBeenCalledWith(expect.stringContaining('key=prefix/b.txt'));
        expect(console.error).toHaveBeenCalledWith(expect.stringContaining('code=AccessDenied'));
        expect(console.error).toHaveBeenCalledWith(expect.stringContaining('message=locked'));
    });

    it('returns true after a clean multi-page delete', async () => {
        listObjectsV2
            .mockResolvedValueOnce(listResult({
                contents: [{ Key: 'prefix/a.txt' }],
                truncated: true,
                token: 'page-2',
            }))
            .mockResolvedValueOnce(listResult({
                contents: [{ Key: 'prefix/b.txt' }],
            }));
        deleteObjects.mockResolvedValue({});

        await expect(service.deleteDirectory('bucket', 'prefix')).resolves.toBe(true);

        expect(service.s3.listObjectsV2).toHaveBeenCalledTimes(2);
        expect(service.s3.listObjectsV2.mock.calls[1][0]).toEqual(expect.objectContaining({
            Bucket: 'bucket',
            Prefix: 'prefix/',
            ContinuationToken: 'page-2',
        }));
        expect(service.s3.deleteObjects).toHaveBeenCalledTimes(2);
    });

    it('returns true when the listing omits Contents', async () => {
        listObjectsV2.mockResolvedValueOnce(listResult());

        await expect(service.deleteDirectory('bucket', 'prefix/')).resolves.toBe(true);

        expect(service.s3.deleteObjects).not.toHaveBeenCalled();
    });
});
