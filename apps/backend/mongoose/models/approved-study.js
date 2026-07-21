const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');
const { APPROVED_STUDIES_COLLECTION } = require('../../crdc-datahub-database-drivers/database-constants');

/**
 * Mongoose schema for approvedStudies, matching the Prisma ApprovedStudy model.
 */
const approvedStudySchema = new mongoose.Schema(
    {
        _id: {
            type: String,
            default: () => uuidv4(),
        },
        ORCID: {
            type: String,
        },
        PI: {
            type: String,
        },
        controlledAccess: {
            type: Boolean,
            required: true,
        },
        dbGaPID: {
            type: String,
        },
        openAccess: {
            type: Boolean,
        },
        originalOrg: {
            type: String,
        },
        primaryContactID: {
            type: String,
        },
        programName: {
            type: String,
        },
        programID: {
            type: String,
            index: true,
        },
        studyAbbreviation: {
            type: String,
            required: true,
        },
        studyName: {
            type: String,
            required: true,
        },
        status: {
            type: String,
            default: 'Active',
        },
        useProgramPC: {
            type: Boolean,
        },
        pendingModelChange: {
            type: Boolean,
        },
        pendingImageDeIdentification: {
            type: Boolean,
        },
        applicationID: {
            type: String,
        },
        isPendingGPA: {
            type: Boolean,
        },
        GPAName: {
            type: String,
        },
    },
    {
        collection: APPROVED_STUDIES_COLLECTION,
        timestamps: true,
        versionKey: false,
    }
);

const ApprovedStudyModel =
    mongoose.models.ApprovedStudy || mongoose.model('ApprovedStudy', approvedStudySchema);

module.exports = ApprovedStudyModel;
