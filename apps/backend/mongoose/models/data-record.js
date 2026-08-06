const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');
const { DATA_RECORDS_COLLECTION } = require('../../crdc-datahub-database-drivers/database-constants');

/**
 * Embedded error/warning schema matching the Prisma Error type.
 */
const errorSchema = new mongoose.Schema(
    {
        title: { type: String, required: true },
        description: { type: String, required: true },
        code: { type: String },
        offendingProperty: { type: String },
        offendingValue: { type: String },
        severity: { type: String },
    },
    {
        _id: false,
        suppressReservedKeysWarning: true,
    }
);

/**
 * Embedded additional/cross-validation error schema matching Prisma AdditionalError.
 */
const additionalErrorSchema = new mongoose.Schema(
    {
        conflictingSubmissions: { type: [String], default: undefined },
        description: { type: String },
        title: { type: String },
    },
    { _id: false }
);

/**
 * Embedded parent relationship schema matching Prisma Parent.
 */
const parentSchema = new mongoose.Schema(
    {
        parentIDPropName: { type: String },
        parentIDValue: { type: String },
        parentType: { type: String },
    },
    { _id: false }
);

/**
 * Embedded S3 file info schema matching Prisma S3FileInfo.
 */
const s3FileInfoSchema = new mongoose.Schema(
    {
        createdAt: { type: Date },
        errors: { type: [errorSchema], default: [] },
        fileName: { type: String },
        md5: { type: String },
        size: { type: String },
        status: { type: String },
        updatedAt: { type: Date },
        warnings: { type: [errorSchema], default: [] },
    },
    {
        _id: false,
        suppressReservedKeysWarning: true,
    }
);

/**
 * Mongoose schema for dataRecord, matching the Prisma DataRecord model.
 */
const dataRecordSchema = new mongoose.Schema(
    {
        _id: {
            type: String,
            default: () => uuidv4(),
        },
        CRDC_ID: {
            type: String,
        },
        IDPropName: {
            type: String,
            required: true,
        },
        additionalErrors: {
            type: [additionalErrorSchema],
            default: [],
        },
        batchIDs: {
            type: [String],
            default: undefined,
        },
        dataCommons: {
            type: String,
            required: true,
        },
        entityType: {
            type: String,
        },
        errors: {
            type: [errorSchema],
            default: [],
        },
        latestBatchDisplayID: {
            type: Number,
            required: true,
        },
        latestBatchID: {
            type: String,
            required: true,
        },
        lineNumber: {
            type: Number,
            required: true,
        },
        nodeID: {
            type: String,
            required: true,
        },
        nodeType: {
            type: String,
            required: true,
        },
        orginalFileName: {
            type: String,
            required: true,
        },
        parents: {
            type: [parentSchema],
            default: [],
        },
        props: {
            type: mongoose.Schema.Types.Mixed,
        },
        qcResultID: {
            type: String,
        },
        rawData: {
            type: mongoose.Schema.Types.Mixed,
        },
        s3FileInfo: {
            type: s3FileInfoSchema,
        },
        status: {
            type: String,
            required: true,
        },
        studyID: {
            type: String,
            required: true,
        },
        submissionID: {
            type: String,
            required: true,
        },
        uploadedDate: {
            type: Date,
            required: true,
        },
        validatedAt: {
            type: Date,
        },
        warnings: {
            type: [errorSchema],
            default: [],
        },
    },
    {
        collection: DATA_RECORDS_COLLECTION,
        timestamps: true,
        versionKey: false,
        suppressReservedKeysWarning: true,
    }
);

dataRecordSchema.index(
    { submissionID: 1, nodeType: 1, nodeID: 1 },
    { name: 'submissionID_nodeType_nodeID' }
);
dataRecordSchema.index(
    { dataCommons: 1, nodeType: 1, nodeID: 1 },
    { name: 'dataCommons_nodeType_nodeID' }
);
dataRecordSchema.index(
    { submissionID: 1 },
    { name: 'submissionID_index' }
);
dataRecordSchema.index(
    { studyID: 1, entityType: 1, nodeID: 1 },
    { name: 'studyID_entityType_nodeID' }
);

const DataRecordModel =
    mongoose.models.DataRecord || mongoose.model('DataRecord', dataRecordSchema);

module.exports = DataRecordModel;
