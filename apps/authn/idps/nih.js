const {getNIHToken, nihUserInfo, nihLogout, getIDP} = require("../services/nih-auth");
const client = {
    login: async (code, redirectingURL) => {
        const token = await getNIHToken(code, redirectingURL);
        const user = await nihUserInfo(token);
        // use a preferred name or email as identity
        const idp = getIDP(user['preferred_username'] ? user['preferred_username'] : user.email);
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