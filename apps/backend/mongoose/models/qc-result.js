const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');
const { QC_RESULTS_COLLECTION } = require('../../crdc-datahub-database-drivers/database-constants');

/**
 * Embedded error/warning schema matching the Prisma Error type.
 */
const errorSchema = new mongoose.Schema(
    {
        title: {
            type: String,
            required: true,
        },
        description: {
            type: String,
            required: true,
        },
        code: {
            type: String,
        },
        offendingProperty: {
            type: String,
        },
        offendingValue: {
            type: String,
        },
        severity: {
            type: String,
        },
    },
    {
        _id: false,
        suppressReservedKeysWarning: true,
    }
);

/**
 * Mongoose schema for qcResult, matching the Prisma QcResult model.
 */
const qcResultSchema = new mongoose.Schema(
    {
        _id: {
            type: String,
            default: () => uuidv4(),
        },
        batchIDs: {
            type: [String],
            default: undefined,
        },
        dataRecordID: {
            type: String,
            required: true,
        },
        displayID: {
            type: Number,
            required: true,
        },
        errors: {
            type: [errorSchema],
            default: [],
        },
        latestBatchID: {
            type: String,
            required: true,
        },
        origin: {
            type: String,
        },
        severity: {
            type: String,
            required: true,
        },
        submissionID: {
            type: String,
            required: true,
            index: true,
        },
        submittedID: {
            type: String,
            required: true,
        },
        type: {
            type: String,
            required: true,
        },
        uploadedDate: {
            type: Date,
            required: true,
        },
        validatedDate: {
            type: Date,
            required: true,
        },
        validationType: {
            type: String,
            required: true,
        },
        warnings: {
            type: [errorSchema],
            default: [],
        },
    },
    {
        collection: QC_RESULTS_COLLECTION,
        timestamps: false,
        versionKey: false,
        suppressReservedKeysWarning: true,
    }
);

const QcResultModel =
    mongoose.models.QcResult || mongoose.model('QcResult', qcResultSchema);

module.exports = QcResultModel;
