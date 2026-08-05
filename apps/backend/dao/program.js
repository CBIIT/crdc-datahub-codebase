const MongooseGenericDAO = require("./mongoose-generic");
const ProgramModel = require("../mongoose/models/program");
const {MongoPagination} = require("../crdc-datahub-database-drivers/domain/mongo-pagination");
const {APPROVED_STUDIES_COLLECTION} = require("../crdc-datahub-database-drivers/database-constants");
const { ERROR } = require("../crdc-datahub-database-drivers/constants/error-constants");
const {escapeRegexLiteral} = require("../utility/string-util");

/**
 * Mongoose-backed DAO for program documents (Mongo collection `organization`).
 */
class ProgramDAO extends MongooseGenericDAO {
    constructor() {
        super(ProgramModel);
    }

    /**
     * @param {string} id Program UUID
     * @param {boolean} includeStudies When true, loads related approved studies via $lookup.
     * @returns {Promise<object|null>}
     */
    async getProgramByID(id, includeStudies) {
        if (typeof includeStudies !== 'boolean') {
            throw new Error(ERROR.INVALID_INCLUDE_STUDIES_LIST_ARGUMENT);
        }
        if (!includeStudies) {
            return await this.findById(id);
        }
        const results = await this.aggregate([
            { $match: { _id: id } },
            {
                $lookup: {
                    from: APPROVED_STUDIES_COLLECTION,
                    localField: "_id",
                    foreignField: "programID",
                    as: "studies",
                },
            },
        ]);
        return results?.[0] || null;
    }

    /**
     * Exact name match after trim (case-sensitive), matching prior Prisma findFirst behavior.
     * Returns null without querying when name is null, undefined, or whitespace-only.
     * @param {string} name
     * @returns {Promise<object|null>}
     */
    async getProgramByName(name) {
        const trimmed = name?.trim();
        if (!trimmed) {
            return null;
        }
        return await this.findFirst({ name: trimmed });
    }

    /**
     * Case-insensitive exact name match.
     * @param {string} programName
     * @returns {Promise<object|null>}
     */
    async findOneByProgramName(programName) {
        const trimmed = programName?.trim();
        if (!trimmed) {
            return null;
        }
        return await this.findFirst({
            name: {
                $regex: `^${escapeRegexLiteral(trimmed)}$`,
                $options: 'i',
            },
        });
    }

    /**
     * Upsert a program document by exact name.
     * @param {string} name
     * @param {object} doc Fields to set on insert/update
     * @returns {Promise<object|null>}
     */
    async upsertByName(name, doc) {
        try {
            const result = await this.model.findOneAndUpdate(
                { name },
                { $set: doc },
                { upsert: true, new: true, lean: true, setDefaultsOnInsert: true }
            );
            return this._mapDoc(result);
        } catch (error) {
            console.error(`ProgramDAO.upsertByName failed for ${this._modelName}:`, {
                error: error.message,
                name,
                stack: error.stack,
            });
            throw new Error(`Failed to upsert ${this._modelName}`);
        }
    }

    /**
     * Lists programs with related studies and pagination.
     * Uses separate count and results queries (DocumentDB does not support $facet).
     * @param {number} first Page size
     * @param {number} offset Skip count
     * @param {string} orderBy Sort field
     * @param {string} sortDirection Sort direction
     * @param {object} [statusCondition={}] Mongo filter on program fields only (e.g. status); must not reference studies
     * @returns {Promise<{total: number, results: object[]}>}
     */
    async listPrograms(first, offset, orderBy, sortDirection, statusCondition = {}) {
        const pagination = new MongoPagination(first, offset, orderBy, sortDirection);
        const paginationPipeline = pagination.getPaginationPipeline();
        const resultsPipeline = [
            {
                $lookup: {
                    from: APPROVED_STUDIES_COLLECTION,
                    localField: "_id",
                    foreignField: "programID",
                    as: "studies"
                }
            },
            { $match: statusCondition },
            ...paginationPipeline,
        ];

        // Count uses the program collection filter only; results $lookup studies then $match.
        // Safe while statusCondition is program-field-only. If filters ever include study fields,
        // count must use the same pre-pagination pipeline as results.
        const [total, results] = await Promise.all([
            this.count(statusCondition),
            this.aggregate(resultsPipeline),
        ]);

        return { total: total || 0, results: results || [] };
    }
}

module.exports = ProgramDAO;
