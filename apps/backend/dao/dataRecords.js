const MongooseGenericDAO = require("./mongoose-generic");
const DataRecordModel = require("../mongoose/models/data-record");
const {VALIDATION_STATUS} = require("../constants/submission-constants");
const {getSortDirection} = require("../crdc-datahub-database-drivers/utility/mongodb-utility");
const {BATCH} = require("../crdc-datahub-database-drivers/constants/batch-constants");

const NODE_VIEW = {
    submissionID: "$submissionID",
    nodeType: "$nodeType",
    nodeID: "$nodeID",
    IDPropName: "$IDPropName",
    status:  "$status",
    createdAt: "$createdAt",
    updatedAt: "$updatedAt",
    validatedAt: "$validatedAt",
    uploadedDate: "$updatedAt",
    validatedDate: "$validatedAt",
    orginalFileName:  "$orginalFileName",
    lineNumber: "$lineNumber",
    props: "$props",
    parents: "$parents"
}

const ERROR = "Error";
const WARNING = "Warning";

/**
 * @param {object|null|undefined} query
 * @returns {boolean}
 */
function isPlainDataViewMatchQuery(query) {
    return Boolean(query) && typeof query === 'object' && !Array.isArray(query);
}

/**
 * Mongoose-backed DAO for dataRecords.
 * Custom aggregations use split count + results pipelines (DocumentDB does not support $facet).
 */
class DataRecordDAO extends MongooseGenericDAO {
    constructor() {
        super(DataRecordModel);
    }

    /**
     * Paginated Data View nodes for a submission/node type.
     * Uses split count + results pipelines (DocumentDB does not support $facet).
     * Supports sorting by nested JSON paths (props.* / rawData.*) that Prisma could not express.
     * @param {string} submissionID
     * @param {string} nodeType
     * @param {number} first Page size; -1 returns all rows and ignores offset
     * @param {number} offset
     * @param {string} orderBy
     * @param {string} sortDirection
     * @param {object|null} [query=null] Optional $match override
     * @returns {Promise<{total: number, results: object[]}>}
     */
    async getSubmissionNodes(submissionID, nodeType, first, offset, orderBy, sortDirection, query=null) {
        // Determine if rawData is needed for sorting
        // rawData is only needed when sorting by a nested field path (orderBy contains ".")
        const isOrderByInNodeView = Object.keys(NODE_VIEW).includes(orderBy);
        const needsRawDataForSorting = !isOrderByInNodeView && orderBy.includes(".");
        
        // set orderBy
        let sort = orderBy;
        if (!isOrderByInNodeView) {
            sort = orderBy.includes(".") ? `rawData.${orderBy.replaceAll(".", "|")}` : `props.${orderBy}`
        }
        
        // Base pipeline with match stage
        let basePipeline = [];
        basePipeline.push({
            $match: (!query)?{
                submissionID: submissionID,
                nodeType: nodeType
            }:query
        });

        // Create count pipeline - never needs rawData or projection (count doesn't need field data)
        let countPipeline = [...basePipeline];
        countPipeline.push({
            $count: "total"
        });

        // Create results pipeline with conditional projection, sorting and pagination
        let resultsPipeline = [...basePipeline];
        const resultsProjection = { ...NODE_VIEW };
        if (needsRawDataForSorting) {
            resultsProjection.rawData = "$rawData";
        }
        resultsPipeline.push({
            $project: resultsProjection
        });
        const nodeID= "nodeID";
        let sortFields = {
            [sort]: getSortDirection(sortDirection),
        };
        if (sort !== nodeID){
            sortFields[nodeID] = 1
        }
        resultsPipeline.push({
            $sort: sortFields
        });
        // if -1, returns all data of given node & ignore offset
        if (first !== -1) {
            resultsPipeline.push({
                $skip: offset
            });
            resultsPipeline.push({
                $limit: first
            });
        }

        // Execute both queries in parallel
        const [countPipelineResult, resultsPipelineResult] = await Promise.all([
            this.aggregate(countPipeline),
            this.aggregate(resultsPipeline)
        ]);

        const totalRecords = countPipelineResult[0]?.total || 0;
        const dataRecords = resultsPipelineResult || [];

        return {
            total: totalRecords,
            results: dataRecords
        };
    }

