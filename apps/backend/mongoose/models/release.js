const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');
const { RELEASE_DATA_RECORDS_COLLECTION } = require('../../crdc-datahub-database-drivers/database-constants');

/**
 * Embedded parent relationship on a released node.
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
 * Mongoose schema for release, matching the Prisma Release model.
 * Includes generatedProps (present in stored documents, used by download/props APIs).
 */
const releaseSchema = new mongoose.Schema(
    {
        _id: {
            type: String,
            default: () => uuidv4(),
        },
        CRDC_ID: {
            type: String,
            index: true,
        },
        dataCommons: {
            type: String,
            required: true,
        },
        entityType: {
            type: String,
        },
        nodeID: {
            type: String,
            required: true,
        },
        nodeType: {
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
        generatedProps: {
            type: mongoose.Schema.Types.Mixed,
        },
        status: {
            type: String,
            required: true,
        },
        studyID: {
            type: String,
        },
        submissionID: {
            type: String,
            required: true,
        },
    },
    {
        collection: RELEASE_DATA_RECORDS_COLLECTION,
        timestamps: true,
        versionKey: false,
    }
);

releaseSchema.index(
    { dataCommons: 1, nodeType: 1, nodeID: 1 },
    { name: 'dataCommons_nodeType_nodeID' }
);

const ReleaseModel =
    mongoose.models.Release || mongoose.model('Release', releaseSchema);

module.exports = ReleaseModel;
