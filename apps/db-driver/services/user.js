const {USER} = require("../constants/user-constants");

class User {
    constructor(userCollection) {
        this.userCollection = userCollection;
    }

    /**
     * Check if login with an email and identity provider (IDP) is permitted.
     *
     * @param {string} email - The email address.
     * @param {string} idp - The identity provider.
     * @returns {boolean} True if login is permitted, false otherwise.
     * @throws {Error} Throws an error if there is an unexpected database issue.
     */
    async isEmailAndIDPLoginPermitted(email, idp) {
        const result = await this.userCollection.aggregate([
            {
                "$match": {
                    email: email,
                    IDP: idp,
                    userStatus:{
                        $ne: USER.STATUSES.ACTIVE
                    }
                }
            },
            {"$limit": 1} // return one
        ]);
        if (!result || !Array.isArray(result)){
            throw new Error("An database error occurred while querying login permission");
        }
        return result?.length === 0;
    }
}

module.exports = {
    User
}
