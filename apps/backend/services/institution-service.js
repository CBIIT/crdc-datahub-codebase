const {verifySession} = require("../verifier/user-info-verifier");
const {getListDifference} = require("../utility/list-util");
const {INSTITUTION} = require("../crdc-datahub-database-drivers/constants/organization-constants");
const {getCurrentTime} = require("../crdc-datahub-database-drivers/utility/time-utility");
const ERROR = require("../constants/error-constants");
const {ADMIN} = require("../crdc-datahub-database-drivers/constants/user-permission-constants");
const {replaceErrorString} = require("../utility/string-util");
const {UserScope} = require("../domain/user-scope");
const InstitutionDAO = require("../dao/institution");

class InstitutionService {
    /**
     * @param {object} authorizationService Authorization service for permission checks
     */
    constructor(authorizationService) {
        this.authorizationService = authorizationService;
        this.institutionDAO = new InstitutionDAO();
    }

    /**
     * @param {string} id Institution ID
     * @returns {Promise<object|null>}
     */
    async getInstitutionByID(id) {
        return await this.institutionDAO.findById(id);
    }

    async createInstitution(params, context) {
        verifySession(context)
            .verifyInitialized();
        const userScope = await this._getUserScope(context?.userInfo, ADMIN.MANAGE_INSTITUTIONS);
        if (userScope.isNoneScope()) {
            throw new Error(ERROR.VERIFY.INVALID_PERMISSION);
        }

        const newName = params?.name?.trim();
        if (newName === '') {
            throw new Error(ERROR.EMPTY_INSTITUTION_NAME);
        }

        const validStatus = [INSTITUTION.STATUSES.INACTIVE, INSTITUTION.STATUSES.ACTIVE];
        if (params?.status && !validStatus.includes(params?.status)) {
            throw new Error(replaceErrorString(ERROR.INVALID_INSTITUTION_STATUS, params?.status))
        }

        const institutions = await this.institutionDAO.findByCaseInsensitiveName(newName);
        if (institutions) {
            throw new Error(ERROR.DUPLICATE_INSTITUTION_NAME);
        }

        if (newName?.trim()?.length > 100) {
            throw new Error(ERROR.MAX_INSTITUTION_NAME_LIMIT);
        }

        const newInstitution = Institution.createInstitution(newName, params?.status);
        try {
            return await this.institutionDAO.create(newInstitution);
        } catch (error) {
            throw new Error(ERROR.FAILED_CREATE_INSTITUTION);
        }
    }

    /**
     * Returns all institution names as a string array.
     * @returns {Promise<string[]>}
     */
    async _listInstitutions() {
        const institutions = await this.institutionDAO.findAll();
        let institutionsArray = [];
        institutions.forEach(x => {
            if (x.name) {
                institutionsArray.push(x.name);
            }
        });
        return institutionsArray;
    }

    /**
     * Updates an institution document.
     *
     * @param {Object} params - The update parameters.
     * @param {string} params._id - The ID of the institution to update.
     * @param {string} [params.name] - The new name of the institution (optional).
     * @param {string} [params.status] - The new status of the institution (optional).
     * @param {Object} context - The request context containing session/user info for validation.
     * @returns {Promise<object>} - The updated institution document.
     * @throws {Error} - Throws if fails.
     */
    async updateInstitution(params, context) {
        verifySession(context)
            .verifyInitialized();
        const userScope = await this._getUserScope(context?.userInfo, ADMIN.MANAGE_INSTITUTIONS);
        if (userScope.isNoneScope()) {
            throw new Error(ERROR.VERIFY.INVALID_PERMISSION);
        }

        const {_id: institutionID, name, status} = params;
        const aInstitution = await this.getInstitutionByID(institutionID);
        await this._validateUpdateInstitution(aInstitution, institutionID, name, status);
        const [newName, newStatus] = [name?.trim() || aInstitution.name, status?.trim() || aInstitution.status];
        // no update
        if (newName === aInstitution.name && newStatus === aInstitution.status) {
            return aInstitution;
        }

        try {
            return await this.institutionDAO.update(institutionID, {
                name: newName,
                status: newStatus,
                updatedAt: getCurrentTime(),
            });
        } catch (error) {
            throw new Error(ERROR.FAILED_UPDATE_INSTITUTION);
        }
    }

