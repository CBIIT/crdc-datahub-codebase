const {
    compareSyncedPrefix,
    contentVerdict,
    etagsMatch,
    checksumsFromHeaders,
    CONTENT_VERDICT,
} = require('../../utility/synced-copy-compare');

/**
 * contentVerdict decision table for the archive copy check.
 */
const CONTENT_VERDICT_VECTORS = [
    { name: 'equal ETags', source: { etag: 'abc' }, dest: { etag: 'abc' }, verdict: 'equal' },
    { name: 'equal ETags, quoting differs', source: { etag: '"abc"' }, dest: { etag: 'abc' }, verdict: 'equal' },
    { name: 'different ETags, no checksums', source: { etag: 'a' }, dest: { etag: 'b' }, verdict: 'unknown' },
    { name: 'no metadata at all', source: {}, dest: {}, verdict: 'unknown' },
    { name: 'full-object CRC64NVME equal', source: { checksums: { CRC64NVME: 'x' }, checksumType: 'FULL_OBJECT' }, dest: { checksums: { CRC64NVME: 'x' }, checksumType: 'FULL_OBJECT' }, verdict: 'equal' },
    { name: 'full-object CRC64NVME different', source: { checksums: { CRC64NVME: 'x' }, checksumType: 'FULL_OBJECT' }, dest: { checksums: { CRC64NVME: 'y' }, checksumType: 'FULL_OBJECT' }, verdict: 'different' },
    { name: 'full-object inferred from missing suffix, different', source: { checksums: { SHA256: 'x' } }, dest: { checksums: { SHA256: 'y' } }, verdict: 'different' },
    { name: 'checksum on one side only', source: { checksums: { CRC64NVME: 'x' } }, dest: {}, verdict: 'unknown' },
    { name: 'different algorithms', source: { checksums: { CRC32: 'x' } }, dest: { checksums: { CRC64NVME: 'x' } }, verdict: 'unknown' },
    { name: 'composite equal', source: { checksums: { CRC32: 'x-3' } }, dest: { checksums: { CRC32: 'x-3' } }, verdict: 'equal' },
    { name: 'composite different', source: { checksums: { CRC32: 'x-3' } }, dest: { checksums: { CRC32: 'y-4' } }, verdict: 'unknown' },
    { name: 'explicit COMPOSITE type, different', source: { checksums: { CRC32C: 'x' }, checksumType: 'COMPOSITE' }, dest: { checksums: { CRC32C: 'y' }, checksumType: 'COMPOSITE' }, verdict: 'unknown' },
    { name: 'full-object vs composite', source: { checksums: { CRC32: 'x' }, checksumType: 'FULL_OBJECT' }, dest: { checksums: { CRC32: 'x-3' } }, verdict: 'unknown' },
    { name: 'CRC64NVME preferred over a differing composite CRC32', source: { checksums: { CRC64NVME: 'n', CRC32: 'a-2' } }, dest: { checksums: { CRC64NVME: 'n', CRC32: 'b-3' } }, verdict: 'equal' },
    { name: 'equal ETags win over differing checksums', source: { etag: 'e', checksums: { CRC64NVME: 'x' } }, dest: { etag: 'e', checksums: { CRC64NVME: 'y' } }, verdict: 'equal' },
];

/**
 * compareSyncedPrefix compares a source S3 prefix against the copy a DataSync transfer made at
 * a destination prefix. Matching is on key, size, and provable content equality (ETag or stored
 * checksum).
 */

const SOURCE_BUCKET = 'submission-bucket';
const SOURCE_PREFIX = 'submissions/sub-1/file';
const DEST_BUCKET = 'dm-bucket';
const DEST_PREFIX = 'study-1';

/**
 * Listing entry. The default ETag is derived from the size so that existing key/size fixtures
 * model a faithful copy; pass an explicit ETag to model different content.
 * @returns {{Key: string, Size: number, ETag: string}}
 */
const obj = (Key, Size, ETag = `"etag-${Size}"`) => ({ Key, Size, ETag });

/** Normalized HeadObject checksum metadata. */
const head = (checksums = {}, checksumType = null, etag = null, size = 500) => ({
    etag,
    checksumType,
    checksums,
    size,
});

/**
 * @param {{ETag?: string, Size: number}} entry
 */
function listingEntryToHead(entry) {
    let etag = null;
    if (entry.ETag != null) {
        const text = String(entry.ETag).trim().replace(/^"+|"+$/g, '');
        etag = text === '' ? null : text;
    }
    return { etag, size: entry.Size, checksumType: null, checksums: {} };
}

/**
 * Lists the source prefix only. Destination objects are resolved with HeadObject per key.
 * @param {object[]} sourceObjects Objects under the source prefix
 * @param {object[]} [destObjects] Destination objects used to seed default HeadObject fixtures
 * @param {Record<string, object>} [extraHeads] HeadObject overrides keyed by `bucket|key`
 */
