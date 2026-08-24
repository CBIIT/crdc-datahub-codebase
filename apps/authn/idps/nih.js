const {getNIHToken, nihUserInfo, nihLogout, getIDP, describeSafeResponseFields} = require("../services/nih-auth");
const client = {
    /**
     * Completes NIH STS login and resolves NIH vs Login.gov from userinfo.
     * @param {string} code OAuth authorization code
     * @param {string} redirectingURL Redirect URI used in the authorize request
     * @returns {Promise<{name: string, lastName: string, email: string, tokens: string, idp: string}>}
     * @throws {Error} When token/userinfo handling or IDP resolution fails
     */
    login: async (code, redirectingURL) => {
        const token = await getNIHToken(code, redirectingURL);
        const user = await nihUserInfo(token);
        let idp;
        try {
            idp = getIDP(user?.preferred_username);
        } catch (e) {
            console.error(`NIH userinfo returned HTTP 200 but login failed to determine IDP: ${describeSafeResponseFields(user)}`);
            throw e;
        }
        // Leave as blank if no name exits
        return {name: user.first_name ? user.first_name: '', lastName: user.last_name ? user.last_name: '', email: user.email, tokens: token, idp: idp};
    },
    authenticated: async (tokens) => {
        try {
            if (!tokens) {
                console.log('No tokens found!');
                return false
            }
            // If not passing, throw error
            await nihUserInfo(tokens);
            return true;

        } catch (e) {
            console.log(e);
        }
        return false;
    },
    logout: async(tokens) => {
        return await nihLogout(tokens);
    }
}

module.exports = client;