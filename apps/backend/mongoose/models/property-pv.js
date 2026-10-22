const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');
const { PROPERTY_PVS_COLLECTION } = require('../../crdc-datahub-database-drivers/database-constants');

/**
 * Mongoose schema for propertyPVs, for the PropertyPVs collection.
 * BSON field PermissibleValues matches existing/validator-written documents.
 */
const propertyPVSchema = new mongoose.Schema(
    {
        _id: {
            type: String,
            default: () => uuidv4(),
        },
        property: {
            type: String,
            required: true,
        },
        model: {
            type: String,
            required: true,
        },
        version: {
            type: String,
            required: true,
        },
        PermissibleValues: {
            type: [String],
            default: undefined,
        },
        createdAt: {
            type: Date,
        },
        updatedAt: {
            type: Date,
        },
    },
    {
        collection: PROPERTY_PVS_COLLECTION,
        timestamps: false,
        versionKey: false,
    }
);

const PropertyPVModel = mongoose.models.PropertyPV || mongoose.model('PropertyPV', propertyPVSchema);

module.exports = PropertyPVModel;
