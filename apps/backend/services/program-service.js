const {ERROR} = require("../crdc-datahub-database-drivers/constants/error-constants");
const {USER} = require("../crdc-datahub-database-drivers/constants/user-constants");
const {PROGRAM} = require("../crdc-datahub-database-drivers/constants/organization-constants");
const {getCurrentTime} = require("../crdc-datahub-database-drivers/utility/time-utility");
const {getDataCommonsDisplayNamesForUserOrganization} = require("../utility/data-commons-remapper");
const {replaceErrorString} = require("../utility/string-util");
const ProgramDAO = require("../dao/program");
const SubmissionDAO = require("../dao/submission");
const UserDAO = require("../dao/user");
const SubmissionRequestDAO = require("../dao/submission-request");
const ApprovedStudyDAO = require("../dao/approvedStudy");

class Program {
  _ALL = "All";
  _READ_ONLY_FIELDS = ["name", "abbreviation", "description", "status"];

  /**
   * @param {object} submissionCollection Native submission collection
   * @param {object} [_submissionRequestCollection] Unused; retained for constructor signature compatibility
   */
  constructor(submissionCollection, _submissionRequestCollection) {
    this.programDAO = new ProgramDAO();
    this.approvedStudyDAO = new ApprovedStudyDAO();
    this.submissionDAO = new SubmissionDAO(submissionCollection);
    this.userDAO = new UserDAO();
    this.submissionRequestDAO = new SubmissionRequestDAO();
  }

  /**
   * Get Program by ID API Interface (GraphQL: getOrganization).
   * @api
   * @param {{ orgID: string }} params Endpoint parameters
   * @param {{ cookie: Object, userInfo: Object }} context API request context
   * @returns {Promise<Object | null>} The program with the given `orgID` or null if not found
   */
  async getProgramAPI(params, context) {
    if (!context?.userInfo?.email || !context?.userInfo?.IDP) {
      throw new Error(ERROR.NOT_LOGGED_IN);
    }

    if (!params?.orgID) {
      throw new Error(ERROR.INVALID_ORG_ID);
    }

    let userOrganization = await this.getProgramByID(params.orgID, true);
    return getDataCommonsDisplayNamesForUserOrganization(userOrganization);
  }

  /**
   * Get a program by its `_id`
   *
   * @async
   * @param {string} id The UUID of the program to search for
   * @param {boolean} includeStudiesList When true, loads related approved studies (e.g. getOrganization). Pass false when studies are not needed.
   * @returns {Promise<Object | null>} The program with the given `id` or null if not found
   */
  async getProgramByID(id, includeStudiesList) {
    if (typeof includeStudiesList !== 'boolean') {
      throw new Error(ERROR.INVALID_INCLUDE_STUDIES_LIST_ARGUMENT);
    }
    if (!id) {
      return null;
    }
    return await this.programDAO.getProgramByID(id, includeStudiesList);
  }

  /**
   * List Programs API Interface.
   *
   * Any authenticated users can retrieve all programs, no matter what role a user has or what program a user is associated with.
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
      statusCondition = {status: {$in: [PROGRAM.STATUSES.ACTIVE, PROGRAM.STATUSES.INACTIVE]}};
    } else if (normalizedStatus === PROGRAM.STATUSES.ACTIVE.toLowerCase()) {
      statusCondition = {status: PROGRAM.STATUSES.ACTIVE};
    } else if (normalizedStatus === PROGRAM.STATUSES.INACTIVE.toLowerCase()) {
      statusCondition = {status: PROGRAM.STATUSES.INACTIVE};
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
   * Edit Program API Interface (GraphQL: editOrganization).
   * @api
   * @param {EditProgramInput} params Endpoint parameters
   * @param {{ cookie: Object, userInfo: Object }} context API request context
   * @returns {Promise<Object>} The modified program
   */
  async editProgramAPI(params, context) {
    if (!context?.userInfo?.email || !context?.userInfo?.IDP) {
      throw new Error(ERROR.NOT_LOGGED_IN);
    }

    if (!params?.orgID) {
      throw new Error(ERROR.INVALID_ORG_ID);
    }

    await this.editProgram(params.orgID, params);
    const userOrganization = await this.getProgramByID(params.orgID, true);
    return getDataCommonsDisplayNamesForUserOrganization(userOrganization);
  }

  /**
   * Edit a program by its `_id` and a set of parameters
   *
   * @async
   * @typedef {{ orgID: string, name: string, conciergeID: string, status: string }} EditProgramInput
   * @throws {Error} If the program is not found or the update fails
   * @param {string} orgID The ID of the program to edit (GraphQL arg name)
   * @param {EditProgramInput} params The program input
   * @returns {Promise<Object>} The modified program
   */
  async editProgram(orgID, params) {
    const currentProgram = await this.getProgramByID(orgID, false);
    if (!currentProgram) {
      throw new Error(ERROR.ORG_NOT_FOUND);
    }
    if (this.checkForReadOnlyViolation(currentProgram, params)) {
      throw new Error(ERROR.CANNOT_UPDATE_READ_ONLY_PROGRAM);
    }
    const updatedProgram = {updateAt: getCurrentTime()};

    const attemptingToSetInactive =
      typeof params?.status === "string" && params.status === PROGRAM.STATUSES.INACTIVE;

    if (!currentProgram?.abbreviation && !params?.abbreviation?.trim()) {
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
        trimmedName.toLowerCase() !== currentProgram.name?.toLowerCase()
      ) {
        const existingOrg = await this.getProgramByName(trimmedName);
        if (existingOrg) {
          throw new Error(ERROR.DUPLICATE_ORG_NAME);
        }
        updatedProgram.name = trimmedName;
      }
    }

