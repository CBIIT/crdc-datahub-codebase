const MongooseGenericDAO = require("./mongoose-generic");
const UserModel = require("../mongoose/models/user");
const {getCurrentTime} = require("../crdc-datahub-database-drivers/utility/time-utility");
const {USER} = require("../crdc-datahub-database-drivers/constants/user-constants");

/**
 * Mongoose-backed DAO for user documents.
 */
class UserDAO extends MongooseGenericDAO {
    constructor() {
        super(UserModel);
    }

    /**
     * Updates embedded organization name on users linked to a program/org.
     * @param {string} orgID Organization / program ID
     * @param {object} updatedOrg Updated organization fields (name, updateAt)
     * @returns {Promise<{count: number}>}
     */
    async updateUserOrg(orgID, updatedOrg) {
        return await this.updateMany(
            {"organization.orgID": orgID, "organization.orgName": {"$ne": updatedOrg.name}},
            {
                "organization.orgName": updatedOrg.name,
                "organization.updateAt": updatedOrg.updateAt,
                updateAt: getCurrentTime()
            }
        );
    }

    /**
     * Finds a user by ID and userStatus.
     * @param {string} id User ID
     * @param {string} userStatus Required userStatus value
     * @returns {Promise<object|null>}
     */
    async findByIdAndStatus(id, userStatus) {
        return await this.findFirst({_id: id, userStatus});
    }

    /**
     * Active users whose notifications array intersects the given values.
     * @param {string[]} notifications Notification type IDs
     * @param {string[]} [roles=[]] Optional role filter
     * @returns {Promise<object[]>}
     */
    async getUsersByNotifications(notifications, roles = []) {
        return await this.findMany({
            userStatus: USER.STATUSES.ACTIVE,
            notifications: {$in: notifications},
            ...(roles.length > 0 && {role: {$in: roles}}),
        });
    }

    /**
     * Fetch multiple users by their IDs in a single database query.
     * @param {string[]} userIDs Array of user IDs to fetch
     * @returns {Promise<object[]>} Array of user objects
     */
    async findManyByIds(userIDs) {
        if (!userIDs || userIDs.length === 0) {
            return [];
        }

        return await this.findMany({
            _id: {$in: userIDs},
        });
    }
}

module.exports = UserDAO;
