const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');
const { ORGANIZATION_COLLECTION } = require('../../crdc-datahub-database-drivers/database-constants');

/**
 * Mongoose schema for programs, matching the Prisma Program model.
 * Stored in the historical `organization` Mongo collection.
 */
const programSchema = new mongoose.Schema(
    {
        _id: {
            type: String,
            default: () => uuidv4(),
        },
        abbreviation: {
            type: String,
        },
        bucketName: {
            type: String,
        },
        conciergeEmail: {
            type: String,
        },
        conciergeID: {
            type: String,
        },
        conciergeName: {
            type: String,
        },
        description: {
            type: String,
        },
        name: {
            type: String,
            required: true,
        },
        rootPath: {
            type: String,
        },
        status: {
            type: String,
            required: true,
        },
        readOnly: {
            type: Boolean,
        },
    },
    {
        collection: ORGANIZATION_COLLECTION,
        // Historical field name is updateAt (not updatedAt); preserve for existing documents.
        timestamps: { createdAt: true, updatedAt: 'updateAt' },
        versionKey: false,
    }
);

const ProgramModel =
    mongoose.models.Program || mongoose.model('Program', programSchema);

module.exports = ProgramModel;
