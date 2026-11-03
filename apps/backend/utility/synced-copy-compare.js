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
 * Compares objects under a source S3 prefix against the copy a DataSync transfer
 * made at a destination prefix. Matching is on relative key and size only;
 * extra destination objects are ignored.
 * @param {object} params
 * @param {string} params.sourceBucket Source bucket
 * @param {string} params.sourcePrefix Source prefix
 * @param {string} params.destBucket Destination bucket
 * @param {string} params.destPrefix Destination prefix
 * @param {{listFileInDir: Function}} params.s3Service S3 listing service
 * @param {{info?: Function}} [params.logger] Optional logger
 * @returns {Promise<{ok: boolean, reason?: string}>}
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
        destByRelative.set(relativeKey(object.Key, destPrefix), object.Size);
    }

    for (const object of sourceObjects) {
        const rel = relativeKey(object.Key, sourcePrefix);
        if (!destByRelative.has(rel)) {
            return { ok: false, reason: `missing destination object ${rel}` };
        }
        const destSize = destByRelative.get(rel);
        if (destSize !== object.Size) {
            return { ok: false, reason: `size mismatch for ${rel}: source ${object.Size} dest ${destSize}` };
        }
    }
    return { ok: true };
}

module.exports = { compareSyncedPrefix };
