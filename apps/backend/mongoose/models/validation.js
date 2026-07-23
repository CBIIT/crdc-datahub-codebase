const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');
const { VALIDATION_COLLECTION } = require('../../crdc-datahub-database-drivers/database-constants');

/**
 * Mongoose schema for validation, matching the Prisma Validation model.
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
            index: true,
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
