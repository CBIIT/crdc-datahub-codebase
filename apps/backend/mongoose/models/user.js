const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');
const { USER_COLLECTION } = require('../../crdc-datahub-database-drivers/database-constants');

/**
 * Embedded institution info on a user document.
 */
const institutionInfoSchema = new mongoose.Schema(
    {
        _id: {
            type: String,
        },
        name: {
            type: String,
        },
        status: {
            type: String,
        },
    },
    {
        versionKey: false,
    }
);

/**
 * Embedded study reference on a user document (Approved study ID only).
 */
const studyByIDSchema = new mongoose.Schema(
    {
        _id: {
            type: String,
        },
    },
    {
        versionKey: false,
    }
);

/**
 * Embedded organization (program) info historically stored on user documents.
 */
const userOrganizationSchema = new mongoose.Schema(
    {
        orgID: {
            type: String,
        },
        orgName: {
            type: String,
        },
        updateAt: {
            type: Date,
        },
    },
    {
        _id: false,
        versionKey: false,
    }
);

/**
 * Mongoose schema for users, matching the Prisma User model plus historical organization.
 */
const userSchema = new mongoose.Schema(
    {
        _id: {
            type: String,
            default: () => uuidv4(),
        },
        IDP: {
            type: String,
            required: true,
        },
        dataCommons: {
            type: [String],
            default: undefined,
        },
        email: {
            type: String,
            required: true,
        },
        firstName: {
            type: String,
            required: true,
        },
        institution: {
            type: institutionInfoSchema,
        },
        lastName: {
            type: String,
            required: true,
        },
        fullName: {
            type: String,
        },
        notifications: {
            type: [String],
            default: undefined,
        },
        permissions: {
            type: [String],
            default: undefined,
        },
        role: {
            type: String,
            required: true,
        },
        status: {
            type: String,
        },
        studies: {
            type: [studyByIDSchema],
            default: undefined,
        },
        tokens: {
            type: [String],
            default: undefined,
        },
        userStatus: {
            type: String,
            required: true,
        },
        organization: {
            type: userOrganizationSchema,
        },
    },
    {
        collection: USER_COLLECTION,
        // Historical field name is updateAt (not updatedAt); preserve for existing documents.
        timestamps: { createdAt: true, updatedAt: 'updateAt' },
        versionKey: false,
    }
);

const UserModel = mongoose.models.User || mongoose.model('User', userSchema);

module.exports = UserModel;
