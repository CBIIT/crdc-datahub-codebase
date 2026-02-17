const dotenv = require('dotenv')
const {isCaseInsensitiveEqual} = require("./util/string-util");
const {NIH} = require("./constants/idp-constants");
dotenv.config();

const config = {
  version: process.env.VERSION,
  date: process.env.DATE,
  idp: process.env.IDP ? process.env.IDP.toLowerCase() : NIH,
  session_secret: process.env.SESSION_SECRET,
  session_timeout: process.env.SESSION_TIMEOUT ? parseInt(process.env.SESSION_TIMEOUT) * 1000 : 1000 * 30 * 60,  // 30 minutes
  // NIH login settings
  nih: {
    CLIENT_ID: process.env.NIH_CLIENT_ID,
    CLIENT_SECRET: process.env.NIH_CLIENT_SECRET,
    BASE_URL: process.env.NIH_BASE_URL,
    REDIRECT_URL: process.env.NIH_REDIRECT_URL,
    USERINFO_URL: process.env.NIH_USERINFO_URL,
    AUTHORIZE_URL: process.env.NIH_AUTHORIZE_URL,
    TOKEN_URL: process.env.NIH_TOKEN_URL,
    LOGOUT_URL: process.env.NIH_LOGOUT_URL,
    SCOPE: process.env.NIH_SCOPE,
    PROMPT: process.env.NIH_PROMPT
  },
  // Mongo DB Connection
  mongo_db_connection_string: `mongodb://${process.env.MONGO_DB_USER}:${process.env.MONGO_DB_PASSWORD}@${process.env.MONGO_DB_HOST}:${process.env.MONGO_DB_PORT}`,
  // Disable local test page automatically sends /login request, so Postman can use the auth code
  noAutoLogin: process.env.NO_AUTO_LOGIN ? process.env.NO_AUTO_LOGIN.toLowerCase() === "true" : false,

  getIdpOrDefault: (idp) => {
    return (idp) ? idp : config.idp;
  },
  getUrlOrDefault: (idp, url) => {
    if (!url && isCaseInsensitiveEqual(idp,'NIH')) return process.env.NIH_REDIRECT_URL;
    return url;
  }
};

if (!config.version) {
  config.version = 'Version not set'
}

if (!config.date) {
  config.date = new Date();
}

module.exports = config;