    /**
     * Distinct Data View relationship column names (`parentType.parentIDPropName`) for all
     * dataRecords matching `query` (same $match as getSubmissionNodes, no pagination).
     * listSubmissionNodes invokes this only when the current page can omit rows (see submission.js).
     * Used so `properties` includes parent types that only appear on other pages.
     * Cost (when used): one aggregate per list call that spans multiple pages; O(documents matching query). Prefer an index on
     * (submissionID, nodeType) and include status in the index if that filter is common.
     * @param {Object} query Mongo $match object (submissionID, nodeType, status, nodeID, …) — not an array
     * @returns {Promise<string[]>}
     */
    async getDistinctParentRelationshipKeys(query) {
        if (!isPlainDataViewMatchQuery(query)) {
            return [];
        }
        const pipeline = [
            { $match: query },
            { $project: { parents: 1 } },
            { $unwind: { path: '$parents', preserveNullAndEmptyArrays: false } },
            {
                $match: {
                    'parents.parentType': { $type: 'string', $ne: '' },
                    'parents.parentIDPropName': { $type: 'string', $ne: '' }
                }
            },
            {
                $group: {
                    _id: null,
                    keys: {
                        $addToSet: {
                            $concat: ['$parents.parentType', '.', '$parents.parentIDPropName']
                        }
                    }
                }
            }
        ];
        const rows = await this.aggregate(pipeline);
        return (rows && rows[0] && rows[0].keys) || [];
    }

    /**
     * Distinct top-level `props` field names for all dataRecords matching `query` (same
     * $match as getSubmissionNodes, no pagination). listSubmissionNodes invokes this only when
     * the current page can omit rows (see submission.js). Ensures `properties` lists column names
     * for `props` keys that appear only on other pages of a paginated Data View.
     * @param {Object} query Mongo $match (plain object, not an array)
     * @returns {Promise<string[]>}
     */
    async getDistinctPropsTopLevelKeys(query) {
        if (!isPlainDataViewMatchQuery(query)) {
            return [];
        }
        const pipeline = [
            { $match: query },
            {
                $project: {
                    propKeys: {
                        $map: {
                            input: { $objectToArray: { $ifNull: ['$props', {}] } },
                            as: 'p',
                            in: '$$p.k',
                        },
                    },
                },
            },
            { $unwind: { path: '$propKeys', preserveNullAndEmptyArrays: false } },
            { $match: { propKeys: { $type: 'string', $ne: '' } } },
            {
                $group: {
                    _id: null,
                    keys: { $addToSet: '$propKeys' },
                },
            },
        ];
        const rows = await this.aggregate(pipeline);
        return (rows && rows[0] && rows[0].keys) || [];
    }

