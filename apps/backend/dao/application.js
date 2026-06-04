const prisma = require("../prisma");
const { MODEL_NAME, SORT} = require('../constants/db-constants');
const GenericDAO = require("./generic");
const {convertIdFields, convertMongoFilterToPrismaFilter, nullOrMissingMongoCondition, handleDotNotation, toPrismaApplicationUpdateData} = require('./utils/orm-converter');

const {getCurrentTime, subtractDaysFromNow} = require("../crdc-datahub-database-drivers/utility/time-utility");
const {NEW, IN_PROGRESS, INQUIRED, REOPENED, APPROVED} = require("../constants/application-constants");
const ERROR = require("../constants/error-constants");

class ApplicationDAO extends GenericDAO {
    constructor(applicationCollection) {
        super(MODEL_NAME.APPLICATION);
        this.applicationCollection = applicationCollection;
    }
    // Prisma can't join _id in the object.
    async updateApplicationOrg(orgID, updatedOrg){
        return await this.applicationCollection.updateMany(
            {"organization._id": orgID, "organization.name": {"$ne": updatedOrg.name}},
            {"organization.name": updatedOrg.name, updatedAt: getCurrentTime()}
        )
    }

    async insert(application) {
        const createdData = convertIdFields(application);
        const created = await this.create(createdData);
        return { acknowledged: !!created, insertedId: created.id };
    }

    async update(application) {
        // check if _id or id is present
        if (!application._id && !application.id) {
            throw new Error('Application must have an _id or id');
        }
        const prismaData = toPrismaApplicationUpdateData(application);
        return await super.update(application._id ?? application.id, prismaData);
    }

    async updateMany(filter, data) {
        // Prisma expects a plain object for update, not MongoDB-style operators
        const updateDoc = Array.isArray(data)
            ? Object.assign({}, ...data)
            : data;

        filter = convertMongoFilterToPrismaFilter(filter);
        const result = await prisma.application.updateMany({
            where: filter,
            data: updateDoc
        });
        return { matchedCount: result.count, modifiedCount: result.count };
    }


    /**
     * Find the previous submission request by ID
     * @param {string} id The ID of the submission request
     * @returns {Promise<object|null>} The previous submission request, or null when id is falsy or no predecessor exists.
     * Does not filter by predecessor status (used on revision re-approval).
     */
    async findPreviousSubmissionRequestByID(id) {
        if (!id) {
            return null;
        }
        return this.findFirst({ nextRevisionId: id });
    }

    /**
     * Clear nextRevisionId on any application pointing at the given successor (revision chain prune).
     * @param {string} applicationId Terminal or removed successor application _id
     * @returns {Promise<{ matchedCount: number, modifiedCount: number }>}
     */
    async clearNextRevisionIdPointingTo(applicationId) {
        if (!applicationId) {
            return { matchedCount: 0, modifiedCount: 0 };
        }
        return this.updateMany(
            { nextRevisionId: applicationId },
            { nextRevisionId: null, updatedAt: getCurrentTime() }
        );
    }

    /**
     * Insert a new reopened application and update the approved predecessor, rollback if the insert fails.
     * @param {string} sourceId Approved application _id
     * @param {object} newApp Full successor document (must include _id)
     * @returns {Promise<object>} The inserted application document
     */
    async reopenApprovedRevision(sourceId, newApp) {
        const timestamp = newApp.updatedAt ?? getCurrentTime();

        const linkResult = await this.updateMany(
            { _id: sourceId, status: APPROVED, ...nullOrMissingMongoCondition('nextRevisionId') },
            { nextRevisionId: newApp._id, updatedAt: timestamp }
        );

        if (linkResult?.modifiedCount !== 1) {
            throw new Error(ERROR.VERIFY.INVALID_STATE_APPLICATION);
        }

        try {
            const insertResult = await this.insert(newApp);
            if (!insertResult?.acknowledged) {
                throw new Error(ERROR.UPDATE_FAILED);
            }
            return { ...newApp };
        } catch (error) {
            try {
                await this.updateMany(
                    { _id: sourceId },
                    { nextRevisionId: null, updatedAt: getCurrentTime() }
                );
            } catch (compensateError) {
                console.error('Failed to compensate nextRevisionId after reopen insert failure:', compensateError);
            }
            throw error;
        }
    }

    async getInactiveApplication(inactiveDays, inactiveFlagField) {
        try {
            const applications = await prisma.application.findMany({
                where: {
                    updatedAt: {
                        lt: subtractDaysFromNow(inactiveDays),
                    },
                    status: {
                        in: [NEW, IN_PROGRESS, INQUIRED, REOPENED]
                    },
                    // Tracks whether the notification has already been sent
                    ...(inactiveFlagField ? {[inactiveFlagField]: {not: true}} : {})
                },
                include: {
                    applicant: true,
                }
            });
            return applications.map(item => ({
                ...item,
                ...(item.id ? { _id: item.id } : {}),
                ...(item?.applicant ? {
                    applicant: {
                        ...item?.applicant,
                        applicantID: item?.applicant?.id || "",
                        applicantName: item?.applicant?.fullName || "",
                        applicantEmail: item?.applicant?.email || ""
                    }
                }
                : {}),
            }));
        } catch (error) {
            console.error('Error getting getInactiveApplication:', error);
            return [];
        }
    }
}

module.exports = ApplicationDAO;