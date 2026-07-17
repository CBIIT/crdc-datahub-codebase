const mongoose = require('mongoose');

/** @type {Promise<typeof mongoose>|null} */
let connectPromise = null;

/**
 * Builds Mongoose connect options for DocumentDB compatibility.
 * Always disables retryable writes. When tlsCAFile is set, enables TLS.
 *
 * @param {string} [tlsCAFile] Path to the TLS CA bundle
 * @returns {object}
 */
function getMongooseConnectOptions(tlsCAFile) {
    const options = {
        retryWrites: false,
    };
    // TEMPORARY (Prisma→DocumentDB migration): tlsCAFile may come from DOCUMENTDB_CA_FILE or MONGO_DB_CA_FILE.
    if (tlsCAFile) {
        options.tls = true;
        options.tlsCAFile = tlsCAFile;
    }
    return options;
}

/**
 * Connect Mongoose to MongoDB/DocumentDB.
 * Validates uri, short-circuits when already connected, and shares one in-flight
 * connect promise so concurrent callers are idempotent. On failure the cached
 * promise is cleared so a later call can retry.
 * Uses retryWrites: false for DocumentDB compatibility.
 * When tlsCAFile is provided, connects with tls=true and that CA bundle.
 *
 * TEMPORARY (Prisma→DocumentDB migration): `tlsCAFile` supports dual-datasource TLS selection.
 * See documentation/temporary-dual-datasources.md for reversal inventory.
 *
 * @param {string} uri MongoDB or DocumentDB connection string
 * @param {string} [tlsCAFile] Path to the TLS CA bundle for the chosen datasource
 * @returns {Promise<typeof mongoose>}
 * @throws {Error} When uri is missing or empty
 */
async function connectMongoose(uri, tlsCAFile) {
    if (!uri || typeof uri !== 'string' || !uri.trim()) {
        throw new Error('MongoDB/DocumentDB connection URI is required');
    }
    if (mongoose.connection.readyState === 1) {
        return mongoose;
    }
    if (!connectPromise) {
        connectPromise = mongoose.connect(uri, getMongooseConnectOptions(tlsCAFile))
            .then(() => {
                console.log('Connected to database via Mongoose');
                return mongoose;
            })
            .catch((error) => {
                connectPromise = null;
                throw error;
            });
    }
    return connectPromise;
}

/**
 * @returns {typeof mongoose}
 */
function getMongoose() {
    return mongoose;
}

module.exports = {
    connectMongoose,
    getMongoose,
    getMongooseConnectOptions,
};
