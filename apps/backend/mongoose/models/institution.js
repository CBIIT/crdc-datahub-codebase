const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');
const { INSTITUTION_COLLECTION } = require('../../crdc-datahub-database-drivers/database-constants');

/**
 * Mongoose schema for institutions, for the Institution collection.
 */
const institutionSchema = new mongoose.Schema(
    {
        _id: {
            type: String,
            default: () => uuidv4(),
        },
        name: {
            type: String,
            required: true,
        },
        status: {
            type: String,
            required: true,
        },
        submitterCount: {
            type: Number,
        },
        createdAt: {
            type: Date,
        },
        updatedAt: {
            type: Date,
        },
    },
    {
        collection: INSTITUTION_COLLECTION,
        timestamps: false,
        versionKey: false,
    }
);

const InstitutionModel =
    mongoose.models.Institution || mongoose.model('Institution', institutionSchema);

module.exports = InstitutionModel;
