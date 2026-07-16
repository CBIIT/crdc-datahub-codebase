const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');
const { PENDING_PVS_COLLECTION } = require('../../crdc-datahub-database-drivers/database-constants');

/**
 * Mongoose schema for pendingPvs, matching the Prisma PendingPVs model.
 */
const pendingPVSchema = new mongoose.Schema(
    {
        _id: {
            type: String,
            default: () => uuidv4(),
        },
        submissionID: {
            type: String,
            required: true,
            index: true,
        },
        offendingProperty: {
            type: String,
            required: true,
        },
        value: {
            type: String,
            required: true,
        },
        createdAt: {
            type: Date,
        },
        updatedAt: {
            type: Date,
        },
    },
    {
        collection: PENDING_PVS_COLLECTION,
        timestamps: false,
        versionKey: false,
    }
);

const PendingPVModel = mongoose.models.PendingPV || mongoose.model('PendingPV', pendingPVSchema);

module.exports = PendingPVModel;
