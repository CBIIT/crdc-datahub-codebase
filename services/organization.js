const {ERROR} = require("../constants/error-constants");
const {USER} = require("../constants/user-constants");
const {ORGANIZATION, NA_PROGRAM} = require("../constants/organization-constants");
const {getCurrentTime} = require("../utility/time-utility");
const {APPROVED_STUDIES_COLLECTION} = require("../database-constants");
const {ADMIN} = require("../constants/user-permission-constants");
const {getDataCommonsDisplayNamesForUserOrganization} = require("../../utility/data-commons-remapper");
const {MongoPagination} = require("../domain/mongo-pagination");
const {replaceErrorString} = require("../../utility/string-util");

class Organization {
  #ALL = "All";
  #READ_ONLY_FIELDS = ["name", "abbreviation", "description", "status"];

  constructor(organizationCollection, userCollection, submissionCollection, applicationCollection, approvedStudiesCollection) {
    this.organizationCollection = organizationCollection;
    this.userCollection = userCollection;
    this.submissionCollection = submissionCollection;
    this.applicationCollection = applicationCollection;
    this.approvedStudiesCollection = approvedStudiesCollection;
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
    const pipeline = [];

    if (!omitStudyLookup) {
      pipeline.push(
        {
          $lookup: {
            from: APPROVED_STUDIES_COLLECTION,
            localField: "studies._id",
            foreignField: "_id",
            as: "studies"
          }
        },
      );
    }

    pipeline.push({"$match": {_id: id}});
    pipeline.push({"$limit": 1});
    const result = await this.organizationCollection.aggregate(pipeline);
    return result?.length > 0 ? result[0] : null;
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
    if (status !== this.#ALL && !validStatuses.includes(status)) {
      throw new Error(replaceErrorString(ERROR.INVALID_PROGRAM_STATUS, status));
    }

    const statusCondition = status && status !== this.#ALL ?
      {status: status} : {status: {$in: validStatuses}};

    const pagination = new MongoPagination(first, offset, orderBy, sortDirection);
    const paginationPipeline = pagination.getPaginationPipeline();
    const programs = await this.organizationCollection.aggregate([
      {
        $lookup: {
          from: APPROVED_STUDIES_COLLECTION,
          localField: "studies._id",
          foreignField: "_id",
          as: "studies"
        }
      },
      {"$match": statusCondition},
      {
        $facet: {
          total: [{
            $count: "total"
          }],
          results: paginationPipeline
        }
      },
      {
        $set: {
          total: {
            $first: "$total.total",
          }
        }
      }
    ]);
    const programList = programs.length > 0 ? programs[0] : {}
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
      const filters = {
        _id: params.conciergeID,
        role: USER.ROLES.DATA_COMMONS_PERSONNEL,
        userStatus: USER.STATUSES.ACTIVE
      };
      const result = await this.userCollection.aggregate([{"$match": filters}, {"$limit": 1}]);
      const conciergeUser = result?.[0];
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
      updatedOrg.studies = await this.#getApprovedStudies(params.studies);
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

    const updateResult = await this.organizationCollection.update({_id: orgID, ...updatedOrg});
    if (updateResult?.matchedCount !== 1) {
      throw new Error(ERROR.UPDATE_FAILED);
    }

    // If data concierge is not available in approved studies, the provided data concierge should be updated in the data submissions.
    if (updatedOrg.studies?.length > 0) {
      const conciergeID = updatedOrg.conciergeID || currentOrg?.conciergeID;
      if (conciergeID) {
        const primaryContact = await this.userCollection.aggregate([{
          "$match": {
            _id: conciergeID, role: USER.ROLES.DATA_COMMONS_PERSONNEL, userStatus: USER.STATUSES.ACTIVE
          }
        }, {"$limit": 1}]);
        if (primaryContact.length > 0) {
          const {firstName, lastName, email: conciergeEmail} = primaryContact[0];
          const studyIDs = updatedOrg?.studies.map(study => study?._id);
          await this.#updatePrimaryContact(studyIDs, `${firstName} ${lastName}`?.trim(), conciergeEmail);
        }
      }
    }

    if (updatedOrg.name) {
      const [updatedSubmission, updateUser, updatedApplication] = await Promise.all([
        this.submissionCollection.updateMany(
          {"organization._id": orgID, "organization.name": {"$ne": updatedOrg.name}},
          {"organization.name": updatedOrg.name, updatedAt: getCurrentTime()}
        ),
        this.userCollection.updateMany(
          {"organization.orgID": orgID, "organization.orgName": {"$ne": updatedOrg.name}},
          {
            "organization.orgName": updatedOrg.name,
            "organization.updateAt": updatedOrg.updateAt,
            updateAt: getCurrentTime()
          }
        ),
        this.applicationCollection.updateMany(
          {"organization._id": orgID, "organization.name": {"$ne": updatedOrg.name}},
          {"organization.name": updatedOrg.name, updatedAt: getCurrentTime()}
        )
      ]);
      if (!updatedSubmission.acknowledged) {
        console.error("Failed to update the organization name in submissions");
      }

      if (!updateUser.acknowledged) {
        console.error("Failed to update the organization name in users");
      }

      if (!updatedApplication.acknowledged) {
        console.error("Failed to update the organization name in submission requests");
      }
    }
    await this.#checkRemovedStudies(currentOrg.studies, updatedOrg.studies);
    return { ...currentOrg, ...updatedOrg };
  }

