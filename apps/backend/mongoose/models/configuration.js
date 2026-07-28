const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');
const { CONFIGURATION_COLLECTION } = require('../../crdc-datahub-database-drivers/database-constants');

/**
 * Nested schemas for PBAC defaults embedded in configuration documents.
 * Nested notification/permission IDs are stored as `_id` in MongoDB (Prisma `@map("_id")`).
 */
const notificationSchema = new mongoose.Schema(
    {
        _id: { type: String },
        checked: { type: Boolean },
        disabled: { type: Boolean },
        group: { type: String },
        name: { type: String },
        order: { type: Number },
    },
    { versionKey: false }
);

const permissionSchema = new mongoose.Schema(
    {
        _id: { type: String },
        checked: { type: Boolean },
        disabled: { type: Boolean },
        group: { type: String },
        inherited: { type: [String], default: undefined },
        name: { type: String },
        order: { type: Number },
    },
    { versionKey: false }
);

const pbacDefaultsSchema = new mongoose.Schema(
    {
        notifications: { type: [notificationSchema], default: undefined },
        permissions: { type: [permissionSchema], default: undefined },
        role: { type: String },
    },
    { _id: false, versionKey: false }
);

const configurationTagSchema = new mongoose.Schema(
    {
        Key: { type: String },
        Value: { type: String },
    },
    { _id: false, versionKey: false }
);

/**
 * Mongoose schema for configuration, matching the Prisma Configuration model.
 * Documents are type-discriminated; most fields are optional per type.
 */
const configurationSchema = new mongoose.Schema(
    {
        _id: {
            type: String,
            default: () => uuidv4(),
        },
        COMPLETED_RETENTION_DAYS: { type: Number },
        DASHBOARD_SESSION_TIMEOUT: { type: Number },
        Defaults: { type: [pbacDefaultsSchema], default: undefined },
        EMAIL_URL: { type: String },
        INACTIVE_APPLICATION_DAYS: { type: Number },
        INACTIVE_SUBMISSION_DAYS_DELETE: { type: Number },
        INACTIVE_USER_DAYS: { type: Number },
        OFFICIAL_EMAIL: { type: String },
        PRESIGN_EXPIRATION: { type: Number },
        PROD_URL: { type: String },
        REMIND_APPLICATION_DAYS: { type: Number },
        REVIEW_COMMITTEE_EMAIL: { type: [String], default: undefined },
        ROLE_TIMEOUT: { type: Number },
        SCHEDULED_JOBS: { type: String },
        SUBMISSION_BUCKET: { type: String },
        SUBMISSION_HELPDESK: { type: String },
        SUBMISSION_REQUEST_CONTACT_EMAIL: { type: String },
        SUBMISSION_SYSTEM_PORTAL: { type: String },
        TECH_SUPPORT_EMAIL: { type: String },
        age: { type: Number },
        bucketName: { type: String },
        current: { type: String },
        current_version: { type: String },
        dashboardID: { type: String },
        dataCommons: { type: String },
        days: { type: Number },
        interval: { type: Number },
        key: { type: [String], default: undefined },
        keys: { type: mongoose.Schema.Types.Mixed },
        new: { type: String },
        prefix: { type: String },
        size: { type: Number },
        tag: { type: configurationTagSchema },
        timeout: { type: Number },
        type: { type: String, required: true },
        version: { type: String },
        OMBInfo: { type: [String], default: undefined },
        OMBNumber: { type: String },
        expirationDate: { type: Date },
    },
    {
        collection: CONFIGURATION_COLLECTION,
        timestamps: false,
        versionKey: false,
        // Polymorphic type-discriminated docs; Prisma schema is incomplete vs real documents
        // (e.g. EMAIL_SMTP_*, INACTIVE_*_NOTIFY_DAYS). Keep undeclared paths on read/write.
        strict: false,
    }
);

const ConfigurationModel =
    mongoose.models.Configuration || mongoose.model('Configuration', configurationSchema);

module.exports = ConfigurationModel;