    const conciergeProvided = typeof params.conciergeID !== "undefined";
    // Only update the concierge if it is provided and different from the currently assigned concierge
    if (conciergeProvided && !!params.conciergeID && params.conciergeID !== currentProgram.conciergeID) {
      const conciergeUser = await this.userDAO.findFirst({
          _id: params.conciergeID,
          role: USER.ROLES.DATA_COMMONS_PERSONNEL,
          userStatus: USER.STATUSES.ACTIVE,
      });

      if (!conciergeUser) {
        throw new Error(ERROR.INVALID_ROLE_ASSIGNMENT);
      }
      updatedProgram.conciergeID = params.conciergeID;
      updatedProgram.conciergeName = `${conciergeUser.firstName} ${conciergeUser.lastName}`.trim();
      updatedProgram.conciergeEmail = conciergeUser.email;
      // Only remove the concierge if it is purposely set to null and there is a currently assigned concierge
    } else if (conciergeProvided && !params.conciergeID && !!currentProgram.conciergeID) {
      updatedProgram.conciergeID = null;
      updatedProgram.conciergeName = null;
      updatedProgram.conciergeEmail = null;
    }

    if (params.status && Object.values(PROGRAM.STATUSES).includes(params.status)) {
      updatedProgram.status = params.status;
    }

    if (params?.abbreviation?.trim()) {
      updatedProgram.abbreviation = params.abbreviation.trim();
    }

    if (params?.description?.trim() || params?.description?.trim() === "") {
      updatedProgram.description = params.description.trim();
    }

    const updateResult = await this.programDAO.updateMany(
        {_id: orgID},
      updatedProgram, // only these fields will be changed
    );

    if (typeof updateResult?.count !== 'number' || updateResult.count < 1) {
      throw new Error(ERROR.UPDATE_FAILED);
    }

    if (updatedProgram.name || updatedProgram?.abbreviation) {
      const promises = [];
      if (updatedProgram.name) {
        promises.push(
          this.submissionRequestDAO.updateSubmissionRequestOrg(orgID, updatedProgram)
        );
        promises.push(
            this.userDAO.updateUserOrg(orgID, updatedProgram)
        );
        
      }

      try {
        // The result of updateUserOrg is not used so it is not extracted from the promise.all response
        const [updatedSubmissionRequest] = await Promise.all(promises);

        if (updatedProgram.name && !updatedSubmissionRequest?.acknowledged) {
          console.error("Failed to update the organization name in submission requests");
        }
      } catch (error) {
        console.error("Failed to update the organization name in users/submissionRequests", error);
      }
    }

    return { ...currentProgram, ...updatedProgram };
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
   * Get a program by its name
   *
   * @async
   * @param {string} name The name of the program to search for
   * @returns {Promise<Object | null>} The program with the given `name` or null if not found
   */
  async getProgramByName(name) {
    return await this.programDAO.getProgramByName(name);
  }

  /**
   * Create a Program API Interface (GraphQL: createOrganization).
   * @api
   * @param {CreateProgramInput} params Endpoint parameters
   * @param {{ cookie: Object, userInfo: Object }} context API request context
   * @returns {Promise<Object>} The created program
   */
  async createProgramAPI(params, context) {
    if (!context?.userInfo?.email || !context?.userInfo?.IDP) {
      throw new Error(ERROR.NOT_LOGGED_IN);
    }

    if (!params?.abbreviation?.trim()) {
      throw new Error(ERROR.ORGANIZATION_INVALID_ABBREVIATION);
    }

    const created = await this.createProgram(params);
    const userOrganization =
      (await this.getProgramByID(created?._id, true)) ?? created;
    return getDataCommonsDisplayNamesForUserOrganization(userOrganization);
  }

  /**
   * Create a new Program
   *
   * @async
   * @typedef {{ name: string, conciergeID?: string }} CreateProgramInput
   * @throws {Error} If the program name is already taken or the create action fails
   * @param {CreateProgramInput} params The program input
   * @returns {Promise<Object>} The newly created program
   */
  async createProgram(params) {
    const newOrg = {
      abbreviation: params.abbreviation?.trim(),
      ...((params?.description || params?.description?.trim() === "") && {description: params.description.trim()})
    }

    if (!!params?.name?.trim()) {
      const existingOrg = await this.getProgramByName(params.name);
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

  /**
   * Upsert a program document by name.
   * @param {string} programName
   * @param {string} abbreviation
   * @param {string} description
   * @returns {Promise<object|null>}
   */
  async upsertByProgramName(programName, abbreviation, description) {
    const newProgram = ProgramData.create(programName, "", "", "", abbreviation, description)
    const res = await this.programDAO.upsertByName(programName, newProgram);
    if (!res) {
      console.error(`Failed to insert a new program: ${programName}`);
    }
    return res;
  }

  /**
   * Find one program by name (case-insensitive).
   * @api
   * @param {string} programName
   * @returns {Promise<object|null>} A single program or null if not found
   */
  async findOneByProgramName(programName) {
    return await this.programDAO.findOneByProgramName(programName);
  }

  /**
   * Find one program by study ID using the programID reference on the approved study.
   * @api
   * @param {string} studyID
   * @returns {Promise<Object|null>} The program or null if not found
   */
  async findOneByStudyID(studyID) {
    const approvedStudy = await this.approvedStudyDAO.findFirst({ _id: studyID?.trim() });
    if (!approvedStudy?.programID) {
      return null;
    }

    return await this.getProgramByID(approvedStudy?.programID, false);
  }

  /**
   * Checks if the target program has a read-only flag set and if the update parameters violate
   * this read-only protection.
   * @param {object} organization the target program
   * @param {object} params the update parameters
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
    this.status = PROGRAM.STATUSES.ACTIVE;
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
  Program
};
