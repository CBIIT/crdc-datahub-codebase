const {ERROR} = require("../constants/error-constants");
const {USER} = require("../constants/user-constants");
const {ORGANIZATION} = require("../constants/organization-constants");
const {getCurrentTime} = require("../utility/time-utility");
const {getDataCommonsDisplayNamesForUserOrganization} = require("../../utility/data-commons-remapper");
const {replaceErrorString} = require("../../utility/string-util");
const ProgramDAO = require("../../dao/program");
const SubmissionDAO = require("../../dao/submission");
const UserDAO = require("../../dao/user");
const ApplicationDAO = require("../../dao/application");
const ApprovedStudyDAO = require("../../dao/approvedStudy");

class Organization {
  _ALL = "All";
  _READ_ONLY_FIELDS = ["name", "abbreviation", "description", "status"];

  constructor(organizationCollection, userCollection, submissionCollection, applicationCollection, approvedStudiesCollection) {
    this.organizationCollection = organizationCollection;
    this.programDAO = new ProgramDAO(organizationCollection);
    this.approvedStudyDAO = new ApprovedStudyDAO(approvedStudiesCollection);
    this.submissionDAO = new SubmissionDAO(submissionCollection);
    this.userDAO = new UserDAO(userCollection);
    this.applicationDAO = new ApplicationDAO(applicationCollection);
  }

  /**
   * Get Organization by ID API Interface.
   * @api
   * @param {{ orgID: string }} params Endpoint parameters
   * @param {{ cookie: Object, userInfo: Object }} context API request context
   * @returns {Promise<Object | null>} The organization with the given `orgID` or null if not found
   */
  async getOrganizationAPI(params, context) {
    if (!context?.userInfo?.email || !context?.userInfo?.IDP) {
      throw new Error(ERROR.NOT_LOGGED_IN);
    }

    if (!params?.orgID) {
      throw new Error(ERROR.INVALID_ORG_ID);
    }

    let userOrganization = await this.getOrganizationByID(params.orgID, true);
    return getDataCommonsDisplayNamesForUserOrganization(userOrganization);
  }

  /**
   * Get an organization by it's `_id`
   *
   * @async
   * @param {string} id The UUID of the organization to search for
   * @param {boolean} includeStudiesList When true, loads related approved studies (e.g. getOrganization). Pass false when studies are not needed.
   * @returns {Promise<Object | null>} The organization with the given `id` or null if not found
   */
  async getOrganizationByID(id, includeStudiesList) {
    if (typeof includeStudiesList !== 'boolean') {
      throw new Error(ERROR.INVALID_INCLUDE_STUDIES_LIST_ARGUMENT);
    }
    if (!id) {
      return null;
    }
    return await this.programDAO.getOrganizationByID(id, includeStudiesList);
  }

  /**
   * List Programs API Interface.
   *
   * Any authenticated users can retrieve all organizations, no matter what role a user has or what organization a user is associated with.
   *
   * @api
   * @param { first: Integer, offset: Integer, orderBy: String, sortDirection: String, status: String } params Endpoint parameters
   * @param {{ cookie: Object, userInfo: Object }} context request context
   * @returns {Promise<Object>} Total and an array of Programs
   */
  async listPrograms(params, context) {
    if (!context?.userInfo?.email || !context?.userInfo?.IDP) {
      throw new Error(ERROR.NOT_LOGGED_IN)
    }
    const {first, offset, orderBy, sortDirection, status: statusRaw} = params;
    let status = statusRaw;
    if (status === undefined || status === null || (typeof status === "string" && status.trim() === "")) {
      status = this._ALL;
    }
    const normalizedStatus = String(status).trim().toLowerCase();
    let statusCondition;
    if (normalizedStatus === this._ALL.toLowerCase()) {
      statusCondition = {status: {$in: [ORGANIZATION.STATUSES.ACTIVE, ORGANIZATION.STATUSES.INACTIVE]}};
    } else if (normalizedStatus === ORGANIZATION.STATUSES.ACTIVE.toLowerCase()) {
      statusCondition = {status: ORGANIZATION.STATUSES.ACTIVE};
    } else if (normalizedStatus === ORGANIZATION.STATUSES.INACTIVE.toLowerCase()) {
      statusCondition = {status: ORGANIZATION.STATUSES.INACTIVE};
    } else {
      throw new Error(
        replaceErrorString(ERROR.INVALID_PROGRAM_STATUS, String(params?.status ?? "").trim() || normalizedStatus)
      );
    }

    const programList = await this.programDAO.listPrograms(first, offset, orderBy, sortDirection, statusCondition);
    return {
      total: programList?.total || 0,
      programs: programList?.results?.map((program) => {
        return getDataCommonsDisplayNamesForUserOrganization(program);
      }) || []
    };
  }

