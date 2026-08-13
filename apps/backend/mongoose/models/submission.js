const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');
const { SUBMISSIONS_COLLECTION } = require('../../crdc-datahub-database-drivers/database-constants');

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
 * Embedded file error schema matching the Prisma FileError type.
 */
const fileErrorSchema = new mongoose.Schema(
    {
        submissionID: { type: String },
        dataRecordID: { type: String },
        validationType: { type: String },
        batchID: { type: String },
        displayID: { type: Number },
        type: { type: String },
        submittedID: { type: String },
        severity: { type: String },
        uploadedDate: { type: Date },
        validatedDate: { type: Date },
        errors: { type: [errorSchema], default: undefined },
        warnings: { type: [errorSchema], default: undefined },
    },
    {
        _id: false,
        suppressReservedKeysWarning: true,
    }
);

/**
 * Embedded collaborator schema matching the Prisma Collaborator type.
 */
const collaboratorSchema = new mongoose.Schema(
    {
        collaboratorID: { type: String, required: true },
        collaboratorName: { type: String },
        permission: { type: String, required: true },
    },
    { _id: false }
);

/**
 * Embedded history event schema matching the Prisma History type.
 */
const historySchema = new mongoose.Schema(
    {
        dateTime: { type: Date, required: true },
        reviewComment: { type: String },
        status: { type: String, required: true },
        userID: { type: String },
        userName: { type: String },
        isAdminSubmit: { type: Boolean },
    },
    { _id: false }
);

/**
 * Embedded data file size schema matching the Prisma DataFileSize type.
 */
const dataFileSizeSchema = new mongoose.Schema(
    {
        formatted: { type: String, required: true },
        size: { type: Number, required: true },
    },
    { _id: false }
);

/**
 * Mongoose schema for submission, matching the Prisma Submission model.
 */
const submissionSchema = new mongoose.Schema(
    {
        _id: {
            type: String,
            default: () => uuidv4(),
        },
        ORCID: { type: String },
        accessedAt: { type: Date },
        archived: { type: Boolean },
        bucketName: { type: String, required: true },
        collaborators: { type: [collaboratorSchema], default: undefined },
        controlledAccess: { type: Boolean },
        // Legacy docs may store Boolean; prefer String going forward
        crossSubmissionStatus: { type: mongoose.Schema.Types.Mixed },
        dataCommons: { type: String, required: true },
        dataCommonsDisplayName: { type: String },
        dataFileSize: { type: dataFileSizeSchema, required: true },
        dataType: { type: String, required: true },
        dbGaPID: { type: String },
        deletingData: { type: Boolean },
        fileErrors: { type: [fileErrorSchema], default: undefined },
        // Legacy docs may store Boolean; prefer String going forward
        fileValidationStatus: { type: mongoose.Schema.Types.Mixed },
        fileWarnings: { type: [fileErrorSchema], default: undefined },
        finalInactiveReminder: { type: Boolean },
        history: { type: [historySchema], default: undefined },
        inactiveReminder_30: { type: Boolean },
        inactiveReminder_60: { type: Boolean },
        inactiveReminder_7: { type: Boolean },
        intention: { type: String, required: true },
        // Legacy docs may store Boolean; prefer String going forward
        metadataValidationStatus: { type: mongoose.Schema.Types.Mixed },
        modelVersion: { type: String, required: true },
        name: { type: String, required: true },
        nodeCount: { type: Number },
        reviewComment: { type: String },
        rootPath: { type: String, required: true },
        status: { type: String, required: true },
        submissionType: { type: String },
        studyAbbreviation: { type: String },
        studyName: { type: String },
        studyID: { type: String, required: true },
        submissionRequestID: { type: String },
        submitterID: { type: String, required: true },
        conciergeID: { type: String },
        statusDetail: { type: [String], default: undefined },
        validationEnded: { type: Date },
        validationScope: { type: String },
        validationStarted: { type: Date },
        validationType: { type: [String], default: undefined },
        programID: { type: String },
    },
    {
        collection: SUBMISSIONS_COLLECTION,
        timestamps: true,
        versionKey: false,
        suppressReservedKeysWarning: true,
    }
);

const SubmissionModel =
    mongoose.models.Submission || mongoose.model('Submission', submissionSchema);

module.exports = SubmissionModel;
