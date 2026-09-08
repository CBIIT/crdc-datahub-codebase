const MongooseGenericDAO = require("./mongoose-generic");
const QcResultModel = require("../mongoose/models/qc-result");
const {VALIDATION_STATUS} = require("../constants/submission-constants");
const {getSortDirection} = require("../crdc-datahub-database-drivers/utility/mongodb-utility");
const ISSUE_COUNT = "issueCount";
const ALL_FLAG = "All";

class QCResultDAO extends MongooseGenericDAO {
    constructor() {
        super(QcResultModel);
    }

    /**
     * Aggregate QC issues for a submission, grouped by issue type with distinct record counts.
     * Page sort uses grouped `_id` as a unique tiebreaker so skip/limit is stable across requests.
     * @param {string} submissionID Submission ID
     * @param {string} severity Severity filter (Error, Warning, or All)
     * @param {number} first Page size
     * @param {number} offset Page offset
     * @param {string} orderBy Sort field
     * @param {string} sortDirection Sort direction
     * @returns {Promise<{total: number, results: object[]}>}
     */
    async aggregatedSubmissionQCResults(submissionID, severity, first, offset, orderBy, sortDirection) {
        const severityFilter = formatSeverityFilter(severity);
        const basePipeline = this._aggregatedQCResultsBasePipeline(submissionID, severityFilter);
        const countPipeline = [
            ...basePipeline,
            { $count: "total" }
        ];
        const paginationPipeline = [
            ...basePipeline,
            {
                $project: {
                    title: "$_id.title",
                    severity: "$_id.severity",
                    code: "$_id.code",
                    count: "$count",
                    property: { $ifNull: ["$_id.property", "N/A"] },
                    value: { $ifNull: ["$_id.value", "N/A"] }
                }
            },
            {
                $sort: {
                    [orderBy]: getSortDirection(sortDirection),
                    _id: 1
                }
            }
        ];
        if (offset > 0) {
            paginationPipeline.push({ $skip: offset });
        }
        if (first > 0) {
            paginationPipeline.push({ $limit: first });
        }
        paginationPipeline.push({ $unset: "_id" });
        const [countPipelineResult, paginatedPipelineResult] = await Promise.all([
            this.aggregate(countPipeline),
            this.aggregate(paginationPipeline)
        ]);
        const totalRecords = countPipelineResult[0]?.total;
        return {
            total: totalRecords || 0,
            results: paginatedPipelineResult
        };
    }

    /**
     * Shared stages through two-stage distinct $group (no $addToSet).
     * @param {string} submissionID Submission ID
     * @param {string|null} severityFilter Error, Warning, or null for all
     * @returns {object[]}
     */
    _aggregatedQCResultsBasePipeline(submissionID, severityFilter) {
        const pipeline = [{ $match: { submissionID } }];
        const nonEmptyArray = {
            $exists: true,
            $type: "array",
            $ne: []
        };
        if (severityFilter === VALIDATION_STATUS.ERROR) {
            pipeline.push(
                { $match: { errors: nonEmptyArray } },
                {
                    $project: {
                        dataRecordID: 1,
                        errors: mappedIssuesWithSeverity("$errors", VALIDATION_STATUS.ERROR)
                    }
                },
                { $unwind: { path: "$errors" } },
                {
                    $group: {
                        _id: issueGroupKey("$errors")
                    }
                }
            );
        } else if (severityFilter === VALIDATION_STATUS.WARNING) {
            pipeline.push(
                { $match: { warnings: nonEmptyArray } },
                {
                    $project: {
                        dataRecordID: 1,
                        warnings: mappedIssuesWithSeverity("$warnings", VALIDATION_STATUS.WARNING)
                    }
                },
                { $unwind: { path: "$warnings" } },
                {
                    $group: {
                        _id: issueGroupKey("$warnings")
                    }
                }
            );
        } else {
            pipeline.push(
                {
                    $project: {
                        dataRecordID: 1,
                        issues: {
                            $concatArrays: [
                                mappedIssuesWithSeverity("$errors", VALIDATION_STATUS.ERROR),
                                mappedIssuesWithSeverity("$warnings", VALIDATION_STATUS.WARNING)
                            ]
                        }
                    }
                },
                { $unwind: { path: "$issues" } },
                {
                    $group: {
                        _id: issueGroupKey("$issues")
                    }
                }
            );
        }
        pipeline.push({
            $group: {
                _id: {
                    title: "$_id.title",
                    severity: "$_id.severity",
                    code: "$_id.code",
                    property: "$_id.property",
                    value: "$_id.value"
                },
                count: { $sum: 1 }
            }
        });
        return pipeline;
    }

