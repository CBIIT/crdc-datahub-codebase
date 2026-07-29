const {INSTITUTION} = require("../crdc-datahub-database-drivers/constants/organization-constants");
const USER_CONSTANTS = require("../crdc-datahub-database-drivers/constants/user-constants");
const MongooseGenericDAO = require("./mongoose-generic");
const InstitutionModel = require("../mongoose/models/institution");
const {USER_COLLECTION} = require("../crdc-datahub-database-drivers/database-constants");
const {MongoPagination} = require("../crdc-datahub-database-drivers/domain/mongo-pagination");
const {sanitizeMongoDBInput, escapeRegexLiteral} = require("../utility/string-util");

const ROLES = USER_CONSTANTS.USER.ROLES;

/**
 * Mongoose-backed DAO for institution documents.
 */
class InstitutionDAO extends MongooseGenericDAO {
    _NAME = "name";
    _ALL_FILTER = "All";

    constructor() {
        super(InstitutionModel);
    }

    /**
     * Lists institutions with submitter counts and pagination.
     * Uses separate result and count aggregations (DocumentDB does not support $facet).
     * @param {string} [name] Institution name filter (case-insensitive substring)
     * @param {number} [offset] Pagination offset
     * @param {number} [first] Page size
     * @param {string} [orderBy] Sort field
     * @param {string} [sortDirection] Sort direction
     * @param {string} [status] Status filter, or "All"
     * @returns {Promise<{institutions: object[], total: number}>}
     */
    async listInstitution(name, offset, first, orderBy, sortDirection, status) {
        const userJoin = {
            "$lookup": {
                from: USER_COLLECTION,
                let : {id : "$_id"},
                pipeline: [{
                    $match: {
                        $expr: {
                            $and: [
                                { $eq: ["$institution._id", "$$id"] },
                                { $eq: ["$role", ROLES.SUBMITTER] }
                            ]
                        }
                    }
                }],
                as: "submitters"}
        };

        const paginationPipe = new MongoPagination(first, offset, orderBy, sortDirection, orderBy === this._NAME);
        const pipeline = [{"$match": this._listConditions(name, status)}, userJoin,
            {
                $project: {
                    _id: 1,
                    name: 1,
                    status: 1,
                    submitterCount: { $size: "$submitters" }
                }
            }];

        const noPaginationPipeline = pipeline.concat(paginationPipe.getNoLimitPipeline());
        const results = await Promise.all([
            this.aggregate(pipeline.concat(paginationPipe.getPaginationPipeline())),
            this.aggregate(noPaginationPipeline.concat([{ $group: { _id: "$_id" } }, { $count: "count" }]))
        ]);

        return {
            institutions: results[0] || [],
            total: results[1]?.length > 0 ? results[1][0]?.count : 0
        }
    }

    /**
     * Finds the first institution whose name matches case-insensitively.
     * @param {string} name Institution name to match
     * @returns {Promise<object|null>}
     */
    async findByCaseInsensitiveName(name) {
        const trimmed = name?.trim();
        if (!trimmed) {
            return null;
        }
        const institutions = await this.aggregate([
            {
                $match: {
                    $expr: {
                        $eq: [
                            { $toLower: "$name" },
                            trimmed.toLowerCase()
                        ]
                    }
                }
            },
            { $limit: 1 }
        ]);
        return institutions?.length > 0 ? institutions[0] : null;
    }

    /**
     * Builds the Mongo filter for listInstitution from name and status inputs.
     * @param {string} [institutionNameInput] Name filter input
     * @param {string} [status] Status filter, or "All"
     * @returns {object}
     */
    _listConditions(institutionNameInput, status){
        const institutionName = sanitizeMongoDBInput(institutionNameInput);
        const validStatus = [INSTITUTION.STATUSES.INACTIVE, INSTITUTION.STATUSES.ACTIVE];
        const nameCondition = institutionName ? {name: { $regex: escapeRegexLiteral(institutionName.trim()), $options: "i" }} : {};
        const statusCondition = status && status !== this._ALL_FILTER ?
            { status: { $in: [status] || [] } } : { status: { $in: validStatus } };
        return {...nameCondition , ...statusCondition}
    }
}

module.exports = InstitutionDAO;
