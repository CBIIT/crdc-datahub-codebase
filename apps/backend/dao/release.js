const MongooseGenericDAO = require("./mongoose-generic");
const ReleaseModel = require("../mongoose/models/release");
const {MongoPagination} = require("../crdc-datahub-database-drivers/domain/mongo-pagination");
const {APPROVED_STUDIES_COLLECTION, DATA_COMMONS_COLLECTION} = require("../crdc-datahub-database-drivers/database-constants");
const {SORT, DIRECTION} = require("../crdc-datahub-database-drivers/constants/mongodb-constants");

const DATA_COMMONS_DISPLAY_NAMES = "dataCommonsDisplayNames";
const STUDY_NODE = "study";

/**
 * Data access for the release collection via Mongoose.
 */
class ReleaseDAO extends MongooseGenericDAO {
    constructor() {
        super(ReleaseModel);
    }

    /**
     * Lists released studies with dataCommons enrichment and pagination.
     * Uses separate count and results aggregations (DocumentDB does not support $facet).
     * Equality $lookup only (DocumentDB does not support correlated $lookup).
     * Display-name array order is applied in the service ($group $push order is not relied on).
     * When ordering by display names, the sort key is a concat of $toLower names after $sortArray in $project
     * (DocumentDB allows $sortArray only in $project).
     * @param {object} listConditions $match filter after study enrichment
     * @param {number} [first] Page size
     * @param {number} [offset] Pagination offset
     * @param {string} [orderBy] Sort field
     * @param {string} [sortDirection] Sort direction
     * @returns {Promise<{studies: object[], total: number}>}
     */
    async listReleasedStudies(listConditions, first, offset, orderBy, sortDirection) {
        const paginationOrderBy = orderBy === DATA_COMMONS_DISPLAY_NAMES ? null : orderBy;
        const paginationPipe = new MongoPagination(first, offset, paginationOrderBy, sortDirection);
        const basePipeline = this._listReleasedStudiesBasePipeline(listConditions);
        const pagePipeline = [
            ...basePipeline,
            ...(orderBy === DATA_COMMONS_DISPLAY_NAMES
                ? [
                    {
                        $project: {
                            doc: "$$ROOT",
                            sortedLowerNames: {
                                $sortArray: {
                                    input: {
                                        $map: {
                                            input: { $ifNull: ["$dataCommonsDisplayNames", []] },
                                            as: "n",
                                            in: { $toLower: { $ifNull: ["$$n", ""] } },
                                        },
                                    },
                                    sortBy: 1,
                                },
                            },
                        },
                    },
                    {
                        $replaceRoot: {
                            newRoot: {
                                $mergeObjects: [
                                    "$doc",
                                    {
                                        dataCommonsDisplayNamesSort: {
                                            $reduce: {
                                                input: "$sortedLowerNames",
                                                initialValue: "",
                                                in: { $concat: ["$$value", "$$this"] },
                                            },
                                        },
                                    },
                                ],
                            },
                        },
                    },
                    {
                        $sort: {
                            dataCommonsDisplayNamesSort: sortDirection?.toLowerCase() === SORT.DESC ? DIRECTION.DESC : DIRECTION.ASC
                        }
                    },
                ]
                : []),
            ...paginationPipe.getPaginationPipeline(),
        ];
        const [studies, totalCountResult] = await Promise.all([
            this.aggregate(pagePipeline),
            this.aggregate([
                ...basePipeline,
                { $count: "count" },
            ]),
        ]);
        return {
            studies: studies || [],
            total: totalCountResult[0]?.count || 0,
        };
    }

    /**
     * Distinct dataCommons values for released study nodes, with an optional extra filter.
     * @param {object} [filter] Additional Mongo filter (e.g. user-scope conditions)
     * @returns {Promise<string[]>}
     */
    async listReleasedStudyDataCommons(filter) {
        return this.distinct("dataCommons", {
            nodeType: STUDY_NODE,
            studyID: {$exists: true},
            ...filter,
        });
    }

    /**
     * Shared stages for listReleasedStudies count and page aggregations.
     * Omits display-name $sort / concat; those apply only to the page pipeline when ordering by display names.
     * @param {object} listConditions $match filter after study enrichment
     * @returns {object[]}
     */
    _listReleasedStudiesBasePipeline(listConditions) {
        return [
            {$match: {nodeType: STUDY_NODE, studyID: {$exists: true}}},
            {$group:{
                _id: "$studyID",
                dataCommons: { $addToSet: "$dataCommons" }
            }},
            {$unwind: { path: "$dataCommons" }},
            {$lookup: {
                from: DATA_COMMONS_COLLECTION,
                localField: "dataCommons",
                foreignField: "dataCommons",
                as: "matched"
            }},
            {$addFields: {
                mappedDisplayName: {
                    $cond: [
                        { $gt: [{ $size: "$matched" }, 0] },
                        { $arrayElemAt: ["$matched.dataCommonsDisplayName", 0] },
                        "$dataCommons"
                    ]
                }
            }},
            {$group: {
                    _id: "$_id",
                    dataCommons: { $push: "$dataCommons" },
                    dataCommonsDisplayNames: { $push: "$mappedDisplayName" },
                    doc: { $first: "$$ROOT" }
            }},
            {$lookup: {
                from: APPROVED_STUDIES_COLLECTION,
                localField: "_id",
                foreignField: "_id",
                as: "approvedStudies"}},
            {$unwind: {
                path: "$approvedStudies"
            }},
            {$replaceRoot: {
                newRoot: {
                    $mergeObjects: [
                        "$$ROOT",
                        {dbGaPID: "$approvedStudies.dbGaPID", studyName: "$approvedStudies.studyName", studyAbbreviation: "$approvedStudies.studyAbbreviation",  studyID: "$approvedStudies._id"}
            ]}}},
            {"$match": listConditions},
        ];
    }
}

module.exports = ReleaseDAO;