    /**
     * List QC result rows for a submission with filters, issue counts, and pagination.
     * Uses split count + page pipelines (DocumentDB does not support $facet).
     * @param {string} submissionID Submission ID
     * @param {string[]} nodeTypes Node type filters
     * @param {string[]} batchIDs Batch ID filters (only the first is applied)
     * @param {string} severities Severity filter (Error, Warning, or All)
     * @param {string} issueCode Issue code filter
     * @param {number} first Page size
     * @param {number} offset Page offset
     * @param {string} orderBy Sort field
     * @param {string} sortDirection Sort direction
     * @returns {Promise<{results: object[], total: number}>}
     */
    async submissionQCResults(submissionID, nodeTypes, batchIDs, severities, issueCode, first, offset, orderBy, sortDirection){
        // Create lookup pipeline
        let pipeline = [];
        // Filter by submission ID
        pipeline.push({
            $match: {
                submissionID: submissionID
            }
        });
        // Filter by severity
        const arrayWithElements = {
            $exists: true,
            $type: 'array',
            $ne: []
        }
        if (severities === VALIDATION_STATUS.ERROR){
            pipeline.push({
                $match: {
                    errors: arrayWithElements
                }
            });
            // Add error length
            pipeline.push({
                $set: {
                    [ISSUE_COUNT]: { $size: "$errors" }
                }
            });
        }
        else if (severities === VALIDATION_STATUS.WARNING){
            pipeline.push({
                $match: {
                    warnings: arrayWithElements
                }
            });
            // Add warning length
            pipeline.push({
                $set: {
                    [ISSUE_COUNT]: { $size: "$warnings" }
                }
            });
        }
        // Setting all flag.
        if (severities === ALL_FLAG){
            pipeline.push({
                $set: {
                    [ISSUE_COUNT]: {
                        $add: [
                            { $size: { $ifNull: ["$warnings", []] } },
                            { $size: { $ifNull: ["$errors", []] } }
                        ]
                    }
                }
            });
        }

        // Filter by batch IDs
        if (!!batchIDs && batchIDs.length > 0){
            // If multiple batchIDs are specified, then only the first will be used for the filter
            const batchID = batchIDs[0];
            // Check if any of the specified batchIDs are in the qcResult
            pipeline.push({
                $match:{
                    latestBatchID: batchID
                }
            })
        }
        // Filter by nodeTypes
        if (!!nodeTypes && nodeTypes.length > 0){
            // Check if any of the specified nodeTypes are in the qcResult
            pipeline.push({
                $match:{
                    type: {
                        $in: nodeTypes
                    }
                }
            })
        }
        // Filter by issueCode
        if (!!issueCode){
            // Check if the specified issueCode is in any of the qcResult's errors or warnings
            pipeline.push({
                $match:{
                    $or: [
                        {"errors.code": issueCode},
                        {"warnings.code": issueCode}
                    ]
                }
            })
        }
        pipeline.push({
            $set:{
                batchID: "$latestBatchID"
            }
        })
        // Create count pipeline
        let countPipeline = [...pipeline];
        countPipeline.push({
            $count: "total"
        });
        const countPipelineResult = await this.aggregate(countPipeline);
        const totalRecords = countPipelineResult[0]?.total;
        // Create paginated pipeline
        let pagedPipeline = [...pipeline];
        const nodeType = "type";
        const dir = getSortDirection(sortDirection);
        const primarySortBy = (orderBy === ISSUE_COUNT) ? ISSUE_COUNT : orderBy;

        let sortFields = { [primarySortBy]: dir };
        // add secondary sort by nodeType when primary isn't nodeType
        if (primarySortBy !== nodeType) {
            sortFields[nodeType] = 1;
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
        const pagedPipelineResult = await this.aggregate(pagedPipeline);
        const dataRecords = replaceNaN(pagedPipelineResult, null);
        return {
            results: dataRecords || [],
            total: totalRecords || 0
        }
    }

    /**
     * Find QC results for a submission that include a specific error code.
     * Projects only submittedID and submissionID for callers that need IDs/counts.
     * @param {string} submissionID Submission ID
     * @param {string} errorCode Error code to match in the errors array
     * @returns {Promise<object[]>}
     */
    async findBySubmissionErrorCodes(submissionID, errorCode) {
        const result = await this.model
            .find({ submissionID, "errors.code": errorCode })
            .select("submittedID submissionID")
            .lean();
        return result.map((item) => this._mapDoc(item));
    }

    /**
     * Return submittedID and dataRecordID for QC results of a given type in a submission.
     * @param {string} submissionID Submission ID
     * @param {string} errorType Node/error type to match
     * @returns {Promise<object[]>}
     */
    async getQCResultsErrors(submissionID, errorType) {
        const result = await this.aggregate([
            {"$match": { submissionID: submissionID, type: errorType}},
            {"$project": {submittedID: 1, dataRecordID: 1}}
        ]);
        return result || [];
    }
}




function replaceNaN(results, replacement){
    results?.map((result) => {
        Object.keys(result).forEach((key) => {
            if (Object.is(result[key], Number.NaN)){
                result[key] = replacement;
            }
        })
    });
    return results;
}

function formatSeverityFilter(severity){
    if (!severity || typeof severity !== "string"){
        return null;
    }
    severity = severity.toLowerCase();
    if (severity === VALIDATION_STATUS.ERROR.toLowerCase()){
        return VALIDATION_STATUS.ERROR;
    }
    if (severity === VALIDATION_STATUS.WARNING.toLowerCase()){
        return VALIDATION_STATUS.WARNING;
    }
    return null;
}

/**
 * $map that attaches severity and keeps only grouping fields.
 * @param {string} arrayPath Field path including $ (e.g. "$errors")
 * @param {string} severity Error or Warning
 * @returns {object}
 */
function mappedIssuesWithSeverity(arrayPath, severity) {
    return {
        $map: {
            input: { $ifNull: [arrayPath, []] },
            as: "issue",
            in: {
                title: "$$issue.title",
                code: "$$issue.code",
                offendingProperty: "$$issue.offendingProperty",
                offendingValue: "$$issue.offendingValue",
                severity
            }
        }
    };
}

/**
 * First-stage $group _id: issue identity plus dataRecordID for distinct counting.
 * @param {string} issuePath Field path including $ (e.g. "$errors")
 * @returns {object}
 */
function issueGroupKey(issuePath) {
    return {
        title: `${issuePath}.title`,
        severity: `${issuePath}.severity`,
        code: `${issuePath}.code`,
        property: `${issuePath}.offendingProperty`,
        value: `${issuePath}.offendingValue`,
        dataRecordID: "$dataRecordID"
    };
}

module.exports = QCResultDAO;