    /**
     * Per-node-type validation status counts for a submission.
     * @param {string} submissionID
     * @param {string[]} validNodeStatus Status values to include
     * @returns {Promise<{submissionID: string, stats: object[]}[]>}
     */
    async getStats(submissionID, validNodeStatus) {
        // Project group keys out of `_id` so MongooseGenericDAO._mapDoc does not stringify the compound key.
        const rows = await this.aggregate([
            {
                $match: {
                    submissionID,
                    status: { $in: validNodeStatus },
                },
            },
            {
                $group: {
                    _id: {
                        submissionID: '$submissionID',
                        nodeType: '$nodeType',
                        status: '$status',
                    },
                    count: { $sum: 1 },
                },
            },
            {
                $project: {
                    _id: 0,
                    submissionID: '$_id.submissionID',
                    nodeType: '$_id.nodeType',
                    status: '$_id.status',
                    count: 1,
                },
            },
        ]);

        const bySubmission = {};

        rows.forEach((r) => {
            if (!bySubmission[r.submissionID]) bySubmission[r.submissionID] = [];
            const stats = bySubmission[r.submissionID];

            let node = stats.find((n) => n.nodeName === r.nodeType);
            if (!node) {
                node = { nodeName: r.nodeType, new: 0, passed: 0, warning: 0, error: 0, total: 0 };
                stats.push(node);
            }

            const c = r.count || 0;
            if (r.status === VALIDATION_STATUS.NEW) node.new += c;
            else if (r.status === VALIDATION_STATUS.PASSED) node.passed += c;
            else if (r.status === VALIDATION_STATUS.WARNING) node.warning += c;
            else if (r.status === VALIDATION_STATUS.ERROR) node.error += c;

            node.total = node.new + node.passed + node.warning + node.error;
        });

        return Object.entries(bySubmission).map(([id, stats]) => ({ submissionID: id, stats }));
    }

    /**
     * Cross-submission validation errors from additionalErrors, paginated.
     * Uses split count + page pipelines (DocumentDB does not support $facet).
     * @param {string} submissionID
     * @param {string[]} nodeTypes
     * @param {string[]} batchIDs
     * @param {string} severities
     * @param {number} first
     * @param {number} offset
     * @param {string} orderBy
     * @param {string} sortDirection
     * @param {string|null} [dataCommons=null]
     * @returns {Promise<{results: object[], total: number}>}
     */
    async submissionCrossValidationResults(submissionID, nodeTypes, batchIDs, severities, first, offset, orderBy, sortDirection, dataCommons = null){
        let dataRecordQCResultsPipeline = [];
        // Filter by submission ID
        dataRecordQCResultsPipeline.push({
            $match: {
                submissionID: submissionID
            }
        });

        // Filter by dataCommons scope for cross validation - ticket CRDCDH-3247
        if (dataCommons) {
            dataRecordQCResultsPipeline.push({
                $match: {
                    dataCommons: dataCommons
                }
            });
        }

        // Filter by Batch IDs
        if (!!batchIDs && batchIDs.length > 0) {
            dataRecordQCResultsPipeline.push({
                $match: {
                    $expr: {
                        $gt: [
                            {
                                $size: {
                                    $setIntersection: ["$batchIDs", batchIDs]
                                }
                            },
                            0
                        ]
                    }
                }
            });
        }
        // Collect all validation results
        dataRecordQCResultsPipeline.push({
            $set: {
                results: {
                    validation_type: BATCH.TYPE.METADATA,
                    type: "$nodeType",
                    submittedID: "$nodeID",
                    additionalErrors: "$additionalErrors"
                }
            }
        })
        // Unwind validation results into individual documents
        dataRecordQCResultsPipeline.push({
            $unwind: "$results"
        })
        // Filter out empty validation results
        dataRecordQCResultsPipeline.push({
            $match: {
                additionalErrors: {
                    $exists: true,
                    $not: {
                        $size: 0,
                    },
                    $type: "array"
                }
            }
        });
        // Unwind additional errors and conflicting submissions
        dataRecordQCResultsPipeline.push({
            $unwind: {
                path: "$additionalErrors"
            }
        });
        dataRecordQCResultsPipeline.push({
            $unwind: {
                path: "$additionalErrors.conflictingSubmissions"
            }
        });
        // Group errors by conflicting submission
        dataRecordQCResultsPipeline.push({
            $group: {
                _id: {
                    submissionID: "$submissionID",
                    type: "$results.type",
                    validationType: "$results.validation_type",
                    batchID: "$latestBatchID",
                    displayID: "$latestBatchDisplayID",
                    submittedID: "$results.submittedID",
                    uploadedDate: "$updatedAt",
                    validatedDate: "$validatedAt",
                    warnings: [],
                    severity: VALIDATION_STATUS.ERROR,
                    conflictingSubmission: "$additionalErrors.conflictingSubmissions"
                },
                errors: {
                    $addToSet: "$additionalErrors"
                }
            }
        });
        // Reformatting
        dataRecordQCResultsPipeline.push({
            $set:{
                "_id.errors": "$errors"
            }
        });
        dataRecordQCResultsPipeline.push({
            $replaceRoot: {
                newRoot: "$_id"
            }
        });
        // Filter by node types
        if (!!nodeTypes && nodeTypes.length > 0) {
            dataRecordQCResultsPipeline.push({
                $match: {
                    type: {
                        $in: nodeTypes
                    }
                }
            });
        }
        if (severities === ERROR){
            severities = [ERROR];
        }
        else if (severities === WARNING){
            severities = [WARNING];
        }
        else {
            severities = [ERROR, WARNING];
        }
        dataRecordQCResultsPipeline.push({
            $match: {
                severity: {
                    $in: severities
                }
            }
        })
        // Create count pipeline
        let countPipeline = [...dataRecordQCResultsPipeline];
        countPipeline.push({
            $count: "total"
        });
        const countPipelineResult = await this.aggregate(countPipeline);
        const totalRecords = countPipelineResult[0]?.total;

        // Create page and sort steps
        let pagedPipeline = [...dataRecordQCResultsPipeline];
        const nodeType = "type";
        let sortFields = {
            [orderBy]: getSortDirection(sortDirection),
        };
        if (orderBy !== nodeType){
            sortFields[nodeType] = 1
        }
        pagedPipeline.push({
            $sort: sortFields
        });
        pagedPipeline.push({
            $skip: offset
        });
        if (first > 0){
            pagedPipeline.push({
                $limit: first
            });
        }
        // Query page of results
        const pagedPipelineResult = await this.aggregate(pagedPipeline);
        const dataRecords = this._replaceNaN(pagedPipelineResult, null);
        return {
            results: dataRecords || [],
            total: totalRecords || 0
        }
    }

