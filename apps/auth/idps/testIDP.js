const {TEST} = require("../constants/idp-constants");

module.exports = {
    login: (email) => {
        const tokens = {
            idToken: 'test id token'
        };
        const name = 'Test First';
        const lastName= 'Test Last';
        return {name, lastName, tokens, email, idp: TEST};
    },
    authenticated: (tokens) => {
        return (tokens.idToken === 'test id token');
    }
}