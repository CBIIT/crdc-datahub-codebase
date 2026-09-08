const MongooseGenericDAO = require("./mongoose-generic");
const UserModel = require("../mongoose/models/user");
const {getCurrentTime} = require("../crdc-datahub-database-drivers/utility/time-utility");
const {USER} = require("../crdc-datahub-database-drivers/constants/user-constants");
const USER_PERMISSION_CONSTANTS = require("../crdc-datahub-database-drivers/constants/user-permission-constants");
const SCOPES = require("../constants/permission-scope-constants");

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

    /**
     * Active Submitters (excluding the submission owner) who can collaborate on a study.
     * Matches users whose studies include the study ID or "All" in either format:
     * - Object DocumentArray: `{_id: studyID}` via `studies._id`
     * - Legacy string array: `studies: [studyID]` via `$expr` (avoids Mongoose casting
     *   string IDs as embedded docs when querying the DocumentArray path with `$in`)
     * @param {string} studyID Approved study ID
     * @param {string} submitterID Submission owner user ID to exclude
     * @returns {Promise<object[]>} Matching collaborator user documents
     */
    async getCollaboratorsByStudyID(studyID, submitterID) {
        const studyIDs = [studyID, "All"];
        return await this.findMany({
            _id: {$ne: submitterID},
            role: USER.ROLES.SUBMITTER,
            userStatus: USER.STATUSES.ACTIVE,
            permissions: {$in: [`${USER_PERMISSION_CONSTANTS.DATA_SUBMISSION.CREATE}:${SCOPES.OWN}`]},
            $or: [
                {"studies._id": {$in: studyIDs}},
                {
                    $expr: {
                        $gt: [
                            {
                                $size: {
                                    $filter: {
                                        input: {$ifNull: ["$studies", []]},
                                        as: "s",
                                        cond: {
                                            $and: [
                                                {$eq: [{$type: "$$s"}, "string"]},
                                                {$in: ["$$s", studyIDs]},
                                            ],
                                        },
                                    },
                                },
                            },
                            0,
                        ],
                    },
                },
            ],
        });
    }

    /**
     * Counts Submitter-role users grouped by institution ID.
     * Avoids embedding user documents on institution aggregations (DocumentDB 16MB BSON limit).
     * @param {string[]} institutionIDs Institution IDs to count
     * @returns {Promise<object[]>} Rows with `_id` (institution ID) and `submitterCount`
     */
    async countSubmittersByInstitutionIDs(institutionIDs) {
        if (!institutionIDs || institutionIDs.length === 0) {
            return [];
        }
        return await this.aggregate([
            {
                $match: {
                    role: USER.ROLES.SUBMITTER,
                    "institution._id": { $in: institutionIDs },
                },
            },
            {
                $group: {
                    _id: "$institution._id",
                    submitterCount: { $sum: 1 },
                },
            },
        ]);
    }
}

module.exports = UserDAO;
