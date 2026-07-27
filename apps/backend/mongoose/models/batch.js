const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');
const { BATCH_COLLECTION } = require('../../crdc-datahub-database-drivers/database-constants');

/**
 * Embedded file schema matching the Prisma BatchFiles type.
 */
const batchFileSchema = new mongoose.Schema(
    {
        createdAt: {
            type: Date,
        },
        errors: {
            type: [String],
            default: undefined,
        },
        fileID: {
            type: String,
        },
        fileName: {
            type: String,
            required: true,
        },
        filePrefix: {
            type: String,
            required: true,
        },
        nodeType: {
            type: String,
        },
        signedURL: {
            type: String,
        },
        size: {
            type: Number,
        },
        status: {
            type: String,
            required: true,
        },
        updatedAt: {
            type: Date,
        },
    },
    {
        _id: false,
        suppressReservedKeysWarning: true,
    }
);

/**
 * Mongoose schema for batch, matching the Prisma Batch model.
 */
const batchSchema = new mongoose.Schema(
    {
        _id: {
            type: String,
            default: () => uuidv4(),
        },
        bucketName: {
            type: String,
            required: true,
        },
        displayID: {
            type: Number,
            required: true,
        },
        errors: {
            type: [String],
            default: undefined,
        },
        fileCount: {
            type: Number,
            required: true,
        },
        filePrefix: {
            type: String,
            required: true,
        },
        files: {
            type: [batchFileSchema],
            default: undefined,
        },
        status: {
            type: String,
            required: true,
        },
        submissionID: {
            type: String,
            required: true,
        },
        submitterID: {
            type: String,
        },
        submitterName: {
            type: String,
        },
        type: {
            type: String,
            required: true,
        },
        zipFileName: {
            type: String,
        },
    },
    {
        collection: BATCH_COLLECTION,
        timestamps: true,
        versionKey: false,
        suppressReservedKeysWarning: true,
    }
);

const BatchModel =
    mongoose.models.Batch || mongoose.model('Batch', batchSchema);

module.exports = BatchModel;
