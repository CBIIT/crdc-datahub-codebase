const nodeFetch = require("node-fetch");
const config = require("../config");
const {LOGIN_GOV, NIH} = require("../constants/idp-constants");
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

const getIDP = (email) => {
    // LOGIN.GOV Login
    if (isLoginGovLogin(email)) return LOGIN_GOV;
    // NIH Login
    if (isNIHLogin(email)) return NIH;

    throw new Error("Invalid IDP Exception");
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