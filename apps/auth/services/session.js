const session = require('express-session');
const {randomBytes} = require("crypto");
const config = require('../config');
const {DatabaseConnector} = require("../crdc-datahub-database-drivers/database-connector");
function createSession({ sessionSecret, session_timeout } = {}) {
    sessionSecret = sessionSecret || randomBytes(16).toString("hex");
    return session({
        secret: sessionSecret,
        // rolling: true,
        saveUninitialized: false,
        resave: true,
        store: DatabaseConnector.createMongoStore(config.mongo_db_connection_string, session_timeout)
    });
}

module.exports = {
    createSession
};