    /**
     * Get an institution document.
     *
     * @param {Object} params - The graphql parameters.
     * @param {string} params._id - The ID of the institution.
     * @param {Object} context - The request context containing session/user info for validation.
     * @returns {Promise<object>} - The institution document.
     * @throws {Error} - Throws if fails.
     */
    async getInstitution(params, context) {
        verifySession(context)
            .verifyInitialized();
        const userScope = await this._getUserScope(context?.userInfo, ADMIN.MANAGE_INSTITUTIONS);
        if (userScope.isNoneScope()) {
            throw new Error(ERROR.VERIFY.INVALID_PERMISSION);
        }

        const {_id: institutionID} = params;
        const aInstitution= await this.getInstitutionByID(institutionID)
        if (!aInstitution) {
            throw new Error(replaceErrorString(ERROR.INSTITUTION_ID_NOT_EXIST, institutionID));
        }
        return aInstitution;
    }


    async _validateUpdateInstitution(currInstitution, institutionID, name, status) {
        if (!currInstitution) {
            throw new Error(replaceErrorString(ERROR.INSTITUTION_ID_NOT_EXIST, institutionID));
        }

        const trimmedName = name?.trim();
        if (trimmedName === '') {
            throw new Error(ERROR.EMPTY_INSTITUTION_NAME);
        }

        if (trimmedName?.length > 100) {
            throw new Error(ERROR.MAX_INSTITUTION_NAME_LIMIT);
        }

        if (trimmedName) {
            const existingInstitution = await this.institutionDAO.findByCaseInsensitiveName(trimmedName);
            const isDuplicate = (existingInstitution) && existingInstitution?._id !== institutionID
            if (isDuplicate) {
                throw new Error(ERROR.DUPLICATE_INSTITUTION_NAME);
            }
        }

        const validStatus = [INSTITUTION.STATUSES.INACTIVE, INSTITUTION.STATUSES.ACTIVE];
        if (status && !validStatus.includes(status)) {
            throw new Error(replaceErrorString(ERROR.INVALID_INSTITUTION_STATUS, status))
        }
    }

    async listInstitutions(params, context) {
        verifySession(context)
            .verifyInitialized();

        return await this.institutionDAO.listInstitution(params?.name, params?.offset, params?.first, params?.orderBy, params?.sortDirection, params?.status);
    }

    /**
     * Inserts institutions from an SRF that do not already exist by name.
     * @param {object[]} institutionList Institutions with id and name from the frontend
     * @returns {Promise<void>}
     */
    async addNewInstitutions(institutionList){
        try{
            const institutionNames = Array.from(new Set(institutionList
                .map(x => x?.name)
                .filter(Boolean) || []));
            if (institutionNames?.length > 0) {
                const existingInstitutions = await this._listInstitutions();
                const newInstitutionNames = getListDifference(institutionNames, existingInstitutions);
                if (newInstitutionNames.length > 0){
                    const newNameSet = new Set(newInstitutionNames);
                    const institutionsToCreate = institutionList.filter(
                        (institution) => institution?.name && newNameSet.has(institution.name)
                    );
                    const newInstitutions = createNewInstitutions(institutionsToCreate);
                    const insertResult = await this.institutionDAO.createMany(newInstitutions);
                    const insertedCount = insertResult?.count ?? 0;
                    if (insertedCount !== newInstitutions.length) {
                        throw new Error(`only ${insertedCount}/${newInstitutions.length} were created successfully`);
                    }
                    console.log(`${insertedCount} new institution(s) created in the database`)
                }
            }
        }
        catch (exception){
            console.error('An exception occurred while attempting to create new institutions: ', exception);
        }
    }

    async _getUserScope(userInfo, permission) {
        const validScopes = await this.authorizationService.getPermissionScope(userInfo, permission);
        const userScope = UserScope.create(validScopes);
        // valid scopes; none, all, role/role:RoleScope
        const isValidUserScope = userScope.isNoneScope() || userScope.isAllScope();
        if (!isValidUserScope) {
            console.warn(ERROR.INVALID_USER_SCOPE, permission);
            throw new Error(replaceErrorString(ERROR.INVALID_USER_SCOPE));
        }
        return userScope;
    }
}

/**
 * Builds institution documents for insert, preserving frontend-supplied IDs.
 * @param {object[]} institutionsList Institutions with id and name
 * @returns {object[]}
 */
function createNewInstitutions(institutionsList){
    let newInstitutions = [];
    institutionsList.forEach(institution => {
        const item = Institution.createInstitution(institution?.name, INSTITUTION.STATUSES.ACTIVE);
        // Created the MongoDB _id
        item._id = institution.id;
        newInstitutions.push(item);
    });
    return newInstitutions;
}


class Institution {
    constructor(name, status) {
        this.name = name;
        this.status = status;
        this.createdAt = this.updatedAt = getCurrentTime();
        this.submitterCount = 0;
    }

    static createInstitution(name, status) {
        return new Institution(name, status);
    }
}

module.exports = {
    InstitutionService
};
