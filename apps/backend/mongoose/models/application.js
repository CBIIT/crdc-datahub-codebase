const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');
const { APPLICATION_COLLECTION } = require('../../crdc-datahub-database-drivers/database-constants');

/**
 * Embedded history event on an application document.
 */
const historySchema = new mongoose.Schema(
    {
        dateTime: {
            type: Date,
            required: true,
        },
        reviewComment: {
            type: String,
        },
        status: {
            type: String,
            required: true,
        },
        userID: {
            type: String,
        },
        userName: {
            type: String,
        },
        isAdminSubmit: {
            type: Boolean,
        },
    },
    {
        _id: false,
        versionKey: false,
    }
);

/**
 * Embedded organization (program) info historically stored on application documents.
 */
const orgInfoSchema = new mongoose.Schema(
    {
        _id: {
            type: String,
        },
        name: {
            type: String,
            required: true,
        },
        status: {
            type: String,
        },
        createdAt: {
            type: Date,
        },
        updateAt: {
            type: Date,
        },
        orgID: {
            type: String,
        },
        orgName: {
            type: String,
        },
    },
    {
        versionKey: false,
    }
);

/**
 * Embedded new-institution entry on an application document.
 */
const newInstitutionSchema = new mongoose.Schema(
    {
        _id: {
            type: String,
        },
        name: {
            type: String,
            required: true,
        },
    },
    {
        versionKey: false,
    }
);

/**
 * Mongoose schema for applications (submission request forms), for the Application collection.
 */
const applicationSchema = new mongoose.Schema(
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
            default: undefined,
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
        // Draft SRFs may persist empty strings for these form fields.
        programName: {
            type: String,
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
        },
        studyName: {
            type: String,
        },
        submittedDate: {
            type: Date,
        },
        wholeProgram: {
            type: Boolean,
        },
        newInstitutions: {
            type: [newInstitutionSchema],
            default: undefined,
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

const ApplicationModel =
    mongoose.models.Application || mongoose.model('Application', applicationSchema);

module.exports = ApplicationModel;
