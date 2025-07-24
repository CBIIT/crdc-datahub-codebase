const {ERROR} = require("../constants/error-constants");
const {USER} = require("../constants/user-constants");
const {ORGANIZATION, NA_PROGRAM} = require("../constants/organization-constants");
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

    let userOrganization = await this.getOrganizationByID(params.orgID, false);
    return getDataCommonsDisplayNamesForUserOrganization(userOrganization);
  }

  /**
   * Get an organization by it's `_id`
   *
   * @async
   * @param {string} id The UUID of the organization to search for
   * @param {boolean} [omitStudyLookup] Whether to omit the study lookup in the pipeline. For backward compatibility, default is false.
   * @returns {Promise<Object | null>} The organization with the given `id` or null if not found
   */
  async getOrganizationByID(id, omitStudyLookup = false) {
    return await this.programDAO.getOrganizationByID(id, omitStudyLookup);
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
    const {first, offset, orderBy, sortDirection, status} = params;
    const validStatuses = [ORGANIZATION.STATUSES.ACTIVE, ORGANIZATION.STATUSES.INACTIVE];
    if (status !== this._ALL && !validStatuses.includes(status)) {
      throw new Error(replaceErrorString(ERROR.INVALID_PROGRAM_STATUS, status));
    }

    const statusCondition = status && status !== this._ALL ?
      {status: status} : {status: {$in: validStatuses}};

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

    let userOrganization = await this.editOrganization(params.orgID, params);
    return getDataCommonsDisplayNamesForUserOrganization(userOrganization);
  }

  /**
   * Edit an organization by it's `_id` and a set of parameters
   *
   * @async
   * @typedef {{ orgID: string, name: string, conciergeID: string, studies: Object[], status: string }} EditOrganizationInput
   * @throws {Error} If the organization is not found or the update fails
   * @param {string} orgID The ID of the organization to edit
   * @param {EditOrganizationInput} params The organization input
   * @returns {Promise<Object>} The modified organization
   */
  async editOrganization(orgID, params) {
    const currentOrg = await this.getOrganizationByID(orgID);
    // Check for read-only violation
    if (this.checkForReadOnlyViolation(currentOrg, params)) {
      throw new Error(ERROR.CANNOT_UPDATE_READ_ONLY_PROGRAM);
    }
    const updatedOrg = {updateAt: getCurrentTime()};
    if (!currentOrg) {
      throw new Error(ERROR.ORG_NOT_FOUND);
    }

    if (!currentOrg?.abbreviation && !params?.abbreviation?.trim()) {
      throw new Error(ERROR.ORGANIZATION_INVALID_ABBREVIATION);
    }

    if (params.name && params.name !== currentOrg.name) {
      const existingOrg = await this.getOrganizationByName(params.name);
      if (existingOrg) {
        throw new Error(ERROR.DUPLICATE_ORG_NAME);
      }
      updatedOrg.name = params.name;
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

    if (params.studies && Array.isArray(params.studies)) {
      updatedOrg.studies = await this._getApprovedStudies(params.studies);
    } else {
      updatedOrg.studies = [];
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

    // prisma can't return _id should be mapped
    if (updatedOrg.studies?.length > 0) {
      updatedOrg.studies = updatedOrg.studies.map(study => ({
        ...study,
        _id: study?.id
      }));
    }

    if (!updateResult) {
      throw new Error(ERROR.UPDATE_FAILED);
    }

    // If data concierge is not available in approved studies, the provided data concierge should be updated in the data submissions.
    if (updatedOrg.studies?.length > 0) {
      const conciergeID = updatedOrg?.conciergeID || currentOrg?.conciergeID;
      const studyIDs = updatedOrg?.studies.map(study => study?._id);
      if (conciergeID && updatedOrg?.conciergeID !== null) {
        const primaryContact = await this.userDAO.findFirst({
            id: conciergeID, role: USER.ROLES.DATA_COMMONS_PERSONNEL, userStatus: USER.STATUSES.ACTIVE
        });

        if (primaryContact) {
          const {firstName, lastName, email: conciergeEmail} = primaryContact;
          await this._updatePrimaryContact(studyIDs, `${firstName} ${lastName}`?.trim(), conciergeEmail);
        }
      } else if (conciergeProvided && params?.conciergeID === null) {
        // Removing the data concierge from the program.
        await this._updatePrimaryContact(studyIDs, "", "");
      }
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
    // Skip removing the studies from the NA program if the NA program is the one being edited
    if (currentOrg.name !== NA_PROGRAM){
      await this._checkRemovedStudies(currentOrg.studies, updatedOrg.studies);
      await this._updateOrganizationInSubmissions(currentOrg._id, updatedOrg.studies);
    }
    return { ...currentOrg, ...updatedOrg };
  }

  /**
   * _checkRemovedStudies: private method to check removed studies
   * @param {*} existingStudies
   * @param {*} updatedStudies
   */
  async _checkRemovedStudies(existingStudies, updatedStudies){
    if (!updatedStudies || updatedStudies.length === 0) {
      return;
    }
    const updatedStudyIds = updatedStudies.map(study => study._id);
    const naOrg = await this.getOrganizationByName(NA_PROGRAM);
    if (!naOrg || !naOrg?._id) {
      console.error("NA program not found");
      return
    }
    const naOrgStudies = naOrg.studies;
    let changed = false;
    // remove updated studyID from NA program since they are added to the edited org.
    const filteredStudies = naOrgStudies.filter(study => !updatedStudyIds.includes(study._id));
    const newOrphanedStudyIDs = [];
    changed = (filteredStudies.length !== naOrgStudies.length);
    if (existingStudies && existingStudies.length > 0) {
      const existingStudyIds = existingStudies.map(study => study._id);
      const removedStudiesIds = existingStudyIds.filter(study_id => !updatedStudyIds.includes(study_id));
      if (removedStudiesIds.length > 0) {
        for (let studyID of removedStudiesIds) {
          const organization = await this.findOneByStudyID(studyID);
          if (organization.length == 0) {
              // add removed studyID back to NA program
              changed = true;
              filteredStudies.push({id: studyID});
              newOrphanedStudyIDs.push(studyID);
          }
        }
      }
    }
    if (!changed) {
      return;
    }

    const studies = filteredStudies.map(study => ({id: study?.id || study?._id}));
    await this.programDAO.update(
        naOrg._id, {
        studies: studies,
        updateAt: getCurrentTime()
    });

    if (newOrphanedStudyIDs.length > 0) {
      await this._updateOrganizationInSubmissions(naOrg._id, newOrphanedStudyIDs);
    }

  }

  async _updateOrganizationInSubmissions(orgID, updatedStudyIDs) {
    if (!updatedStudyIDs || updatedStudyIDs.length === 0) {
      return;
    }
    const updatedStudyIds = updatedStudyIDs.map(study => study._id);
    await this.submissionDAO.updateMany({studyID: {in: updatedStudyIds}}, {programID: orgID});
  }

  // If data concierge is not available in the submission,
  // It will update the conciergeName/conciergeEmail at the program level if available.
  async _updatePrimaryContact(studyIDs, conciergeName, conciergeEmail) {
    const programLevelSubmissions = await this.submissionDAO.programLevelSubmissions(studyIDs);
    const submissionIDs = programLevelSubmissions?.map((s) => s?._id);
    if (submissionIDs?.length > 0) {

      const updateSubmission = await this.submissionDAO.updateMany(
          {
            id: { in: submissionIDs }, // assuming `_id` maps to `id`
            OR: [
              { conciergeName: { not: conciergeName } },
              { conciergeEmail: { not: conciergeEmail } },
            ],
          },
          {
            conciergeName: conciergeName,
            conciergeEmail: conciergeEmail,
            updatedAt: getCurrentTime(),
          }
      )
      if (!(updateSubmission?.count >= 0)) {
        console.error("Failed to update the data concierge in submissions at program level");
      }
    }
  await this._updateOrganizationInSubmissions(naOrg._id, newOpenedStudyIDs);
  }

  /**
   * _updateOrganizationInSubmissions: private method to update organization in submissions related with updated studies
   * @param {*} updatedOrg
   * @param {*} updatedStudies
   */
  async _updateOrganizationInSubmissions(orgID, updatedStudies) {
    if (!updatedStudies || updatedStudies.length === 0) {
      return;
    }
    const updatedStudyIds = updatedStudies.map(study => study._id);
    // await this.submissionDAO.updateSubmissionOrgByStudyIDs(updatedStudyIds, updatedOrg);
    await this.submissionDAO.updateMany({studyID: {in: updatedStudyIds}}, {programID: orgID});
  }

  /**
   * Get an organization by it's name
   *
   * @async
   * @param {string} name The name of the organization to search for
   * @param {boolean} [omitStudyLookup] Whether to omit the study lookup in the pipeline. Default is true
   * @returns {Promise<Object | null>} The organization with the given `name` or null if not found
   */
  async getOrganizationByName(name, omitStudyLookup = true) {
    return await this.programDAO.getOrganizationByName(name, omitStudyLookup);
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

    let userOrganization = await this.createOrganization(params);
    return getDataCommonsDisplayNamesForUserOrganization(userOrganization);
  }

  /**
   * Create a new Organization
   *
   * @async
   * @typedef {{ name: string, conciergeID?: string, studies?: Object[] }} CreateOrganizationInput
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

    if (params.studies && Array.isArray(params.studies)) {
      // @ts-ignore Incorrect linting type assertion
      newOrg.studies = await this._getApprovedStudies(params.studies);
    }

    const newProgram = ProgramData.create(newOrg.name, newOrg.conciergeID, newOrg.conciergeName, newOrg.conciergeEmail, newOrg.abbreviation, newOrg?.description, newOrg.studies)
    const res = await this.programDAO.create(newProgram);

    if (!res) {
      throw new Error(ERROR.CREATE_FAILED);
    }
    await this._checkRemovedStudies([], newOrg.studies)
    return res;
  }

  /**
   * Stores approved studies in the organization's collection.
   *
   * @param {string} orgID - The organization ID.
   * @param {object} studyID - The approved study ID
   * @returns {Promise<void>}
   */
  async storeApprovedStudies(orgID, studyID) {
    const aOrg = await this.getOrganizationByID(orgID, true);
    if (!aOrg || !studyID) {
      return;
    }
    const newStudies = [];
    const matchingStudy = aOrg?.studies.find((study) => studyID === study?._id);
    if (!matchingStudy) {
      newStudies.push({_id: studyID});
    }

    if (newStudies.length > 0) {
      aOrg.studies = aOrg.studies || [];
      aOrg.studies = aOrg.studies.concat(newStudies);
      aOrg.studies = aOrg.studies
          .map(study => study?._id ? { id: study._id } : null)
          .filter(Boolean);
      aOrg.updateAt = getCurrentTime();
      const res = await this.programDAO.update(orgID, aOrg)
      if (!res) {
        console.error(ERROR.ORGANIZATION_APPROVED_STUDIES_INSERTION + ` orgID: ${orgID}`);
      }
    }
  }

  /**
   * List Organization IDs by a studyName API.
   * @api
   * @param {string} studyID
   * @returns {Promise<String[]>} An array of Organization ID
   */
  async findByStudyID(studyID) {
    return await this.programDAO.getOrganizationIDsByStudyID(studyID);
  }

  /**
   * Retrieves approved studies in the approved studies collection.
   *
   * @param {object} studies - The studies object with studyID.
   * @returns {Promise<Object>} The approved studies
   */
  async _getApprovedStudies(studies) {
    const studyIDs = studies
      .filter((study) => study?.studyID)
      .map((study) => study.studyID);
    const approvedStudies = await this.approvedStudyDAO.findMany({
        id: { in: studyIDs },
    });

    if (approvedStudies.length !== studyIDs.length) {
      throw new Error(ERROR.INVALID_APPROVED_STUDY_ID);
    }

    return approvedStudies?.map((study) => ({id: study?._id}));
  }

  async upsertByProgramName(programName, abbreviation, description, studies) {
    const newProgram = ProgramData.create(programName, "", "", "", abbreviation, description, studies)
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
   * List Organization by a program name.
   * @api
   * @param {string} programName
   * @returns {Promise<Organization[]>} An array of Organization
   */
  async findOneByProgramName(programName) {
    return await this.organizationCollection.aggregate([{"$match": {name: programName?.trim()}}, {"$limit": 1}]);
  }

  /**
   * List Organization by a studyID.
   * @api
   * @param {string} studyID
   * @returns {Promise<Organization[]>} An array of Organization
   */
  async findOneByStudyID(studyID) {
    return await this.organizationCollection.aggregate([{"$match": {"studies._id": {"$in": [studyID?.trim()]}}}, {"$limit": 1}]);
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
  constructor(name, conciergeID, conciergeName, conciergeEmail, abbreviation, description, studies) {
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
    this.studies = studies && Array.isArray(studies) ? studies : [];
    this.createdAt = getCurrentTime();
    this.updateAt = getCurrentTime();
  }

  static create(name, conciergeID, conciergeName, conciergeEmail, abbreviation, description, studies) {
    return new ProgramData(name, conciergeID, conciergeName, conciergeEmail, abbreviation, description, studies);
  }
}

module.exports = {
  Organization
};