    /**
     * Update many documents with an aggregation pipeline update (not $set-wrapped).
     * Returns the native Mongoose UpdateResult (acknowledged, modifiedCount, matchedCount).
     * @param {object} filter Mongo filter
     * @param {object[]} updatePipeline Aggregation update pipeline stages
     * @returns {Promise<object>}
     */
    async updateManyPipeline(filter, updatePipeline) {
        const condition = this._requireFilter(filter, 'updateManyPipeline');
        try {
            return await this.model.updateMany(condition, updatePipeline);
        } catch (error) {
            console.error(`DataRecordDAO.updateManyPipeline failed:`, {
                error: error.message,
                filter: JSON.stringify(filter),
                stack: error.stack
            });
            throw new Error(`Failed to update many ${this._modelName}`);
        }
    }

    /**
     * Delete many documents and return the native Mongoose delete result
     * (acknowledged, deletedCount) expected by archive/delete callers.
     * @param {object} filter Mongo filter
     * @returns {Promise<object>}
     */
    async deleteManyWithResult(filter) {
        const condition = this._requireFilter(filter, 'deleteManyWithResult');
        try {
            return await this.model.deleteMany(condition);
        } catch (error) {
            console.error(`DataRecordDAO.deleteManyWithResult failed:`, {
                error: error.message,
                filter: JSON.stringify(filter),
                stack: error.stack
            });
            throw new Error(`Failed to delete many ${this._modelName}`);
        }
    }

    /**
     * Replace NaN numeric values in aggregate result objects.
     * @param {object[]|*} results
     * @param {*} replacement
     * @returns {object[]|*}
     */
    _replaceNaN(results, replacement){
        if (!Array.isArray(results)) return results;
        results?.map((result) => {
            Object.keys(result).forEach((key) => {
                if (Object.is(result[key], Number.NaN)){
                    result[key] = replacement;
                }
            })
        });
        return results;
    }
}

module.exports = DataRecordDAO

