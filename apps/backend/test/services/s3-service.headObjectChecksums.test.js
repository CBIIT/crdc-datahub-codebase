const { S3Service } = require('../../services/s3-service');

/**
 * headObjectChecksums reads S3's stored checksum from the raw HeadObject response headers. The
 * aws-sdk v2 S3 model has no ChecksumCRC64NVME or ChecksumType, so the parsed response would drop
 * S3's default checksum; these tests pin that the raw headers are used.
 */

/**
 * Fake aws-sdk v2 request: records listeners, emits `httpHeaders` when promise() is awaited, and
 * resolves with a parsed body that deliberately lacks the checksum fields (as v2 would).
 * @param {Record<string, string>} headers Raw response headers to emit
 * @param {Error} [error] Rejection to return instead
 */
function fakeRequest(headers, error) {
    const listeners = {};
    return {
        on: jest.fn((event, listener) => {
            listeners[event] = listener;
        }),
        promise: jest.fn(async () => {
            if (error) {
                throw error;
            }
            listeners.httpHeaders?.(200, headers);
            return { ETag: headers.etag, ContentLength: 5 };
        }),
    };
}

describe('S3Service.headObjectChecksums', () => {

    let service;

    beforeEach(() => {
        service = new S3Service();
    });

    it('requests checksum mode and returns the CRC64NVME checksum and type from the raw headers', async () => {
        service.s3 = {
            headObject: jest.fn(() => fakeRequest({
                etag: '"abc-2"',
                'x-amz-checksum-crc64nvme': 'Naz0uXkYBPM=',
                'x-amz-checksum-type': 'FULL_OBJECT',
            })),
        };

        const result = await service.headObjectChecksums('bucket', 'prefix/a.fastq');

        expect(service.s3.headObject).toHaveBeenCalledWith({
            Bucket: 'bucket',
            Key: 'prefix/a.fastq',
            ChecksumMode: 'ENABLED',
        });
        expect(result).toEqual({
            etag: 'abc-2',
            checksumType: 'FULL_OBJECT',
            checksums: { CRC64NVME: 'Naz0uXkYBPM=' },
        });
    });

    it('matches header names case-insensitively', async () => {
        service.s3 = {
            headObject: jest.fn(() => fakeRequest({
                ETag: '"e"',
                'X-Amz-Checksum-SHA256': 's==',
            })),
        };

        const result = await service.headObjectChecksums('bucket', 'k');

        expect(result).toEqual({ etag: 'e', checksumType: null, checksums: { SHA256: 's==' } });
    });

    it('returns no checksums for an object stored without one', async () => {
        service.s3 = { headObject: jest.fn(() => fakeRequest({ etag: '"e"' })) };

        const result = await service.headObjectChecksums('bucket', 'k');

        expect(result.checksums).toEqual({});
    });

    it('rejects when HeadObject fails', async () => {
        service.s3 = { headObject: jest.fn(() => fakeRequest({}, new Error('AccessDenied'))) };

        await expect(service.headObjectChecksums('bucket', 'k')).rejects.toThrow('AccessDenied');
    });

});
