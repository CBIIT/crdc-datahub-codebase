const prisma = require("../prisma");
const { MODEL_NAME, SORT} = require('../constants/db-constants');
const GenericDAO = require("./generic");
const {convertIdFields, convertMongoFilterToPrismaFilter, handleDotNotation, toPrismaApplicationUpdateData} = require('./utils/orm-converter');

const {getCurrentTime, subtractDaysFromNow} = require("../crdc-datahub-database-drivers/utility/time-utility");
const {NEW, IN_PROGRESS, INQUIRED, REOPENED, APPROVED} = require("../constants/application-constants");
const ERROR = require("../constants/error-constants");

class ApplicationDAO extends GenericDAO {
    constructor(applicationCollection) {
        super(MODEL_NAME.APPLICATION);
        this.applicationCollection = applicationCollection;
    }

    /**
     * @param {object|null} row Prisma application row
     * @returns {object|null}
     */
    _mapApplicationRow(row) {
        if (!row) {
            return null;
        }
        return { ...row, _id: row.id };
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
     * Find the Approved parent SRF that links to this application via nextRevisionId.
     * Only Approved rows receive nextRevisionId (set on reopen); this is the revision-chain parent lookup.
     * @param {string} id Successor application _id
     * @returns {Promise<object|null>} Approved parent, or null when id is falsy or no match
     */
    async findApprovedParentSubmissionRequestByID(id) {
        if (!id) {
            return null;
        }
        const row = await prisma.application.findFirst({
            where: { nextRevisionId: id, status: APPROVED },
        });
        return this._mapApplicationRow(row);
    }

    /**
     * Load status for a single application by id.
     * @param {string} id Application _id
     * @returns {Promise<{ status: string }|null>}
     */
    async findApplicationStatusById(id) {
        if (!id) {
            return null;
        }
        return prisma.application.findFirst({
            where: { id },
            select: { status: true },
        });
    }

    /**
     * Load id and status for applications matching the given ids.
     * @param {string[]} ids Application _ids
     * @returns {Promise<object[]>} Rows with id/_id and status
     */
    async findApplicationStatusesByIds(ids) {
        if (!ids?.length) {
            return [];
        }
        const rows = await prisma.application.findMany({
            where: { id: { in: ids } },
            select: { id: true, status: true },
        });
        return rows.map((row) => ({ ...row, _id: row.id }));
    }

    /**
     * Find Approved applications whose nextRevisionId matches any of the given ids.
     * @param {string[]} nextRevisionIds Application _ids referenced by nextRevisionId
     * @returns {Promise<object[]>} Rows with nextRevisionId
     */
    async findApprovedApplicationsByNextRevisionIds(nextRevisionIds) {
        if (!nextRevisionIds?.length) {
            return [];
        }
        return prisma.application.findMany({
            where: { nextRevisionId: { in: nextRevisionIds }, status: APPROVED },
            select: { nextRevisionId: true },
        });
    }

    /**
     * Load an application with applicant fields for API responses.
     * @param {string} id Application _id
     * @returns {Promise<object|null>}
     */
    async findApplicationWithApplicantById(id) {
        if (!id) {
            return null;
        }
        const row = await prisma.application.findFirst({
            where: { id },
            include: {
                applicant: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        fullName: true,
                        email: true,
                    },
                },
            },
        });
        return this._mapApplicationRow(row);
    }

    /**
     * Most recent Approved application for an applicant.
     * @param {string} applicantID Applicant user _id
     * @returns {Promise<object|null>}
     */
    async findLatestApprovedByApplicantID(applicantID) {
        if (!applicantID) {
            return null;
        }
        const row = await prisma.application.findFirst({
            where: { applicantID, status: APPROVED },
            orderBy: { createdAt: 'desc' },
        });
        return this._mapApplicationRow(row);
    }

    /**
     * Clear nextRevisionId on any application pointing at the given successor (revision chain link removal).
     * @param {string} applicationId Successor application _id whose inbound nextRevisionId link should be cleared
     * @returns {Promise<{ matchedCount: number, modifiedCount: number }>}
     */
    async clearNextRevisionIdPointingTo(applicationId) {
        if (!applicationId) {
            return { matchedCount: 0, modifiedCount: 0 };
        }
        const result = await prisma.application.updateMany({
            where: { nextRevisionId: applicationId },
            data: { nextRevisionId: null, updatedAt: getCurrentTime() },
        });
        return { matchedCount: result.count, modifiedCount: result.count };
    }

    /**
     * Insert a new reopened application and update the approved predecessor, rollback if the insert fails.
     * @param {string} sourceId Approved application _id
     * @param {object} newApp Full successor document (must include _id)
     * @param {boolean} [replaceExistingLink=false] When true, overwrite an existing nextRevisionId on the source
     * @returns {Promise<object>} The inserted application document
     */
    async reopenApprovedRevision(sourceId, newApp, replaceExistingLink = false) {
        const timestamp = newApp.updatedAt ?? getCurrentTime();

        let previousNextRevisionID = null;
        if (replaceExistingLink) {
            const source = await prisma.application.findFirst({
                where: { id: sourceId },
                select: { nextRevisionId: true },
            });
            previousNextRevisionID = source?.nextRevisionId ?? null;
        }

        const linkWhere = replaceExistingLink
            ? { id: sourceId, status: APPROVED }
            : { id: sourceId, status: APPROVED, nextRevisionId: null };

        const linkResult = await prisma.application.updateMany({
            where: linkWhere,
            data: { nextRevisionId: newApp._id, updatedAt: timestamp },
        });

        if (linkResult?.count !== 1) {
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
                await prisma.application.updateMany({
                    where: { id: sourceId },
                    data: {
                        nextRevisionId: replaceExistingLink ? previousNextRevisionID : null,
                        updatedAt: getCurrentTime(),
                    },
                });
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
