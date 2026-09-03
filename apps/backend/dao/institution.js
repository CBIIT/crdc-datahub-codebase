const {INSTITUTION} = require("../crdc-datahub-database-drivers/constants/organization-constants");
const MongooseGenericDAO = require("./mongoose-generic");
const InstitutionModel = require("../mongoose/models/institution");
const UserDAO = require("./user");
const {MongoPagination} = require("../crdc-datahub-database-drivers/domain/mongo-pagination");
const {sanitizeMongoDBInput, escapeRegexLiteral} = require("../utility/string-util");
const {SORT} = require("../crdc-datahub-database-drivers/constants/mongodb-constants");

/**
 * Mongoose-backed DAO for institution documents.
 */
class InstitutionDAO extends MongooseGenericDAO {
    _NAME = "name";
    _SUBMITTER_COUNT = "submitterCount";
    _ALL_FILTER = "All";

    constructor() {
        super(InstitutionModel);
        this.userDAO = new UserDAO();
    }

    /**
     * Lists institutions with submitter counts and pagination.
     * Uses separate result and count aggregations (DocumentDB does not support $facet).
     * Submitter counts come from a UserDAO $group (avoids $lookup of full user documents).
     * When orderBy is submitterCount, counts are computed for all matches, then sorted and sliced in JS
     * (stored submitterCount is not maintained and must not drive Mongo pagination).
     * @param {string} [name] Institution name filter (case-insensitive substring)
     * @param {number} [offset] Pagination offset
     * @param {number} [first] Page size
     * @param {string} [orderBy] Sort field
     * @param {string} [sortDirection] Sort direction
     * @param {string} [status] Status filter, or "All"
     * @returns {Promise<{institutions: object[], total: number}>}
     */
    async listInstitution(name, offset, first, orderBy, sortDirection, status) {
        const sortingBySubmitterCount = orderBy === this._SUBMITTER_COUNT;
        const paginationPipe = new MongoPagination(
            sortingBySubmitterCount ? -1 : first,
            sortingBySubmitterCount ? 0 : offset,
            sortingBySubmitterCount ? null : orderBy,
            sortDirection,
            orderBy === this._NAME
        );
        const pipeline = [{"$match": this._listConditions(name, status)}];

        const noPaginationPipeline = pipeline.concat(paginationPipe.getNoLimitPipeline());
        const [institutions, totalCountResult] = await Promise.all([
            this.aggregate(pipeline.concat(paginationPipe.getPaginationPipeline())),
            this.aggregate(noPaginationPipeline.concat([{ $group: { _id: "$_id" } }, { $count: "count" }]))
        ]);

        const page = institutions || [];
        const total = totalCountResult?.length > 0 ? totalCountResult[0]?.count : 0;
        if (page.length === 0) {
            return { institutions: page, total };
        }

        const counts = await this.userDAO.countSubmittersByInstitutionIDs(page.map((inst) => inst._id));
        const countByID = new Map((counts || []).map((row) => [row._id, row.submitterCount]));
        const withCounts = page.map((inst) => ({
            ...inst,
            submitterCount: countByID.get(inst._id) || 0,
        }));
        if (!sortingBySubmitterCount) {
            return { institutions: withCounts, total };
        }

        const direction = sortDirection?.toLowerCase() === SORT.ASC ? 1 : -1;
        withCounts.sort((a, b) => (a.submitterCount - b.submitterCount) * direction);
        const start = offset || 0;
        const sliced = Number.isInteger(first) && first === -1
            ? withCounts.slice(start)
            : withCounts.slice(start, start + first);
        return { institutions: sliced, total };
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
            { status: { $in: [status] } } : { status: { $in: validStatus } };
        return {...nameCondition , ...statusCondition}
    }
}

module.exports = InstitutionDAO;