function mockS3Service(sourceObjects, destObjects = [], extraHeads = {}) {
    const heads = {};
    for (const object of sourceObjects) {
        heads[`${SOURCE_BUCKET}|${object.Key}`] = listingEntryToHead(object);
    }
    for (const object of destObjects) {
        heads[`${DEST_BUCKET}|${object.Key}`] = listingEntryToHead(object);
    }
    Object.assign(heads, extraHeads);
    return {
        listFileInDir: jest.fn(async (bucket) => {
            if (bucket === SOURCE_BUCKET) {
                return sourceObjects;
            }
            throw new Error(`unexpected bucket: ${bucket}`);
        }),
        headObjectChecksums: jest.fn(async (bucket, key) => {
            const id = `${bucket}|${key}`;
            if (!(id in heads)) {
                const err = new Error('NotFound');
                err.code = 'NotFound';
                throw err;
            }
            return heads[id];
        }),
    };
}

function makeLogger() {
    return { info: jest.fn(), error: jest.fn() };
}

/**
 * @param {object[]} sourceObjects
 * @param {object[]} destObjects
 * @param {object} [logger]
 */
function run(sourceObjects, destObjects = [], logger = makeLogger(), s3Service = mockS3Service(sourceObjects, destObjects)) {
    return compareSyncedPrefix({
        sourceBucket: SOURCE_BUCKET,
        sourcePrefix: SOURCE_PREFIX,
        destBucket: DEST_BUCKET,
        destPrefix: DEST_PREFIX,
        s3Service,
        logger,
    });
}

/**
 * One source object and one destination object with the same key and size but different ETags,
 * so the comparison must consult HeadObject.
 * @param {object} sourceHead HeadObject metadata for the source object
 * @param {object} destHead HeadObject metadata for the destination object
 */
function runWithHeads(sourceHead, destHead) {
    const source = [obj(`${SOURCE_PREFIX}/a.fastq`, 500, '"source-etag"')];
    const dest = [obj(`${DEST_PREFIX}/a.fastq`, 500, '"dest-etag"')];
    const s3Service = mockS3Service(source, dest, {
        [`${SOURCE_BUCKET}|${SOURCE_PREFIX}/a.fastq`]: sourceHead,
        [`${DEST_BUCKET}|${DEST_PREFIX}/a.fastq`]: destHead,
    });
    return { s3Service, result: run(source, dest, makeLogger(), s3Service) };
}

