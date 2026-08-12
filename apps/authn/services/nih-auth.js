const nodeFetch = require("node-fetch");
const config = require("../config");
const {LOGIN_GOV, NIH} = require("../constants/idp-constants");
const {LOGIN_ERROR} = require("../constants/errors");
const loginGovRegex = new RegExp(/(?:.){1}(@login.gov){1}\b/i);
const nihRegex = new RegExp(/(?:.){1}(@nih.gov){1}\b/i);

const validateResponseOrThrow= (res)=> {
    if (res.status != 200) throw new Error("NIH access token failed to create because of invalid access code or unauthorized access");
}

async function getNIHToken(code, redirectURi) {
    const response = await nodeFetch(config.nih.TOKEN_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
            code: code,
            redirect_uri: redirectURi,
            grant_type: "authorization_code",
            client_id: config.nih.CLIENT_ID,
            client_secret: config.nih.CLIENT_SECRET,
            scope: "openid email profile"
        })
    });
    const jsonResponse = await response.json();
    console.log("jsonResponse", jsonResponse);
    validateResponseOrThrow(response);
    return jsonResponse.access_token;
}

async function nihLogout(tokens) {
    const result = await nodeFetch(config.nih.LOGOUT_URL, {
        method: 'POST',
        headers: {
            'Authorization': 'Basic ' + Buffer.from(config.nih.CLIENT_ID + ':' + config.nih.CLIENT_SECRET).toString('base64')
        },
        body: new URLSearchParams({
            id_token: tokens,
        })
    });
    return result;
}

async function nihUserInfo(accessToken) {
    const result = await nodeFetch(config.nih.USERINFO_URL, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ` + accessToken
        }
    });
    return result.json();
}

/**
 * Resolves the identity provider from a preferred username.
 * @param {string|null|undefined} preferredUsername Identity string from the login service
 * @returns {string} NIH or LOGIN.GOV IDP constant
 * @throws {Error} When the identity is missing or does not match a known IDP format
 */
const getIDP = (preferredUsername) => {
    if (preferredUsername == null) {
        console.error("Preferred username is not specified in the login service response, cannot determine IDP");
        throw new Error(LOGIN_ERROR);
    }
    // NIH Login
    if (isNIHLogin(preferredUsername)) return NIH;
    // LOGIN.GOV Login
    if (isLoginGovLogin(preferredUsername)) return LOGIN_GOV;
    // Empty preferred username defaults to LOGIN.GOV with warning
    if (preferredUsername === '') {
        console.warn("The preferred_username property from the login response is empty, assuming this is a LOGIN.GOV login");
        return LOGIN_GOV;
    }
    console.warn(`The preferred_username property from the login response does not match one of the expected formats: ${preferredUsername}`);
    throw new Error(LOGIN_ERROR);
}

const isNIHLogin = (email)=> {
    return nihRegex.test(email);
}

const isLoginGovLogin = (email)=> {
    return loginGovRegex.test(email);
}

module.exports = {
    getNIHToken,
    nihLogout,
    nihUserInfo,
    getIDP,
    isLoginGovLogin,
    isNIHLogin
};