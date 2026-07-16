const mongoose = require('mongoose');

/**
 * Connect Mongoose to the same MongoDB/DocumentDB URI used by the app.
 * Idempotent when already connected. Uses retryWrites: false for DocumentDB compatibility.
 *
 * @param {string} uri MongoDB connection string
 * @returns {Promise<typeof mongoose>}
 */
async function connectMongoose(uri) {
    if (mongoose.connection.readyState === 1) {
        return mongoose;
    }
    await mongoose.connect(uri, { retryWrites: false });
    console.log('Connected to MongoDB via Mongoose');
    return mongoose;
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
