const express = require('express');
const router = express.Router();
const idpClient = require('../idps');
const config = require('../config');
const {logout} = require('../controllers/auth-api')
const {DatabaseConnector} = require("../crdc-datahub-database-drivers/database-connector");
const {MongoDBCollection} = require("../crdc-datahub-database-drivers/mongodb-collection");
const {DATABASE_NAME, LOG_COLLECTION, USER_COLLECTION} = require("../crdc-datahub-database-drivers/database-constants");
const {LoginEvent, LogoutEvent} = require("../crdc-datahub-database-drivers/domain/log-events");
const {User} = require("../crdc-datahub-database-drivers/services/user");
const {ERROR} = require("../crdc-datahub-database-drivers/constants/error-constants");
const dbConnector = new DatabaseConnector(config.mongo_db_connection_string);
let logCollection;
let userService;
dbConnector.connect().then(() => {
    logCollection = new MongoDBCollection(dbConnector.client, DATABASE_NAME, LOG_COLLECTION);
    const userCollection = new MongoDBCollection(dbConnector.client, DATABASE_NAME, USER_COLLECTION);
    userService = new User(userCollection, logCollection);
});

/* Login */
router.post('/login', async function (req, res) {
    try {
        console.log("request login API");
        const reqIDP = config.getIdpOrDefault(req.body['IDP']);
        const { name, lastName, tokens, email, idp } = await idpClient.login(req.body['code'], reqIDP, config.getUrlOrDefault(reqIDP, req.body['redirectUri']));
        console.log(`email:${email} IDP:${idp} is logging in`);
        if (!await userService.isEmailAndIDPLoginPermitted(email, idp)) {
            throw { statusCode: 403, message: ERROR.INACTIVE_USER };
        }
        req.session.userInfo = {
            email: email,
            IDP: idp,
            firstName: name,
            lastName: lastName
        };
        req.session.tokens = tokens;
        res.json({name, email, "timeout": config.session_timeout / 1000});
        await logCollection.insert(LoginEvent.create(email, idp));
        console.log(`email:${email} IDP:${idp} logged in successfully`);
    } catch (e) {
        console.error(e);
        if (e.code && parseInt(e.code)) {
            res.status(e.code);
        } else if (e.statusCode && parseInt(e.statusCode)) {
            res.status(e.statusCode);
        } else {
            res.status(500);
        }
        res.json({error: e.message});
    }
});

/* Logout */
router.post('/logout', async function (req, res, next) {
    try {
        console.log("request logout API");
        const idp = config.getIdpOrDefault(req.body['IDP']);
        const userInfo = req?.session?.userInfo;
        if (userInfo?.email && userInfo?.IDP) await logCollection.insert(LogoutEvent.create(userInfo.email, userInfo.IDP));
        console.log(`email:${userInfo?.email} IDP:${userInfo?.IDP} is logging out`);
        await idpClient.logout(idp, req.session.tokens);
        console.log(`email:${userInfo?.email} IDP:${userInfo?.IDP} logged out successfully`);
        return logout(req, res);
    } catch (e) {
        console.error(e);
        res.status(500).json({errors: e});
    }
});

/* Authenticated */
// Return {status: true} or {status: false}
// Calling this API will refresh the session
router.post('/authenticated', async function (req, res, next) {
    try {
        console.log("request authenticated API");
        if (req.session.tokens) {
            console.log("authenticated API - success");
            return res.status(200).send({status: true});
        } else {
            console.log("authenticated API - failed");
            return res.status(200).send({status: false});
        }
    } catch (e) {
        console.error(e);
        res.status(500).json({errors: e});
    }
});


module.exports = router;
