const { compareSyncedPrefix } = require('../../utility/synced-copy-compare');

/**
 * compareSyncedPrefix compares a source S3 prefix against the copy a DataSync transfer made at
 * a destination prefix. Matching is on key and size only.
 */

const SOURCE_BUCKET = 'submission-bucket';
const SOURCE_PREFIX = 'submissions/sub-1/file';
const DEST_BUCKET = 'dm-bucket';
const DEST_PREFIX = 'study-1';

/** @returns {{Key: string, Size: number}} */
const obj = (Key, Size) => ({ Key, Size });

/**
 * s3Service double returning a fixed listing per bucket.
 * @param {object[]} sourceObjects Objects under the source prefix
 * @param {object[]} destObjects Objects under the destination prefix
 */
function mockS3Service(sourceObjects, destObjects) {
    return {
        listFileInDir: jest.fn(async (bucket) => {
            if (bucket === SOURCE_BUCKET) return sourceObjects;
            if (bucket === DEST_BUCKET) return destObjects;
            throw new Error(`unexpected bucket: ${bucket}`);
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
function run(sourceObjects, destObjects, logger = makeLogger()) {
    return compareSyncedPrefix({
        sourceBucket: SOURCE_BUCKET,
        sourcePrefix: SOURCE_PREFIX,
        destBucket: DEST_BUCKET,
        destPrefix: DEST_PREFIX,
        s3Service: mockS3Service(sourceObjects, destObjects),
        logger,
    });
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

    it('ignores the folder placeholder key on the destination side', async () => {
        const result = await run(
            [obj(`${SOURCE_PREFIX}/a.txt`, 10)],
            [obj(`${DEST_PREFIX}/`, 0), obj(`${DEST_PREFIX}/a.txt`, 10)],
        );

        expect(result.ok).toBe(true);
    });

    it('treats a source prefix holding only a placeholder as empty', async () => {
        const logger = makeLogger();

        const result = await run([obj(`${SOURCE_PREFIX}/`, 0)], [], logger);

        expect(result.ok).toBe(true);
        expect(logger.info).toHaveBeenCalled();
    });

});
