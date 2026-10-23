const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');
const { DATA_SYNC_COLLECTION } = require('../../crdc-datahub-database-drivers/database-constants');
const { DATA_SYNC_TYPE, DATA_SYNC_STATUSES } = require('../../constants/data-sync-constants');

/** @type {string[]} */
const DATA_SYNC_TYPES = Object.values(DATA_SYNC_TYPE);

/**
 * Mongoose schema for DataSync task records in the dataSync collection.
 */
const dataSyncSchema = new mongoose.Schema(
    {
        _id: {
            type: String,
            default: () => uuidv4(),
        },
        type: {
            type: String,
            required: true,
            enum: DATA_SYNC_TYPES,
        },
        submissionID: {
            type: String,
            required: true,
        },
        sourceFolder: {
            type: String,
            required: true,
        },
        targetFolder: {
            type: String,
            required: true,
        },
        startTime: {
            type: Date,
            required: true,
        },
        endTime: {
            type: Date,
        },
        status: {
            type: String,
            required: true,
            enum: DATA_SYNC_STATUSES,
        },
        taskArn: {
            type: String,
        },
        taskExecutionArn: {
            type: String,
        },
        sourceLocationArn: { type: String },
        destinationLocationArn: { type: String },
        listPending: { type: Boolean },
        rollupPending: { type: Boolean },
        cleanupAfter: { type: Date },
        lastError: { type: String },
        observationErrorSince: { type: Date },
    },
    {
        collection: DATA_SYNC_COLLECTION,
        timestamps: false,
        versionKey: false,
        suppressReservedKeysWarning: true,
    }
);

const DataSyncModel =
    mongoose.models.DataSync || mongoose.model('DataSync', dataSyncSchema);

module.exports = DataSyncModel;