describe('compareSyncedPrefix', () => {

    it('passes when every source object is present at the destination with an equal size', async () => {
        const result = await run(
            [obj(`${SOURCE_PREFIX}/a.txt`, 10), obj(`${SOURCE_PREFIX}/b.txt`, 20)],
            [obj(`${DEST_PREFIX}/a.txt`, 10), obj(`${DEST_PREFIX}/b.txt`, 20)],
        );

        expect(result.ok).toBe(true);
    });

    it('fails and names the key when a source object is absent from the destination', async () => {
        const result = await run(
            [obj(`${SOURCE_PREFIX}/a.txt`, 10), obj(`${SOURCE_PREFIX}/b.txt`, 20)],
            [obj(`${DEST_PREFIX}/a.txt`, 10)],
        );

        expect(result.ok).toBe(false);
        expect(result.reason).toEqual(expect.stringContaining('b.txt'));
    });

    it('fails and reports both sizes when a destination object has a different size', async () => {
        const result = await run(
            [obj(`${SOURCE_PREFIX}/a.txt`, 10)],
            [obj(`${DEST_PREFIX}/a.txt`, 11)],
        );

        expect(result.ok).toBe(false);
        expect(result.reason).toEqual(expect.stringContaining('a.txt'));
        expect(result.reason).toEqual(expect.stringContaining('10'));
        expect(result.reason).toEqual(expect.stringContaining('11'));
    });

    it('passes when the destination holds extra objects the source does not', async () => {
        const result = await run(
            [obj(`${SOURCE_PREFIX}/a.txt`, 10)],
            [
                obj(`${DEST_PREFIX}/a.txt`, 10),
                obj(`${DEST_PREFIX}/from-another-submission.txt`, 99),
            ],
        );

        expect(result.ok).toBe(true);
    });

    it('passes and logs when the source prefix lists zero objects', async () => {
        const logger = makeLogger();

        const result = await run([], [obj(`${DEST_PREFIX}/a.txt`, 10)], logger);

        expect(result.ok).toBe(true);
        expect(logger.info).toHaveBeenCalledWith(expect.stringContaining(SOURCE_PREFIX));
    });

    it('preserves the relative path for nested keys', async () => {
        const result = await run(
            [obj(`${SOURCE_PREFIX}/sub/dir/a.txt`, 10)],
            [obj(`${DEST_PREFIX}/sub/dir/a.txt`, 10)],
        );

        expect(result.ok).toBe(true);
    });

    it('fails when a nested key is flattened at the destination', async () => {
        const result = await run(
            [obj(`${SOURCE_PREFIX}/sub/dir/a.txt`, 10)],
            [obj(`${DEST_PREFIX}/a.txt`, 10)],
        );

        expect(result.ok).toBe(false);
        expect(result.reason).toEqual(expect.stringContaining('sub/dir/a.txt'));
    });

    it('ignores the folder placeholder key on the source side', async () => {
        const result = await run(
            [obj(`${SOURCE_PREFIX}/`, 0), obj(`${SOURCE_PREFIX}/a.txt`, 10)],
            [obj(`${DEST_PREFIX}/a.txt`, 10)],
        );

        expect(result.ok).toBe(true);
    });

    it('compares a non-zero object whose key ends with a slash', async () => {
        const result = await run(
            [obj(`${SOURCE_PREFIX}/payload/`, 128)],
            [],
        );

        expect(result.ok).toBe(false);
        expect(result.reason).toEqual(expect.stringContaining('payload/'));
    });

    it('does not list the destination bucket', async () => {
        const source = [obj(`${SOURCE_PREFIX}/a.txt`, 10)];
        const dest = [obj(`${DEST_PREFIX}/a.txt`, 10)];
        const s3Service = mockS3Service(source, dest);

        await run(source, dest, makeLogger(), s3Service);

        expect(s3Service.listFileInDir).toHaveBeenCalledTimes(1);
        expect(s3Service.listFileInDir).toHaveBeenCalledWith(SOURCE_BUCKET, SOURCE_PREFIX);
    });

    it('treats a source prefix holding only a placeholder as empty', async () => {
        const logger = makeLogger();

        const result = await run([obj(`${SOURCE_PREFIX}/`, 0)], [], logger);

        expect(result.ok).toBe(true);
        expect(logger.info).toHaveBeenCalled();
    });

    describe('content equality', () => {

        it('fails when a later submission overwrote the shared study key with different bytes of the same length', async () => {
            const { result } = runWithHeads(
                head({ CRC64NVME: 'original==' }, 'FULL_OBJECT'),
                head({ CRC64NVME: 'overwritten==' }, 'FULL_OBJECT'),
            );

            await expect(result).resolves.toEqual({
                ok: false,
                reason: expect.stringMatching(/content mismatch for a\.fastq/),
            });
        });

        it('passes on equal ETags with a destination HeadObject only', async () => {
            const source = [obj(`${SOURCE_PREFIX}/a.txt`, 10, '"same"')];
            const dest = [obj(`${DEST_PREFIX}/a.txt`, 10, '"same"')];
            const s3Service = mockS3Service(source, dest);

            const result = await run(source, dest, makeLogger(), s3Service);

            expect(result.ok).toBe(true);
            expect(s3Service.headObjectChecksums).toHaveBeenCalledTimes(1);
            expect(s3Service.headObjectChecksums).toHaveBeenCalledWith(DEST_BUCKET, `${DEST_PREFIX}/a.txt`);
        });

        it('treats ETags that differ only in quoting as equal', async () => {
            const source = [obj(`${SOURCE_PREFIX}/a.txt`, 10, '"abc"')];
            const dest = [obj(`${DEST_PREFIX}/a.txt`, 10, 'abc')];
            const s3Service = mockS3Service(source, dest);

            const result = await run(source, dest, makeLogger(), s3Service);

            expect(result.ok).toBe(true);
            expect(s3Service.headObjectChecksums).toHaveBeenCalledTimes(1);
            expect(s3Service.headObjectChecksums).toHaveBeenCalledWith(DEST_BUCKET, `${DEST_PREFIX}/a.txt`);
        });

        it('passes when ETags differ but full-object CRC64NVME checksums are equal', async () => {
            const { result, s3Service } = runWithHeads(
                head({ CRC64NVME: 'same==' }, 'FULL_OBJECT'),
                head({ CRC64NVME: 'same==' }, 'FULL_OBJECT'),
            );

            await expect(result).resolves.toEqual({ ok: true });
            expect(s3Service.headObjectChecksums).toHaveBeenCalledWith(SOURCE_BUCKET, `${SOURCE_PREFIX}/a.fastq`);
            expect(s3Service.headObjectChecksums).toHaveBeenCalledWith(DEST_BUCKET, `${DEST_PREFIX}/a.fastq`);
        });

        it('fails as unverifiable when ETags differ and neither side has a checksum', async () => {
            const { result } = runWithHeads(head(), head());

            await expect(result).resolves.toEqual({
                ok: false,
                reason: expect.stringMatching(/ContentUnverifiable for a\.fastq/),
            });
        });

        it('fails as unverifiable when only one side has a checksum', async () => {
            const { result } = runWithHeads(head({ CRC64NVME: 'x==' }, 'FULL_OBJECT'), head());

            await expect(result).resolves.toEqual({ ok: false, reason: expect.stringContaining('ContentUnverifiable') });
        });

        it('fails as unverifiable when the two sides use different checksum algorithms', async () => {
            const { result } = runWithHeads(head({ CRC32: 'x==' }, 'FULL_OBJECT'), head({ CRC64NVME: 'y==' }, 'FULL_OBJECT'));

            await expect(result).resolves.toEqual({ ok: false, reason: expect.stringContaining('ContentUnverifiable') });
        });

        it('passes on equal composite checksums', async () => {
            const { result } = runWithHeads(head({ CRC32: 'abc==-3' }), head({ CRC32: 'abc==-3' }));

            await expect(result).resolves.toEqual({ ok: true });
        });

        it('fails as unverifiable, not as a mismatch, on different composite checksums', async () => {
            const { result } = runWithHeads(head({ CRC32: 'abc==-3' }), head({ CRC32: 'def==-4' }));

            await expect(result).resolves.toEqual({ ok: false, reason: expect.stringContaining('ContentUnverifiable') });
        });

        it('fails as unverifiable when one checksum is full-object and the other composite', async () => {
            const { result } = runWithHeads(head({ CRC32: 'abc==' }, 'FULL_OBJECT'), head({ CRC32: 'abc==-3' }));

            await expect(result).resolves.toEqual({ ok: false, reason: expect.stringContaining('ContentUnverifiable') });
        });

        it('rejects when HeadObject fails, leaving retention to the caller', async () => {
            const source = [obj(`${SOURCE_PREFIX}/a.fastq`, 500, '"s"')];
            const dest = [obj(`${DEST_PREFIX}/a.fastq`, 500, '"d"')];
            const s3Service = mockS3Service(source, dest);
            s3Service.headObjectChecksums.mockRejectedValue(new Error('AccessDenied'));

            await expect(run(source, dest, makeLogger(), s3Service)).rejects.toThrow('AccessDenied');
        });

        it('stops at the first unproven object', async () => {
            const source = [
                obj(`${SOURCE_PREFIX}/a.txt`, 10, '"a"'),
                obj(`${SOURCE_PREFIX}/b.txt`, 10, '"b-src"'),
            ];
            const dest = [
                obj(`${DEST_PREFIX}/a.txt`, 10, '"a"'),
                obj(`${DEST_PREFIX}/b.txt`, 10, '"b-dst"'),
            ];
            const s3Service = mockS3Service(source, dest, {
                [`${SOURCE_BUCKET}|${SOURCE_PREFIX}/b.txt`]: head({ SHA256: 'one' }, null, null, 10),
                [`${DEST_BUCKET}|${DEST_PREFIX}/b.txt`]: head({ SHA256: 'two' }, null, null, 10),
            });

            const result = await run(source, dest, makeLogger(), s3Service);

            expect(result).toEqual({ ok: false, reason: expect.stringContaining('content mismatch for b.txt (SHA256)') });
        });

    });

});

