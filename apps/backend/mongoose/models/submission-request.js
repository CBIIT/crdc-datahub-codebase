const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');
const { APPLICATION_COLLECTION } = require('../../crdc-datahub-database-drivers/database-constants');

/**
 * Embedded history event on an SRF document.
 */
const historySchema = new mongoose.Schema(
    {
        dateTime: { type: Date },
        reviewComment: { type: String },
        status: { type: String },
        userID: { type: String },
        userName: { type: String },
        isAdminSubmit: { type: Boolean },
    },
    { _id: false, versionKey: false }
);

/**
 * Embedded organization / program info on an SRF document.
 */
const orgInfoSchema = new mongoose.Schema(
    {
        _id: { type: String },
        name: { type: String },
        status: { type: String },
        createdAt: { type: Date },
        updateAt: { type: Date },
        orgID: { type: String },
        orgName: { type: String },
    },
    { versionKey: false }
);

/**
 * Embedded new-institution entry on an SRF document.
 */
const newInstitutionSchema = new mongoose.Schema(
    {
        _id: { type: String },
        name: { type: String },
    },
    { versionKey: false }
);

/**
 * Mongoose schema for submission requests (SRFs), matching the Prisma Application model.
 * Applicant is stored as applicantID only; join users via $lookup when needed.
 */
const submissionRequestSchema = new mongoose.Schema(
    {
        _id: {
            type: String,
            default: () => uuidv4(),
        },
        version: {
            type: String,
            required: true,
        },
        ORCID: {
            type: String,
        },
        PI: {
            type: String,
        },
        controlledAccess: {
            type: Boolean,
        },
        history: {
            type: [historySchema],
            default: [],
        },
        openAccess: {
            type: Boolean,
        },
        organization: {
            type: orgInfoSchema,
        },
        programAbbreviation: {
            type: String,
        },
        programDescription: {
            type: String,
        },
        programName: {
            type: String,
            required: true,
        },
        questionnaireData: {
            type: String,
            required: true,
        },
        reviewComment: {
            type: String,
        },
        status: {
            type: String,
            required: true,
        },
        studyAbbreviation: {
            type: String,
            required: true,
        },
        studyName: {
            type: String,
            required: true,
        },
        submittedDate: {
            type: Date,
        },
        wholeProgram: {
            type: Boolean,
        },
        newInstitutions: {
            type: [newInstitutionSchema],
            default: [],
        },
        GPAName: {
            type: String,
        },
        applicantID: {
            type: String,
        },
        inactiveReminder: {
            type: Boolean,
        },
        inactiveReminder_7: {
            type: Boolean,
        },
        inactiveReminder_15: {
            type: Boolean,
        },
        inactiveReminder_30: {
            type: Boolean,
        },
        finalInactiveReminder: {
            type: Boolean,
        },
        sequenceNumber: {
            type: Number,
            default: 1,
        },
        nextRevisionId: {
            type: String,
        },
    },
    {
        collection: APPLICATION_COLLECTION,
        timestamps: true,
        versionKey: false,
    }
);

const SubmissionRequestModel =
    mongoose.models.SubmissionRequest
    || mongoose.model('SubmissionRequest', submissionRequestSchema);

module.exports = SubmissionRequestModel;
