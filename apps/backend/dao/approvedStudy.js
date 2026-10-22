const MongooseGenericDAO = require("./mongoose-generic");
const ApprovedStudyModel = require("../mongoose/models/approved-study");
const {ORGANIZATION_COLLECTION, USER_COLLECTION} = require("../crdc-datahub-database-drivers/database-constants");
const ERROR = require("../constants/error-constants");
const {MongoPagination} = require("../crdc-datahub-database-drivers/domain/mongo-pagination");
const {DIRECTION} = require("../crdc-datahub-database-drivers/constants/mongodb-constants");
const {sanitizeMongoDBInput, escapeRegexLiteral} = require("../utility/string-util");

const CONTROLLED_ACCESS_ALL = "All";
const CONTROLLED_ACCESS_OPEN = "Open";
const CONTROLLED_ACCESS_CONTROLLED = "Controlled";
const CONTROLLED_ACCESS_OPTIONS = [CONTROLLED_ACCESS_ALL, CONTROLLED_ACCESS_OPEN, CONTROLLED_ACCESS_CONTROLLED];

class ApprovedStudyDAO extends MongooseGenericDAO {
    _ALL = "All";

    constructor() {
        super(ApprovedStudyModel);
    }

    /**
     * @param {string} studyID
     * @returns {Promise<object|null>}
     */
    async getApprovedStudyByID(studyID) {
        return await this.findById(studyID);
    }

    /**
     * @param {string[]} studyIDs
     * @returns {Promise<object[]>}
     */
    async getApprovedStudiesInStudies(studyIDs) {
        return await this.findMany({
            _id: { $in: studyIDs || [] },
        });
    }

    /**
     * List approved studies matching any of the given study names (case-insensitive exact match).
     * @param {string[]} studyNames
     * @returns {Promise<object[]>} Approved studies with `id` and `_id`
     */
    async findByStudyNames(studyNames) {
        const uniqueNamesByLower = new Map();
        for (const rawName of studyNames ?? []) {
            const name = rawName?.trim();
            if (!name) {
                continue;
            }
            const key = name.toLowerCase();
            if (!uniqueNamesByLower.has(key)) {
                uniqueNamesByLower.set(key, name);
            }
        }
        const uniqueNames = [...uniqueNamesByLower.values()];
        if (!uniqueNames.length) {
            return [];
        }
        return await this.findMany({
            $or: uniqueNames.map((name) => ({
                studyName: {
                    $regex: `^${escapeRegexLiteral(name)}$`,
                    $options: 'i',
                },
            })),
        });
    }

    /**
     * Find an approved study linked to a submission request application ID.
     * @param {string} applicationID
     * @returns {Promise<object|null>}
     */
    async findByApplicationID(applicationID) {
        if (!applicationID) {
            return null;
        }
        return await this.findFirst({ applicationID });
    }

    /**
     * Builds the Mongo filter for listApprovedStudies from API inputs.
     * @param {string|null} studyName
     * @param {string|null} controlledAccess
     * @param {string|null} dbGaPIDInput
     * @param {string|null} programID
     * @param {string[]|null} statuses
     * @returns {object}
     */
    _buildListMatches(studyName, controlledAccess, dbGaPIDInput, programID, statuses) {
        const matches = {};
        const study = sanitizeMongoDBInput(studyName);
        if (study) {
            matches.$or = [
                { studyName: { $regex: escapeRegexLiteral(study), $options: 'i' } },
                { studyAbbreviation: { $regex: escapeRegexLiteral(study), $options: 'i' } },
            ];
        }
        if (controlledAccess) {
            if (!CONTROLLED_ACCESS_OPTIONS.includes(controlledAccess)) {
                throw new Error(ERROR.INVALID_CONTROLLED_ACCESS);
            }
            if (controlledAccess !== CONTROLLED_ACCESS_ALL) {
                if (controlledAccess === CONTROLLED_ACCESS_CONTROLLED) {
                    matches.controlledAccess = true;
                } else {
                    matches.openAccess = true;
                }
            }
        }
        const dbGaPID = sanitizeMongoDBInput(dbGaPIDInput);
        if (dbGaPID) {
            matches.dbGaPID = { $regex: escapeRegexLiteral(dbGaPID), $options: 'i' };
        }
        if (programID && programID !== this._ALL) {
            matches.programID = programID;
        }
        if (Array.isArray(statuses) && statuses.length > 0) {
            matches.status = { $in: statuses };
        }
        return matches;
    }

    /**
     * Lists approved studies with program/contact enrichment and pagination.
     * Uses separate count and results queries (DocumentDB does not support $facet).
     *
     * @returns {Promise<Array<{total: number, results: object[]}>>}
     */
    async listApprovedStudies(studyName, controlledAccess, dbGaPIDInput, programID, statuses, first, offset, orderBy, sortDirection) {
        const matches = this._buildListMatches(studyName, controlledAccess, dbGaPIDInput, programID, statuses);

        let sortField = orderBy;
        const resultsPipeline = [
            { $match: matches },
            {
                $lookup: {
                    from: ORGANIZATION_COLLECTION,
                    localField: "programID",
                    foreignField: "_id",
                    as: "program",
                },
            },
            {
                $lookup: {
                    from: USER_COLLECTION,
                    localField: "primaryContactID",
                    foreignField: "_id",
                    as: "primaryContact",
                },
            },
            {
                $addFields: {
                    program: { $arrayElemAt: ["$program", 0] },
                    primaryContact: { $arrayElemAt: ["$primaryContact", 0] },
                },
            },
            {
                $addFields: {
                    primaryContact: {
                        _id: {
                            $cond: [
                                "$useProgramPC",
                                "$program.conciergeID",
                                "$primaryContact._id",
                            ],
                        },
                        firstName: {
                            $cond: [
                                "$useProgramPC",
                                {
                                    $ifNull: [
                                        {
                                            $arrayElemAt: [
                                                { $split: ["$program.conciergeName", " "] },
                                                0,
                                            ],
                                        },
                                        "",
                                    ],
                                },
                                "$primaryContact.firstName",
                            ],
                        },
                        lastName: {
                            $cond: [
                                "$useProgramPC",
                                {
                                    $ifNull: [
                                        {
                                            $arrayElemAt: [
                                                { $split: ["$program.conciergeName", " "] },
                                                1,
                                            ],
                                        },
                                        "",
                                    ],
                                },
                                "$primaryContact.lastName",
                            ],
                        },
                    },
                },
            },
        ];

        if (sortField === "program.name") {
            resultsPipeline.push({
                $set: {
                    programSort: {
                        $toLower: "$program.name",
                    },
                },
            });
            sortField = "programSort";
        }

        const pagination = new MongoPagination(first, offset, sortField, sortDirection);
        const paginationPipe = pagination.getPaginationPipeline();
        const isNotStudyName = orderBy !== "studyName";
        const customPaginationPipeline = paginationPipe?.map((stage) =>
            Object.keys(stage)?.includes("$sort") && isNotStudyName
                ? { ...stage, $sort: { ...stage.$sort, studyName: DIRECTION.ASC } }
                : stage
        );
        resultsPipeline.push(...customPaginationPipeline);

        const [total, results] = await Promise.all([
            this.count(matches),
            this.aggregate(resultsPipeline),
        ]);

        return [{ total, results }];
    }
}

module.exports = ApprovedStudyDAO;