  /**
   * Edit Organization API Interface.
   * @api
   * @param {EditOrganizationInput} params Endpoint parameters
   * @param {{ cookie: Object, userInfo: Object }} context API request context
   * @returns {Promise<Object>} The modified organization
   */
  async editOrganizationAPI(params, context) {
    if (!context?.userInfo?.email || !context?.userInfo?.IDP) {
      throw new Error(ERROR.NOT_LOGGED_IN);
    }

    if (!params?.orgID) {
      throw new Error(ERROR.INVALID_ORG_ID);
    }

    await this.editOrganization(params.orgID, params);
    const userOrganization = await this.getOrganizationByID(params.orgID, true);
    return getDataCommonsDisplayNamesForUserOrganization(userOrganization);
  }

  /**
   * Edit an organization by it's `_id` and a set of parameters
   *
   * @async
   * @typedef {{ orgID: string, name: string, conciergeID: string, status: string }} EditOrganizationInput
   * @throws {Error} If the organization is not found or the update fails
   * @param {string} orgID The ID of the organization to edit
   * @param {EditOrganizationInput} params The organization input
   * @returns {Promise<Object>} The modified organization
   */
  async editOrganization(orgID, params) {
    const currentOrg = await this.getOrganizationByID(orgID, false);
    if (!currentOrg) {
      throw new Error(ERROR.ORG_NOT_FOUND);
    }
    if (this.checkForReadOnlyViolation(currentOrg, params)) {
      throw new Error(ERROR.CANNOT_UPDATE_READ_ONLY_PROGRAM);
    }
    const updatedOrg = {updateAt: getCurrentTime()};

    const attemptingToSetInactive =
      typeof params?.status === "string" && params.status === ORGANIZATION.STATUSES.INACTIVE;

    if (!currentOrg?.abbreviation && !params?.abbreviation?.trim()) {
      throw new Error(ERROR.ORGANIZATION_INVALID_ABBREVIATION);
    }

    if (attemptingToSetInactive) {
      const studyCount = await this.approvedStudyDAO.count({ programID: orgID });
      if (studyCount > 0) {
        throw new Error(ERROR.PROGRAM_CANNOT_INACTIVATE_WITH_STUDIES);
      }
    }

    if (typeof params?.name === "string") {
      const trimmedName = params.name.trim();
      if (
        trimmedName &&
        trimmedName.toLowerCase() !== currentOrg.name?.toLowerCase()
      ) {
        const existingOrg = await this.getOrganizationByName(trimmedName);
        if (existingOrg) {
          throw new Error(ERROR.DUPLICATE_ORG_NAME);
        }
        updatedOrg.name = trimmedName;
      }
    }

    const conciergeProvided = typeof params.conciergeID !== "undefined";
    // Only update the concierge if it is provided and different from the currently assigned concierge
    if (conciergeProvided && !!params.conciergeID && params.conciergeID !== currentOrg.conciergeID) {
      const conciergeUser = await this.userDAO.findFirst({
          id: params.conciergeID, // assuming _id maps to Prisma's `id`
          role: USER.ROLES.DATA_COMMONS_PERSONNEL,
          userStatus: USER.STATUSES.ACTIVE,
      });

      if (!conciergeUser) {
        throw new Error(ERROR.INVALID_ROLE_ASSIGNMENT);
      }
      updatedOrg.conciergeID = params.conciergeID;
      updatedOrg.conciergeName = `${conciergeUser.firstName} ${conciergeUser.lastName}`.trim();
      updatedOrg.conciergeEmail = conciergeUser.email;
      // Only remove the concierge if it is purposely set to null and there is a currently assigned concierge
    } else if (conciergeProvided && !params.conciergeID && !!currentOrg.conciergeID) {
      updatedOrg.conciergeID = null;
      updatedOrg.conciergeName = null;
      updatedOrg.conciergeEmail = null;
    }

    if (params.status && Object.values(ORGANIZATION.STATUSES).includes(params.status)) {
      updatedOrg.status = params.status;
    }

    if (params?.abbreviation?.trim()) {
      updatedOrg.abbreviation = params.abbreviation.trim();
    }

    if (params?.description?.trim() || params?.description?.trim() === "") {
      updatedOrg.description = params.description.trim();
    }

    const updateResult = await this.programDAO.updateMany(
        {id: orgID},
      updatedOrg, // only these fields will be changed
    );

    if (!updateResult) {
      throw new Error(ERROR.UPDATE_FAILED);
    }

    if (updatedOrg.name || updatedOrg?.abbreviation) {
      const promises = [];
      if (updatedOrg.name) {
        promises.push(
            this.userDAO.updateUserOrg(orgID, updatedOrg)
        );
        promises.push(
            this.applicationDAO.updateApplicationOrg(orgID, updatedOrg)
        );
      }

      const [updateUser, updatedApplication] = await Promise.all(promises);

      if (updatedOrg.name && !updateUser?.acknowledged) {
        console.error("Failed to update the organization name in users");
      }

      if (updatedOrg.name && !updatedApplication?.acknowledged) {
        console.error("Failed to update the organization name in submission requests");
      }
    }

    return { ...currentOrg, ...updatedOrg };
  }


