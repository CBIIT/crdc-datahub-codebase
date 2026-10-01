const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');
const { VALIDATION_COLLECTION } = require('../../crdc-datahub-database-drivers/database-constants');

/**
 * Mongoose schema for validation, for the Validation collection.
 */
const validationSchema = new mongoose.Schema(
    {
        _id: {
            type: String,
            default: () => uuidv4(),
        },
        ended: {
            type: Date,
        },
        aborted: {
            type: Boolean,
        },
        metadataEnded: {
            type: Date,
        },
        scope: {
            type: String,
        },
        started: {
            type: Date,
            required: true,
        },
        status: {
            type: String,
        },
        metadataStatus: {
            type: String,
        },
        statusDetail: {
            type: [String],
            default: undefined,
        },
        submissionID: {
            type: String,
            required: true,
        },
        totalBatches: {
            type: Number,
        },
        completedBatches: {
            type: Number,
        },
        failedBatches: {
            type: Number,
        },
        batchStatusDetails: {
            type: [String],
            default: undefined,
        },
        worstBatchStatus: {
            type: Number,
        },
        processedBatchIndexes: {
            type: [Number],
            default: undefined,
        },
        expectedBatchIndexes: {
            type: [Number],
            default: undefined,
        },
        totalFileMessages: {
            type: Number,
        },
        completedFileMessages: {
            type: Number,
        },
        worstFileStatus: {
            type: Number,
        },
        processedFileTaskKeys: {
            type: [String],
            default: undefined,
        },
        expectedFileTaskKeys: {
            type: [String],
            default: undefined,
        },
        type: {
            type: [String],
            default: undefined,
        },
    },
    {
        collection: VALIDATION_COLLECTION,
        timestamps: false,
        versionKey: false,
    }
);

const ValidationModel =
    mongoose.models.Validation || mongoose.model('Validation', validationSchema);

module.exports = ValidationModel;
