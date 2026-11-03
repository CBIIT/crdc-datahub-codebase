/**
 * S3 additional-checksum algorithms, in the order they are tried. CRC64NVME first: since Dec 2024
 * S3 attaches a full-object CRC64NVME to every object uploaded without a checksum, so a source
 * object and the DataSync copy of it normally both carry one.
 */
const CHECKSUM_ALGORITHMS = Object.freeze(['CRC64NVME', 'SHA256', 'SHA1', 'CRC32C', 'CRC32']);

const CONTENT_VERDICT = Object.freeze({
    EQUAL: 'equal',
    DIFFERENT: 'different',
    UNKNOWN: 'unknown',
});

/**
 * Relative object key under a prefix. Trailing slashes on the prefix are ignored.
 * @param {string} key Object key
 * @param {string} prefix Prefix to strip
 * @returns {string}
 */
function relativeKey(key, prefix) {
    const normalizedPrefix = String(prefix).replace(/\/+$/, '');
    const prefixWithSlash = `${normalizedPrefix}/`;
    if (key.startsWith(prefixWithSlash)) {
        return key.slice(prefixWithSlash.length);
    }
    if (key === normalizedPrefix) {
        return '';
    }
    return key;
}

/**
 * True for a zero-length "folder" marker object, which S3 consoles create and DataSync does
 * not necessarily reproduce. These are not data and are excluded from the comparison.
 * @param {{Key: string}} object S3 listing entry
 * @returns {boolean}
 */
function isFolderPlaceholder(object) {
    return String(object.Key).endsWith('/');
}

/**
 * ETag with surrounding quotes removed, or null when absent.
 * @param {string|undefined|null} etag
 * @returns {string|null}
 */
function normalizeETag(etag) {
    if (etag == null) {
        return null;
    }
    const text = String(etag).trim().replace(/^"+|"+$/g, '');
    return text === '' ? null : text;
}

/**
 * True only when both ETags are present and identical. Used solely as positive evidence of equal
 * content: different contents with one ETag would need an MD5 collision, whatever the encryption
 * mode. Unequal ETags prove nothing (SSE-KMS ETags are not MD5, and multipart ETags depend on part
 * size), so callers fall through to a checksum comparison.
 * @param {string|undefined} a
 * @param {string|undefined} b
 * @returns {boolean}
 */
function etagsMatch(a, b) {
    const left = normalizeETag(a);
    const right = normalizeETag(b);
    return left !== null && left === right;
}

/**
 * Builds normalized checksum metadata from raw HeadObject response headers (lower-case names).
 * @param {Record<string, string>} headers Raw response headers
 * @returns {{etag: string|null, checksumType: string|null, checksums: Record<string, string>}}
 */
function checksumsFromHeaders(headers = {}) {
    const checksums = {};
    for (const algorithm of CHECKSUM_ALGORITHMS) {
        const value = headers[`x-amz-checksum-${algorithm.toLowerCase()}`];
        if (value) {
            checksums[algorithm] = String(value);
        }
    }
    return {
        etag: normalizeETag(headers.etag),
        checksumType: headers['x-amz-checksum-type'] ? String(headers['x-amz-checksum-type']) : null,
        checksums,
    };
}

/**
 * True when a checksum value describes the whole object. An explicit checksum type wins; without
 * one, composite (multipart part-level) checksums carry a `-<partCount>` suffix.
 * @param {string} value Checksum value
 * @param {string|null|undefined} checksumType FULL_OBJECT, COMPOSITE, or absent
 * @returns {boolean}
 */
function isFullObjectChecksum(value, checksumType) {
    if (checksumType === 'FULL_OBJECT') {
        return true;
    }
    if (checksumType === 'COMPOSITE') {
        return false;
    }
    return !/-\d+$/.test(value);
}

/**
 * Decides whether two objects hold the same bytes from their ETags and stored checksums.
 * - equal ETags                                  -> equal
 * - same algorithm, both full-object, equal      -> equal
 * - same algorithm, both full-object, different  -> different (definitive)
 * - same algorithm, both composite, equal        -> equal
 * - same algorithm, both composite, different    -> unknown (part boundaries may differ)
 * - mixed full-object/composite or no shared algorithm -> unknown
 * Callers must treat anything but `equal` as "content equality not established".
 * @param {{etag?: string|null, checksumType?: string|null, checksums?: Record<string, string>}} source
 * @param {{etag?: string|null, checksumType?: string|null, checksums?: Record<string, string>}} dest
 * @returns {{verdict: string, algorithm?: string}}
 */