  /**
   * #checkRemovedStudies: private method to check removed studies
   * @param {*} existing_studies 
   * @param {*} updated_studies 
   */
  async #checkRemovedStudies(existing_studies, updated_studies){
    const existing_study_ids = existing_studies.map(study => study._id);
    const updated_study_ids = updated_studies.map(study => study._id);
    const removed_studies_ids = existing_study_ids.filter(study_id => !updated_study_ids.includes(study_id));
    const naOrg = await this.getOrganizationByName(NA_PROGRAM);
    if (!naOrg || !naOrg?._id) {
      console.error("NA program not found");
      return
    }
    for (let studyID of removed_studies_ids) {
        const organization = await this.findOneByStudyID(studyID);
        if (organization.length == 0) {
            await this.storeApprovedStudies(naOrg._id, studyID);
        }
    }
    const naOrgStudies = naOrg.studies;
    // remove updated studyID from NA program since they are added to the edited org.
    const filteredStudies = naOrgStudies.filter(study => !updated_study_ids.includes(study._id));
    if (filteredStudies.length !== naOrgStudies.length) {
      await this.organizationCollection.updateOne({"_id": naOrg._id}, {$set: {studies: filteredStudies, updatedAt: getCurrentTime()}});
    }
  }

  // If data concierge is not available in the submission,
  // It will update the conciergeName/conciergeEmail at the program level if available.
  async #updatePrimaryContact(studyIDs, conciergeName, conciergeEmail) {
    const programLevelSubmissions = await this.submissionCollection.aggregate([
      {$match: {
          studyID: { $in: studyIDs }
      }},
      {$lookup: {
          from: APPROVED_STUDIES_COLLECTION, // adjust if the actual collection name is different
          localField: 'studyID',
          foreignField: '_id',
          as: 'studyInfo'
      }},
      {$unwind: '$studyInfo'},
      {$match: {
          // This flag indicates the program level primary contact(data concierge)
          'studyInfo.useProgramPC': true
      }},
      {$project: {
          _id: 1
      }}]);

    const submissionIDs = programLevelSubmissions?.map((s) => s?._id);
    if (submissionIDs?.length > 0) {
      const updateSubmission = await this.submissionCollection.updateMany(
          // conditions to match
          {
            _id: {$in: submissionIDs},
            $or: [{conciergeName: {"$ne": conciergeName}}, {conciergeEmail: {"$ne": conciergeEmail}}]
          },
          // properties to be updated
          {conciergeName: conciergeName, conciergeEmail: conciergeEmail, updatedAt: getCurrentTime()}
      );

      if (!updateSubmission.acknowledged) {
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
  async getOrganizationByName(name, omitStudyLookup = true) {
    const pipeline = [];

    if (!omitStudyLookup) {
      pipeline.push(
        {
          $lookup: {
            from: APPROVED_STUDIES_COLLECTION,
            localField: "studies._id",
            foreignField: "_id",
            as: "studies"
          }
        },
      );
    }

    pipeline.push({"$match": {name}});
    pipeline.push({"$limit": 1});
    const result = await this.organizationCollection.aggregate(pipeline);
    return result?.length > 0 ? result[0] : null;
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
      const filters = {
        _id: params.conciergeID,
        role: USER.ROLES.DATA_COMMONS_PERSONNEL,
        userStatus: USER.STATUSES.ACTIVE
      };
      const result = await this.userCollection.aggregate([{"$match": filters}, {"$limit": 1}]);
      const conciergeUser = result?.[0];
      if (!conciergeUser) {
        throw new Error(ERROR.INVALID_ROLE_ASSIGNMENT);
      }
      newOrg.conciergeID = params.conciergeID;
      newOrg.conciergeName = `${conciergeUser.firstName} ${conciergeUser.lastName}`.trim();
      newOrg.conciergeEmail = conciergeUser.email;
    }

    if (params.studies && Array.isArray(params.studies)) {
      // @ts-ignore Incorrect linting type assertion
      newOrg.studies = await this.#getApprovedStudies(params.studies);
    }

    const newProgram = ProgramData.create(newOrg.name, newOrg.conciergeID, newOrg.conciergeName, newOrg.conciergeEmail, newOrg.abbreviation, newOrg?.description, newOrg.studies)
    const res = await this.organizationCollection.findOneAndUpdate({name: newOrg.name}, newProgram, {
      returnDocument: 'after',
      upsert: true
    });
    if (!res?.value) {
      throw new Error(ERROR.CREATE_FAILED);
    }

    return res?.value;
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
      aOrg.updateAt = getCurrentTime();
      const res = await this.organizationCollection.update(aOrg);
      if (res?.modifiedCount !== 1) {
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
    return await this.organizationCollection.distinct("_id", {"studies._id": studyID});
  }

  /**
   * Retrieves approved studies in the approved studies collection.
   *
   * @param {object} studies - The studies object with studyID.
   * @returns {Promise<Object>} The approved studies
   */
  async #getApprovedStudies(studies) {
    const studyIDs = studies
      .filter((study) => study?.studyID)
      .map((study) => study.studyID);
    const approvedStudies = await Promise.all(studyIDs.map(async (id) => {
      const study = (await this.approvedStudiesCollection.find(id))?.pop();
      if (!study) {
        throw new Error(ERROR.INVALID_APPROVED_STUDY_ID);
      }
      return study;
    }));

    return approvedStudies?.map((study) => ({_id: study?._id}));
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
      for (const key of this.#READ_ONLY_FIELDS) {
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