describe('contentVerdict', () => {

    it.each(CONTENT_VERDICT_VECTORS)('$name', ({ source, dest, verdict }) => {
        expect(contentVerdict(source, dest).verdict).toBe(verdict);
    });

    it('uses the verdict constants the vectors are written against', () => {
        expect(Object.values(CONTENT_VERDICT).sort()).toEqual(['different', 'equal', 'unknown']);
    });

});

describe('etagsMatch', () => {

    it('is false when either ETag is missing', () => {
        expect(etagsMatch(undefined, undefined)).toBe(false);
        expect(etagsMatch('"a"', undefined)).toBe(false);
        expect(etagsMatch('""', '""')).toBe(false);
    });

});

describe('checksumsFromHeaders', () => {

    it('extracts every algorithm, the checksum type and the ETag from lower-case headers', () => {
        expect(checksumsFromHeaders({
            etag: '"abc-2"',
            'x-amz-checksum-crc64nvme': 'n==',
            'x-amz-checksum-crc32': 'c==',
            'x-amz-checksum-type': 'FULL_OBJECT',
            'content-length': '5',
        })).toEqual({
            etag: 'abc-2',
            checksumType: 'FULL_OBJECT',
            checksums: { CRC64NVME: 'n==', CRC32: 'c==' },
            size: 5,
        });
    });

    it('returns empty metadata when no checksum headers are present', () => {
        expect(checksumsFromHeaders({})).toEqual({
            etag: null,
            checksumType: null,
            checksums: {},
            size: null,
        });
    });

});
