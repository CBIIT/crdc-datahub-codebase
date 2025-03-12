const {ERROR} = require("../constants/error-constants");
const {USER} = require("../constants/user-constants");
const {ORGANIZATION} = require("../constants/organization-constants");
const {getCurrentTime} = require("../utility/time-utility");
const { APPROVED_STUDIES_COLLECTION } = require("../database-constants");
const {ADMIN} = require("../constants/user-permission-constants");

class Organization {
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
    if (!context?.userInfo?.permissions?.includes(ADMIN.MANAGE_PROGRAMS)) {
        throw new Error(ERROR.INVALID_ROLE);
    }
    if (!params?.orgID) {
        throw new Error(ERROR.INVALID_ORG_ID);
    }

    return this.getOrganizationByID(params.orgID, false);
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

      pipeline.push({ "$match": { _id: id } });
      pipeline.push({ "$limit": 1 });
      const result = await this.organizationCollection.aggregate(pipeline);
      return result?.length > 0 ? result[0] : null;
  }

  /**
   * List Organizations API Interface.
   *
   * Any authenticated users can retrieve all organizations, no matter what role a user has or what organization a user is associated with.
   *
   * @api
   * @param {Object} params Endpoint parameters
   * @param {{ cookie: Object, userInfo: Object }} context request context
   * @returns {Promise<Object[]>} An array of Organizations
   */
  async listOrganizationsAPI(params, context) {
    if (!context?.userInfo?.email || !context?.userInfo?.IDP) {
        throw new Error(ERROR.NOT_LOGGED_IN)
    }

    return this.listOrganizations({});
  }

  /**
   * List organizations by an optional set of filters
   *
   * @typedef {Object<string, any>} Filters K:V pairs of filters
   * @param {Filters} [filters] Filters to apply to the query
   * @param {boolean} [omitStudyLookup] Whether to omit the study lookup in the pipeline. Default is false
   * @returns {Promise<Object[]>} An array of Organizations
   */
    async listOrganizations(filters = {}, omitStudyLookup = false) {
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

        pipeline.push({ "$match": filters });
        return await this.organizationCollection.aggregate(pipeline);
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
    if (!context?.userInfo?.permissions?.includes(ADMIN.MANAGE_PROGRAMS)) {
        throw new Error(ERROR.INVALID_ROLE);
    }
    if (!params?.orgID) {
        throw new Error(ERROR.INVALID_ORG_ID);
    }

    return this.editOrganization(params.orgID, params);
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
      const updatedOrg = { updateAt: getCurrentTime() };
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
          const filters = { _id: params.conciergeID, role: USER.ROLES.DATA_COMMONS_PERSONNEL, userStatus: USER.STATUSES.ACTIVE };
          const result = await this.userCollection.aggregate([{ "$match": filters }, { "$limit": 1 }]);
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

      const updateResult = await this.organizationCollection.update({ _id: orgID, ...updatedOrg });
      if (updateResult?.matchedCount !== 1) {
          throw new Error(ERROR.UPDATE_FAILED);
      }

      // If the primary contact(concierge) is not available in approved studies, the provided primary contact should be updated in the data submissions.
      if (updatedOrg.studies?.length > 0) {
          const conciergeID = updatedOrg.conciergeID || currentOrg?.conciergeID;
          const orgName = updatedOrg?.name || currentOrg?.name;
          if (conciergeID) {
              const primaryContact = await this.userCollection.aggregate([{ "$match": {
                  _id: conciergeID, role: USER.ROLES.DATA_COMMONS_PERSONNEL, userStatus: USER.STATUSES.ACTIVE } }, { "$limit": 1 }]);
              if (primaryContact.length > 0) {
                  const {firstName, lastName, email: conciergeEmail} = primaryContact[0];
                  const studyIDs = updatedOrg?.studies.map(study => study?._id);
                  await this.#updatePrimaryContact(orgID, orgName, studyIDs, `${firstName} ${lastName}`?.trim(), conciergeEmail);
              }
          }
      }

      if (updatedOrg.name) {
          const [updatedSubmission, updateUser, updatedApplication] = await Promise.all([
              this.submissionCollection.updateMany(
                  { "organization._id": orgID,  "organization.name": { "$ne": updatedOrg.name }},
                  { "organization.name": updatedOrg.name, updatedAt: getCurrentTime() }
              ),
              this.userCollection.updateMany(
                  { "organization.orgID": orgID, "organization.orgName": { "$ne": updatedOrg.name }},
                  { "organization.orgName": updatedOrg.name, "organization.updateAt": updatedOrg.updateAt, updateAt: getCurrentTime() }
              ),
              this.applicationCollection.updateMany(
                  { "organization._id": orgID, "organization.name": { "$ne": updatedOrg.name } },
                  { "organization.name": updatedOrg.name, updatedAt: getCurrentTime() }
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
      return { ...currentOrg, ...updatedOrg };
  }

  // If the primary contact is not available in the submission,
  // It will update the conciergeName/conciergeEmail at the program level if available.
  async #updatePrimaryContact(orgID, orgName, studyIDs, conciergeName, conciergeEmail) {
      const primaryContactSubmissions = await this.submissionCollection.aggregate([{"$match": {
              "studyID": {$in: studyIDs}
          }}
      ]);
      const withPrimaryContactStudies = await this.approvedStudiesCollection.aggregate([{
          $match: {
              _id: {$in: studyIDs},
              primaryContactID: { $ne: null, $exists: true }}}, {
          $project: { _id: 1 }}
      ]);

      const primaryContactStudyIDSet = new Set(withPrimaryContactStudies?.map((s) => s?._id));
      const withoutContactSubmissionIDs = primaryContactSubmissions
          .filter((aSubmission) => !primaryContactStudyIDSet.has(aSubmission?.studyID));

      // update the primary contact at the program level
      if (withoutContactSubmissionIDs.length > 0) {
          const submissionIDs = withoutContactSubmissionIDs?.map((s) => s?._id);
          const updateSubmission = await this.submissionCollection.updateMany(
              // conditions to match
              {
                  _id: {$in: submissionIDs},
                  $or: [{conciergeName: { "$ne": conciergeName }}, {conciergeEmail: { "$ne": conciergeEmail }},
                      {"organization._id": { "$ne": orgID }}, {"organization.name": { "$ne": orgName }}]
              },
              // properties to be updated
              { conciergeName: conciergeName, conciergeEmail: conciergeEmail, organization: {_id: orgID, name: orgName}, updatedAt: getCurrentTime()}
          );

          if (!updateSubmission.acknowledged) {
              console.error("Failed to update the primary contact in submissions at program level");
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

    pipeline.push({ "$match": { name } });
    pipeline.push({ "$limit": 1 });
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
    if (!context?.userInfo?.permissions?.includes(ADMIN.MANAGE_PROGRAMS)) {
      throw new Error(ERROR.INVALID_ROLE);
    }

    if (!params?.abbreviation?.trim()) {
        throw new Error(ERROR.ORGANIZATION_INVALID_ABBREVIATION);
    }

    return this.createOrganization(params);
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
        ...((params?.description || params?.description?.trim() === "") && { description: params.description.trim() })
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
        const filters = { _id: params.conciergeID, role: USER.ROLES.DATA_COMMONS_PERSONNEL, userStatus: USER.STATUSES.ACTIVE };
        const result = await this.userCollection.aggregate([{ "$match": filters }, { "$limit": 1 }]);
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
    const res = await this.organizationCollection.findOneAndUpdate({name: newOrg.name}, newProgram, {returnDocument: 'after', upsert: true});
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
            newStudies.push({ _id: studyID });
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

      return approvedStudies?.map((study) => ({ _id: study?._id }));
  }

  async upsertByProgramName(programName, abbreviation, description, studies) {
      const newProgram = ProgramData.create(programName, "", "", "", abbreviation, description, studies)
      const res = await this.organizationCollection.findOneAndUpdate({name: programName}, newProgram, {returnDocument: 'after', upsert: true});
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
        return await this.organizationCollection.aggregate([{ "$match": {name: programName?.trim()} }, { "$limit": 1 }]);
    }

    /**
    * List Organization by a studyID.
    * @api
    * @param {string} studyID
    * @returns {Promise<Organization[]>} An array of Organization
    */
    async findOneByStudyID(studyID) {
        return await this.organizationCollection.aggregate([{ "$match": {"studies._id": { "$in": [studyID?.trim()] }}}, { "$limit": 1 }]);
    }
}

class ProgramData {
    constructor(name, conciergeID, conciergeName, conciergeEmail, abbreviation, description, studies) {
        this.name = name;
        this.status = ORGANIZATION.STATUSES.ACTIVE;
        this.conciergeID =  conciergeID ? conciergeID : "";
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
