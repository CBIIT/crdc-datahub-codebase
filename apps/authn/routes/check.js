const express = require('express');
const router = express.Router();
const config = require('../config');
const {DatabaseConnector} = require("../crdc-datahub-database-drivers/database-connector");
const {MongoDBCollection} = require("../crdc-datahub-database-drivers/mongodb-collection");
const {DATABASE_NAME, SESSION_COLLECTION} = require("../crdc-datahub-database-drivers/database-constants");
const dbConnector = new DatabaseConnector(config.mongo_db_connection_string);
const {ttlSessions} = require('../services/ttl-query')
const {MongoDBHealthCheck} = require("../crdc-datahub-database-drivers/mongo-health-check");
const {ERROR} = require("../crdc-datahub-database-drivers/constants/error-constants");

let dataInterface;
dbConnector.connect().then( async () => {
    const sessionCollection = new MongoDBCollection(dbConnector.client, DATABASE_NAME, SESSION_COLLECTION);
    dataInterface = new ttlSessions(sessionCollection);
});

router.get('/session-ttl',async function(req, res){
    console.log("request session-ttl API");
    let sessionID
    let response
    if (!req || !req.cookies || !req.cookies["connect.sid"]){
        sessionID = null;
    }
    else{
        sessionID =  req.cookies["connect.sid"].match(':.*[.]')[0].slice(1,-1);
    }
    if (sessionID){
        response = {
            ttl: await dataInterface.getSession(sessionID)
        }
        res.send(response);
    }else{
        res.json({ttl: null, error: "No Session is found."});
    }
})

/* GET ping-ping for health checking. */
router.get('/ping', function (req, res, next) {
    res.send(`pong`);
});

// /* GET version for health checking and version checking. */
router.get('/version', async function (req, res, next) {
    console.log("request version API");
    let body = {
        version: config.version,
        date: config.date
    };
    if (!(await MongoDBHealthCheck(config.mongo_db_connection_string))) {
        console.error("version API failed due to database connection");
        body.error = ERROR.MONGODB_HEALTH_CHECK_FAILED;
        res.status(503);
    }
    res.json(body);
});

module.exports = router;
