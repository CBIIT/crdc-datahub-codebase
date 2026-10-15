const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');
const { DATA_SYNC_COLLECTION } = require('../../crdc-datahub-database-drivers/database-constants');

/** @type {string[]} */
const DATA_SYNC_TYPES = ['metadata', 'file'];

/**
 * App-level DataSync task statuses (constants module added in a follow-up commit).
 * @type {string[]}
 */
const DATA_SYNC_STATUSES = ['Not Started', 'In Progress', 'Succeeded', 'Failed'];

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
