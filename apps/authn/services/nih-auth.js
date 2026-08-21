const nodeFetch = require("node-fetch");
const config = require("../config");
const {LOGIN_GOV, NIH} = require("../constants/idp-constants");
const {LOGIN_ERROR} = require("../constants/errors");
const loginGovRegex = new RegExp(/(?:.){1}(@login.gov){1}\b/i);
const nihRegex = new RegExp(/(?:.){1}(@nih.gov){1}\b/i);

const TOKEN_LIKE_FIELDS = ["access_token", "refresh_token", "id_token"];
const OPTIONAL_TOKEN_FIELDS = ["refresh_token", "id_token"];

/**
 * True when value is a non-empty string after trimming.
 * @param {*} value
 * @returns {boolean}
 */
const _isNonEmptyString = (value) => typeof value === "string" && value.trim().length > 0;

/**
 * Logs a 200 response body with token-like field values omitted.
 * @param {string} message Log prefix (include trailing punctuation and space)
 * @param {object|string} body Parsed JSON or raw text
 * @param {string} endpointName token or userinfo
 */
const _logSanitizedSuccessBody = (message, body, endpointName) => {
    if (body === null || typeof body !== "object" || Array.isArray(body)) {
        console.error(`${message}${body}`);
        return;
    }
    const logged = { ...body };
    const omitted = [];
    for (const field of TOKEN_LIKE_FIELDS) {
        if (logged[field] != null) {
            omitted.push(field);
            delete logged[field];
        }
    }
    console.error(`${message}${JSON.stringify(logged)}`);
    if (omitted.length > 0) {
        console.error(`The following fields were present in the ${endpointName} response but omitted from this log: ${omitted.join(", ")}`);
    }
};

/**
 * Logs optional token fields that are present but not usable, without logging their values.
 * @param {object} jsonResponse Parsed token endpoint JSON
 */
const _logInvalidOptionalTokenFields = (jsonResponse) => {
    const invalid = OPTIONAL_TOKEN_FIELDS.filter((field) => jsonResponse[field] != null && !_isNonEmptyString(jsonResponse[field]));
    if (invalid.length > 0) {
        console.error(`The following optional token fields were present but invalid: ${invalid.join(", ")}`);
    }
};

/**
 * Parses a NIH STS JSON response. Logs the body when HTTP 200 cannot be parsed as JSON.
 * @param {import("node-fetch").Response} response Fetch response
 * @param {string} endpointName token or userinfo
 * @returns {Promise<object>} Parsed JSON body
 * @throws {Error} LOGIN_ERROR when status is not 200 or HTTP 200 body is not JSON
 */
const _parseSuccessJsonOrThrow = async (response, endpointName) => {
    const raw = await response.text();
    if (response.status !== 200) {
        console.error(`${endpointName} returned HTTP ${response.status}`);
        throw new Error(LOGIN_ERROR);
    }
    let json;
    try {
        json = JSON.parse(raw);
    } catch (e) {
        _logSanitizedSuccessBody(`An error occurred while parsing the ${endpointName} response: `, raw, endpointName);
        throw new Error(LOGIN_ERROR);
    }
    return json;
};

/**
 * Exchanges an authorization code for an NIH STS access token.
 * @param {string} code OAuth authorization code
 * @param {string} redirectURi Redirect URI used in the authorize request
 * @returns {Promise<string>} Access token
 * @throws {Error} LOGIN_ERROR when status is not 200 or access_token is missing or not a non-empty string
 */
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
    const jsonResponse = await _parseSuccessJsonOrThrow(response, "token");
    if (!_isNonEmptyString(jsonResponse?.access_token)) {
        _logSanitizedSuccessBody("The token response could not be used: ", jsonResponse, "token");
        throw new Error(LOGIN_ERROR);
    }
    _logInvalidOptionalTokenFields(jsonResponse);
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

/**
 * Fetches NIH STS userinfo for an access token.
 * @param {string} accessToken Bearer access token
 * @returns {Promise<object>} Userinfo JSON
 * @throws {Error} LOGIN_ERROR when status is not 200 or HTTP 200 is not JSON
 */
async function nihUserInfo(accessToken) {
    const result = await nodeFetch(config.nih.USERINFO_URL, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ` + accessToken
        }
    });
    return _parseSuccessJsonOrThrow(result, "userinfo");
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