  // If data concierge is not available in the submission,
  // It will update the conciergeName/conciergeEmail at the program level if available.
  async _updatePrimaryContact(studyIDs, conciergeID) {
    const programLevelSubmissions = await this.submissionDAO.programLevelSubmissions(studyIDs);
    const submissionIDs = programLevelSubmissions?.map((s) => s?._id);
    if (submissionIDs?.length > 0) {
      const updateSubmission = await this.submissionDAO.updateMany(
          {
            id: { in: submissionIDs }, // assuming `_id` maps to `id`
            conciergeID: { not: conciergeID},
          },
          {
            conciergeID: conciergeID,
            updatedAt: getCurrentTime(),
          }
      )
      if (!(updateSubmission?.count >= 0)) {
        console.error("Failed to update the data concierge in submissions at program level");
      }
    }
  }

  /**
   * Get an organization by it's name
   *
   * @async
   * @param {string} name The name of the organization to search for
   * @param {boolean} [omitStudyLookup] Whether to omit the study lookup in the pipeline. Default is true
   * @returns {Promise<Object | null>} The organization with the given `name` or null if not found
   */
  async getOrganizationByName(name) {
    return await this.programDAO.getOrganizationByName(name);
  }

  /**
   * Create an Organization API Interface.
   * @api
   * @param {CreateOrganizationInput} params Endpoint parameters
   * @param {{ cookie: Object, userInfo: Object }} context API request context
   * @returns {Promise<Object>} The created organization
   */
  async createOrganizationAPI(params, context) {
    if (!context?.userInfo?.email || !context?.userInfo?.IDP) {
      throw new Error(ERROR.NOT_LOGGED_IN);
    }

    if (!params?.abbreviation?.trim()) {
      throw new Error(ERROR.ORGANIZATION_INVALID_ABBREVIATION);
    }

    const created = await this.createOrganization(params);
    const userOrganization =
      (await this.getOrganizationByID(created?._id, true)) ?? created;
    return getDataCommonsDisplayNamesForUserOrganization(userOrganization);
  }

