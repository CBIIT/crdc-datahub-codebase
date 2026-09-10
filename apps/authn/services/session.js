const session = require('express-session');
const {randomBytes} = require("crypto");
const config = require('../config');
const {DatabaseConnector} = require("../crdc-datahub-database-drivers/database-connector");
/**
 * Creates an Express session using MongoDB session storage.
 * @param {object} [params]
 * @param {string} [params.sessionSecret] Secret used to sign the session ID cookie
 * @param {number} [params.session_timeout] Session TTL in milliseconds
 * @returns {Function} Express session middleware
 */
function createSession({ sessionSecret, session_timeout } = {}) {
    sessionSecret = sessionSecret || randomBytes(16).toString("hex");
    return session({
        secret: sessionSecret,
        // rolling: true,
        saveUninitialized: false,
        resave: true,
        store: DatabaseConnector.createMongoStore(config.document_db_connection_string, session_timeout)
    });
}

module.exports = {
    createSession
};
