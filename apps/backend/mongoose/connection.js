const mongoose = require('mongoose');

/** @type {Promise<typeof mongoose>|null} */
let connectPromise = null;

/**
 * Connect Mongoose using the shared MongoDB/DocumentDB URI.
 * Validates uri, short-circuits when already connected, and shares one in-flight
 * connect promise so concurrent callers are idempotent. On failure the cached
 * promise is cleared so a later call can retry.
 * Uses retryWrites: false for DocumentDB compatibility. TLS/CA settings come
 * from the URI when MONGO_DB_CA_FILE is set in config.
 *
 * @param {string} uri MongoDB or DocumentDB connection string
 * @returns {Promise<typeof mongoose>}
 * @throws {Error} When uri is missing or empty
 */
async function connectMongoose(uri) {
    if (!uri || typeof uri !== 'string' || !uri.trim()) {
        throw new Error('MongoDB/DocumentDB connection URI is required');
    }
    if (mongoose.connection.readyState === 1) {
        return mongoose;
    }
    if (!connectPromise) {
        connectPromise = mongoose.connect(uri, { retryWrites: false })
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
};