  /**
   * Create a new Organization
   *
   * @async
   * @typedef {{ name: string, conciergeID?: string }} CreateOrganizationInput
   * @throws {Error} If the organization name is already taken or the create action fails
   * @param {CreateOrganizationInput} params The organization input
   * @returns {Promise<Object>} The newly created organization
   */
  async createOrganization(params) {
    const newOrg = {
      abbreviation: params.abbreviation?.trim(),
      ...((params?.description || params?.description?.trim() === "") && {description: params.description.trim()})
    }

    if (!!params?.name?.trim()) {
      const existingOrg = await this.getOrganizationByName(params.name);
      if (existingOrg) {
        throw new Error(ERROR.DUPLICATE_ORG_NAME);
      }
      newOrg.name = params.name;
    } else {
      throw new Error(ERROR.INVALID_ORG_NAME);
    }

    if (!!params?.conciergeID) {
      const conciergeUser = await this.userDAO.findFirst({
          _id: params.conciergeID,
          role: USER.ROLES.DATA_COMMONS_PERSONNEL,
          userStatus: USER.STATUSES.ACTIVE
      });

      if (!conciergeUser) {
        throw new Error(ERROR.INVALID_ROLE_ASSIGNMENT);
      }
      newOrg.conciergeID = params.conciergeID;
      newOrg.conciergeName = `${conciergeUser.firstName} ${conciergeUser.lastName}`.trim();
      newOrg.conciergeEmail = conciergeUser.email;
    }

    const newProgram = ProgramData.create(newOrg.name, newOrg.conciergeID, newOrg.conciergeName, newOrg.conciergeEmail, newOrg.abbreviation, newOrg?.description)
    const res = await this.programDAO.create(newProgram);

    if (!res) {
      throw new Error(ERROR.CREATE_FAILED);
    }

    return res;
  }

  async upsertByProgramName(programName, abbreviation, description) {
    const newProgram = ProgramData.create(programName, "", "", "", abbreviation, description)
    const res = await this.organizationCollection.findOneAndUpdate({name: programName}, newProgram, {
      returnDocument: 'after',
      upsert: true
    });
    if (!res?.value) {
      console.error(`Failed to insert a new program: ${programName}`);
    }
    return res.value;
  }

  /**
   * Find One Organization by a program name.
   * @api
   * @param {string} programName
   * @returns {Promise<Organization|null>} A single Organization or null if not found
   */
  async findOneByProgramName(programName) {
    const results = await this.organizationCollection.aggregate([{"$match": {
      $expr: {
          $eq: [
            { $toLower: "$name" },
            programName?.trim()?.toLowerCase()
          ]
      }
    }}, {"$limit": 1}]);
    return results?.length > 0 ? results[0] : null;
  }

  /**
   * Find One Organization/Program by Study ID using the new programID reference model.
   * @api
   * @param {string} studyID
   * @returns {Promise<Object|null>} The organization/program or null if not found
   */
  async findOneByStudyID(studyID) {
    // Get the approved study first to find its programID
    const approvedStudy = await this.approvedStudyDAO.findFirst({ id: studyID?.trim() });
    if (!approvedStudy?.programID) {
      return null;
    }
    
    // Get the program by programID
    return await this.getOrganizationByID(approvedStudy?.programID, false);
  }

  /**
   * Checks if the target organization/program has a read only flag set and if the update parameters violate the
   * violate this read only protection.
   * @param organization the target organization/program
   * @param params the update parameters
   * @returns {*|boolean} true if a read only violation is detected
   */
  checkForReadOnlyViolation(organization, params) {
    if (organization?.readOnly) {
      for (const key of this._READ_ONLY_FIELDS) {
        if (!!params?.[key] && params?.[key] !== organization?.[key]) {
          return true;
        }
      }
    }
    return false;
  }
}

class ProgramData {
  constructor(name, conciergeID, conciergeName, conciergeEmail, abbreviation, description) {
    this.name = name;
    this.status = ORGANIZATION.STATUSES.ACTIVE;
    this.conciergeID = conciergeID ? conciergeID : "";
    this.conciergeName = conciergeName ? conciergeName : "";
    this.conciergeEmail = conciergeEmail ? conciergeEmail : "";
    if (abbreviation) {
      this.abbreviation = abbreviation;
    }
    if (description) {
      this.description = description;
    }
    this.createdAt = getCurrentTime();
    this.updateAt = getCurrentTime();
  }

  static create(name, conciergeID, conciergeName, conciergeEmail, abbreviation, description) {
    return new ProgramData(name, conciergeID, conciergeName, conciergeEmail, abbreviation, description);
  }
}

module.exports = {
  Organization
};
