const nihClient = require('./nih');
const testIDP = require('./testIDP');
const {isCaseInsensitiveEqual} = require("../util/string-util");
const {NIH, LOGIN_GOV, TEST} = require("../constants/idp-constants");

const oauth2Client = {
    login: async (code, idp, redirectingURL) => {
        if (isCaseInsensitiveEqual(idp,NIH) || isCaseInsensitiveEqual(idp, LOGIN_GOV)) {
            return nihClient.login(code, redirectingURL);
        }
        else if (isCaseInsensitiveEqual(idp,TEST) && process.env.NODE_ENV === 'development') {
            return testIDP.login(code);
        }
    },
    authenticated: async (userSession, tokens, fileAcl) => {
        // Check Valid Token
        if (isCaseInsensitiveEqual(userSession.idp,NIH)) {
            return await nihClient.authenticated(tokens);
        }
        return false;
    },
    logout: async(idp, tokens) => {
        if (isCaseInsensitiveEqual(idp,NIH) || isCaseInsensitiveEqual(idp,LOGIN_GOV)) {
            return nihClient.logout(tokens);
        }
    }
}

module.exports = oauth2Client;