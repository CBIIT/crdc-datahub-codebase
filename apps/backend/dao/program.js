const GenericDAO = require("./generic");
const { MODEL_NAME } = require('../constants/db-constants');
const {MongoPagination} = require("../crdc-datahub-database-drivers/domain/mongo-pagination");
const {APPROVED_STUDIES_COLLECTION} = require("../crdc-datahub-database-drivers/database-constants");
const { ERROR } = require("../crdc-datahub-database-drivers/constants/error-constants");


class ProgramDAO extends GenericDAO {
    constructor(organizationCollection) {
        super(MODEL_NAME.PROGRAM);
        this.organizationCollection = organizationCollection;
    }
    /**
     * @param {string} id
     * @param {boolean} includeStudies When true, loads related approved studies via Prisma.
     */
    async getOrganizationByID(id, includeStudies) {
        if (typeof includeStudies !== 'boolean') {
            throw new Error(ERROR.INVALID_INCLUDE_STUDIES_LIST_ARGUMENT);
        }
        if (!includeStudies) {
            return await this.findById(id);
        }
        try {
            const result = await this.model.findUnique({
                where: { id },
                include: { studies: true },
            });
            if (!result) {
                return null;
            }
            const { studies, ...rest } = result;
            return {
                ...rest,
                _id: result.id,
                studies: (studies ?? []).map((s) => ({ ...s, _id: s.id })),
            };
        } catch (error) {
            console.error(`ProgramDAO.getOrganizationByID failed for ${this.model.name}:`, {
                error: error.message,
                id,
                stack: error.stack,
            });
            throw new Error(`Failed to find ${this.model.name} by ID`);
        }
    }

    async getOrganizationByName(name) {
        return await this.findFirst({
            name: name?.trim()
        });
    }

    /**
     * Lists programs with related studies and pagination.
     * Uses separate count and results queries (DocumentDB does not support $facet).
     * @param {number} first Page size
     * @param {number} offset Skip count
     * @param {string} orderBy Sort field
     * @param {string} sortDirection Sort direction
     * @param {object} [statusCondition={}] Mongo filter applied to programs (e.g. status)
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

        const [total, results] = await Promise.all([
            this.organizationCollection.countDoc(statusCondition),
            this.organizationCollection.aggregate(resultsPipeline),
        ]);

        return { total: total || 0, results: results || [] };
    }

}
module.exports = ProgramDAO