function contentVerdict(source = {}, dest = {}) {
    if (etagsMatch(source.etag, dest.etag)) {
        return { verdict: CONTENT_VERDICT.EQUAL };
    }
    for (const algorithm of CHECKSUM_ALGORITHMS) {
        const sourceValue = source.checksums?.[algorithm];
        const destValue = dest.checksums?.[algorithm];
        if (!sourceValue || !destValue) {
            continue;
        }
        const sourceFull = isFullObjectChecksum(sourceValue, source.checksumType);
        const destFull = isFullObjectChecksum(destValue, dest.checksumType);
        if (sourceFull !== destFull) {
            return { verdict: CONTENT_VERDICT.UNKNOWN, algorithm };
        }
        if (sourceValue === destValue) {
            return { verdict: CONTENT_VERDICT.EQUAL, algorithm };
        }
        return {
            verdict: sourceFull ? CONTENT_VERDICT.DIFFERENT : CONTENT_VERDICT.UNKNOWN,
            algorithm,
        };
    }
    return { verdict: CONTENT_VERDICT.UNKNOWN };
}

/**
 * Compares objects under a source S3 prefix against the copy a DataSync transfer made at a
 * destination prefix. Every source object must exist at the destination with an equal size AND
 * provably equal content (see contentVerdict); extra destination objects are ignored.
 *
 * Content equality matters because data files land in a shared study prefix: a later submission
 * can overwrite a key with different bytes of the same length. When equality cannot be
 * established the comparison fails, so the caller retains the source.
 *
 * ETags come from the listing; HeadObject is only called when they differ.
 *
 * @param {object} params
 * @param {string} params.sourceBucket Source bucket
 * @param {string} params.sourcePrefix Source prefix
 * @param {string} params.destBucket Destination bucket
 * @param {string} params.destPrefix Destination prefix
 * @param {{listFileInDir: Function, headObjectChecksums: Function}} params.s3Service S3 service
 * @param {{info?: Function}} [params.logger] Optional logger
 * @returns {Promise<{ok: boolean, reason?: string}>} Rejects when an S3 call fails
 */
async function compareSyncedPrefix({
    sourceBucket,
    sourcePrefix,
    destBucket,
    destPrefix,
    s3Service,
    logger,
}) {
    const sourceObjects = (await s3Service.listFileInDir(sourceBucket, sourcePrefix))
        .filter((object) => !isFolderPlaceholder(object));
    const destObjects = (await s3Service.listFileInDir(destBucket, destPrefix))
        .filter((object) => !isFolderPlaceholder(object));

    if (sourceObjects.length === 0) {
        // Safe to pass only because `sourcePrefix` comes from a recorded dataSync `sourceFolder`,
        // so an empty listing means an empty folder. If a caller ever derives the prefix instead,
        // an empty listing could just as easily mean the prefix is wrong, and this must become a
        // failure for that caller. The reconciliation script derives its prefix and therefore
        // treats an empty source listing as a failure; see its compareListings.
        logger?.info?.(`Source prefix ${sourcePrefix} listed zero objects`);
        return { ok: true };
    }

    const destByRelative = new Map();
    for (const object of destObjects) {
        destByRelative.set(relativeKey(object.Key, destPrefix), object);
    }

    for (const object of sourceObjects) {
        const rel = relativeKey(object.Key, sourcePrefix);
        const destObject = destByRelative.get(rel);
        if (!destObject) {
            return { ok: false, reason: `missing destination object ${rel}` };
        }
        if (destObject.Size !== object.Size) {
            return { ok: false, reason: `size mismatch for ${rel}: source ${object.Size} dest ${destObject.Size}` };
        }
        if (etagsMatch(object.ETag, destObject.ETag)) {
            continue;
        }
        const sourceMeta = await s3Service.headObjectChecksums(sourceBucket, object.Key);
        const destMeta = await s3Service.headObjectChecksums(destBucket, destObject.Key);
        const { verdict, algorithm } = contentVerdict(sourceMeta, destMeta);
        if (verdict === CONTENT_VERDICT.DIFFERENT) {
            return { ok: false, reason: `content mismatch for ${rel} (${algorithm})` };
        }
        if (verdict !== CONTENT_VERDICT.EQUAL) {
            return { ok: false, reason: `ContentUnverifiable for ${rel}` };
        }
    }
    return { ok: true };
}

module.exports = {
    compareSyncedPrefix,
    contentVerdict,
    etagsMatch,
    checksumsFromHeaders,
    CHECKSUM_ALGORITHMS,
    CONTENT_VERDICT,
};
