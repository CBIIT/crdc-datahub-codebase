const typeDefs = require("fs").readFileSync("resources/graphql/crdc-datahub.graphql", "utf8");

const { makeExecutableSchema } = require("@graphql-tools/schema");
const { assertValidSchema } = require("graphql");
const {
  constraintDirective,
  constraintDirectiveTypeDefs,
} = require("graphql-constraint-directive");
const { createHandler } = require("graphql-http/lib/use/express");
const sanitizeHtml = require("sanitize-html");

const configuration = require("../config");
const ERROR = require("../constants/error-constants");
const { CONSTRAINTS } = require("../constants/submission-constants");
const { ADMIN } = require("../crdc-datahub-database-drivers/constants/user-permission-constants");
const { DatabaseConnector } = require("../crdc-datahub-database-drivers/database-connector");
const {
  DATABASE_NAME,
  APPLICATION_COLLECTION,
  SUBMISSIONS_COLLECTION,
  USER_COLLECTION,
  ORGANIZATION_COLLECTION,
  LOG_COLLECTION,
  APPROVED_STUDIES_COLLECTION,
  DATA_RECORDS_ARCHIVE_COLLECTION,
} = require("../crdc-datahub-database-drivers/database-constants");
const { MongoQueries } = require("../crdc-datahub-database-drivers/mongo-queries");
const { MongoDBCollection } = require("../crdc-datahub-database-drivers/mongodb-collection");
const PropertyPVDAO = require("../dao/propertyPV");
const { UserScope } = require("../domain/user-scope");
const {
  initializeEmailContentFromConfig,
  startEmailContentPrefetch,
} = require("../lib/email-content-cache");
const { connectMongoose } = require("../mongoose/connection");
const { Application } = require("../services/application");
const { ApprovedStudiesService } = require("../services/approved-studies");
const AuthenticationService = require("../services/authentication-service");
const { AuthorizationService } = require("../services/authorization-service");
const { AWSService } = require("../services/aws-request");
const { BatchService, UploadingMonitor } = require("../services/batch-service");
const { ConfigurationService } = require("../services/configurationService");
const { DashboardService } = require("../services/dashboardService");
const DataModelService = require("../services/data-model-service");
const { DataRecordService } = require("../services/data-record-service");
const { DataSyncService } = require("../services/dataSync.service");
const { EmailService } = require("../services/email");
const { InstitutionService } = require("../services/institution-service");
const { NotifyUser } = require("../services/notify-user");
const { Program } = require("../services/program-service");
const { PropertyPVService } = require("../services/property-pv-service");
const { QcResultService } = require("../services/qc-result-service");
const { Release } = require("../services/release-service");
const { S3Service } = require("../services/s3-service");
const { Submission } = require("../services/submission");
const { TooltipService } = require("../services/tooltip-service");
const { UserService } = require("../services/user");
const UserInitializationService = require("../services/user-initialization-service");
const { UtilityService } = require("../services/utility");
const { replaceErrorString } = require("../utility/string-util");

const { apiAuthorization, extractAPINames, PUBLIC } = require("./api-authorization");

const dbService = new MongoQueries(configuration.document_db_connection_string, DATABASE_NAME);
const dbConnector = new DatabaseConnector(configuration.document_db_connection_string);

// Create schema with constraint directive
const schema = constraintDirective()(
  makeExecutableSchema({
    typeDefs: [constraintDirectiveTypeDefs, typeDefs],
  })
);

// Validate schema at startup - throws if invalid (e.g., missing interface fields)
assertValidSchema(schema);

const publicAPIList = extractAPINames(schema, PUBLIC);

async function getOrgUserScope(authorizationService, userInfo, permission) {
  if (!userInfo?.email || !userInfo?.IDP) {
    throw new Error(ERROR.NOT_LOGGED_IN);
  }
  const validScopes = await authorizationService.getPermissionScope(userInfo, permission);
  const userScope = UserScope.create(validScopes);
  // valid scopes; none, all, role/role:RoleScope
  const isValidUserScope = userScope.isNoneScope() || userScope.isAllScope();
  if (!isValidUserScope) {
    console.warn(ERROR.INVALID_USER_SCOPE, permission);
    throw new Error(replaceErrorString(ERROR.INVALID_USER_SCOPE));
  }
  return userScope;
}

let root;
let authenticationService;
let userInitializationService;
dbConnector
  .connect()
  .then(async () => {
    await connectMongoose(configuration.document_db_connection_string);
    const config = await configuration.updateConfig();
    initializeEmailContentFromConfig(config);
    // Prefetch is non-blocking: the API must start even if GitHub email content is missing.
    startEmailContentPrefetch();
    const applicationCollection = new MongoDBCollection(
      dbConnector.client,
      DATABASE_NAME,
      APPLICATION_COLLECTION
    );
    const submissionCollection = new MongoDBCollection(
      dbConnector.client,
      DATABASE_NAME,
      SUBMISSIONS_COLLECTION
    );
    const userCollection = new MongoDBCollection(
      dbConnector.client,
      DATABASE_NAME,
      USER_COLLECTION
    );
    const emailService = new EmailService(config.email_transport, config.emails_enabled);
    const configurationService = new ConfigurationService();
    const notificationsService = new NotifyUser(emailService, config.tier);

    const logCollection = new MongoDBCollection(dbConnector.client, DATABASE_NAME, LOG_COLLECTION);
    const propertyPVDAO = new PropertyPVDAO();
    const propertyPVService = new PropertyPVService(configurationService, propertyPVDAO);
    const authorizationService = new AuthorizationService(configurationService);
    const organizationCollection = new MongoDBCollection(
      dbConnector.client,
      DATABASE_NAME,
      ORGANIZATION_COLLECTION
    );
    const approvedStudiesCollection = new MongoDBCollection(
      dbConnector.client,
      DATABASE_NAME,
      APPROVED_STUDIES_COLLECTION
    );
    const programService = new Program();
    const approvedStudiesService = new ApprovedStudiesService(
      approvedStudiesCollection,
      programService,
      authorizationService,
      notificationsService,
      {
        url: config.emails_url,
        contactEmail: config.conditionalSubmissionContact,
        submissionGuideURL: config.submissionGuideUrl,
      }
    );

    const institutionService = new InstitutionService(authorizationService);
    const userService = new UserService(
      logCollection,
      organizationCollection,
      notificationsService,
      applicationCollection,
      config.official_email,
      config.emails_url,
      approvedStudiesService,
      config.inactive_user_days,
      configurationService,
      institutionService,
      authorizationService
    );
    const s3Service = new S3Service();
    const awsService = new AWSService(configurationService);

    const utilityService = new UtilityService();
    // Optional contentURL avoids re-resolving the URL when the caller already has it
    const fetchDataModelInfo = async (contentURL) =>
      utilityService.fetchJsonFromUrl(
        contentURL ?? (await configurationService.getModelContentURL())
      );
    const batchService = new BatchService(
      s3Service,
      config.sqs_loader_queue,
      awsService,
      config.prod_url,
      fetchDataModelInfo
    );

    const qcResultsService = new QcResultService(authorizationService);

    const dataRecordArchiveCollection = new MongoDBCollection(
      dbConnector.client,
      DATABASE_NAME,
      DATA_RECORDS_ARCHIVE_COLLECTION
    );
    const dataRecordService = new DataRecordService(
      dataRecordArchiveCollection,
      config.file_queue,
      config.metadata_queue,
      awsService,
      s3Service,
      qcResultsService,
      config.export_queue,
      configurationService
    );
    qcResultsService.setDataRecordService(dataRecordService);

    const emailParams = {
      url: config.emails_url,
      officialEmail: config.official_email,
      inactiveDays: config.inactive_application_days,
      remindDay: config.remind_application_days,
      submissionSystemPortal: config.submission_system_portal,
      submissionHelpdesk: config.submission_helpdesk,
      remindSubmissionDay: config.inactiveSubmissionNotifyDays,
      techSupportEmail: config.techSupportEmail,
      conditionalSubmissionContact: config.conditionalSubmissionContact,
      submissionGuideURL: config.submissionGuideUrl,
      completedSubmissionDays: config.completed_submission_days,
      inactiveSubmissionDays: config.inactive_submission_days,
      finalRemindSubmissionDay: config.inactive_submission_days,
      inactiveApplicationNotifyDays: config.inactiveApplicationNotifyDays,
    };

    const uploadingMonitor = UploadingMonitor.getInstance(
      batchService.batchDAO,
      configurationService
    );

    const tooltipService = new TooltipService();
    const dataModelService = new DataModelService(fetchDataModelInfo, configurationService);
    const dataSyncService = new DataSyncService();
    const submissionService = new Submission(
      logCollection,
      submissionCollection,
      batchService,
      userService,
      programService,
      notificationsService,
      dataRecordService,
      fetchDataModelInfo,
      awsService,
      config.export_queue,
      s3Service,
      emailParams,
      config.dataCommonsList,
      config.sqs_loader_queue,
      qcResultsService,
      config.uploaderCLIConfigs,
      config.submission_bucket,
      configurationService,
      uploadingMonitor,
      config.dataCommonsBucketMap,
      authorizationService,
      dataModelService,
      dataSyncService
    );
    const dataInterface = new Application(
      logCollection,
      applicationCollection,
      approvedStudiesService,
      userService,
      dbService,
      notificationsService,
      emailParams,
      programService,
      institutionService,
      configurationService,
      authorizationService
    );

    const dashboardService = new DashboardService(
      userService,
      awsService,
      configurationService,
      { sessionTimeout: config.dashboardSessionTimeout },
      authorizationService
    );
    userInitializationService = new UserInitializationService(
      userCollection,
      organizationCollection,
      approvedStudiesCollection,
      configurationService
    );
    authenticationService = new AuthenticationService(userCollection);

    const releaseService = new Release(authorizationService, dataModelService, s3Service, config);
    root = {
      version: () => config.version,
      saveApplication: dataInterface.saveApplication.bind(dataInterface),
      getApplication: dataInterface.getApplication.bind(dataInterface),
      reviewApplication: dataInterface.reviewApplication.bind(dataInterface),
      getMyLastApplication: dataInterface.getMyLastApplication.bind(dataInterface),
      listApplications: dataInterface.listApplications.bind(dataInterface),
      submitApplication: dataInterface.submitApplication.bind(dataInterface),
      approveApplication: async (params, context) => {
        if (params?.comment?.length > CONSTRAINTS.APPROVE_COMMENT_MAX_LENGTH) {
          throw new Error(
            replaceErrorString(ERROR.COMMENT_LIMIT, CONSTRAINTS.APPROVE_COMMENT_MAX_LENGTH)
          );
        }
        const comment = sanitizeHtml(params?.comment, {
          allowedTags: [],
          allowedAttributes: {},
        })?.trim();
        return dataInterface.approveApplication({ ...params, comment }, context);
      },
      rejectApplication: async (params, context) => {
        if (params?.comment?.length > CONSTRAINTS.REJECT_COMMENT_MAX_LENGTH) {
          throw new Error(
            replaceErrorString(ERROR.COMMENT_LIMIT, CONSTRAINTS.REJECT_COMMENT_MAX_LENGTH)
          );
        }
        const comment = sanitizeHtml(params?.comment, {
          allowedTags: [],
          allowedAttributes: {},
        })?.trim();
        return dataInterface.rejectApplication({ ...params, comment }, context);
      },
      inquireApplication: async (params, context) => {
        if (params?.comment?.length > CONSTRAINTS.INQUIRE_COMMENT_MAX_LENGTH) {
          throw new Error(
            replaceErrorString(ERROR.COMMENT_LIMIT, CONSTRAINTS.INQUIRE_COMMENT_MAX_LENGTH)
          );
        }
        const comment = sanitizeHtml(params?.comment, {
          allowedTags: [],
          allowedAttributes: {},
        })?.trim();
        return dataInterface.inquireApplication({ ...params, comment }, context);
      },
      resumeInquiredApplication: dataInterface.resumeInquiredApplication.bind(dataInterface),
      reopenApprovedSubmissionRequest:
        dataInterface.reopenApprovedSubmissionRequest.bind(dataInterface),
      reopenApplication: dataInterface.resumeInquiredApplication.bind(dataInterface),
      cancelApplication: async (params, context) => {
        if (params?.comment?.length > CONSTRAINTS.CANCEL_COMMENT_MAX_LENGTH) {
          throw new Error(
            replaceErrorString(ERROR.COMMENT_LIMIT, CONSTRAINTS.CANCEL_COMMENT_MAX_LENGTH)
          );
        }
        const comment = sanitizeHtml(params?.comment, {
          allowedTags: [],
          allowedAttributes: {},
        })?.trim();
        return dataInterface.cancelApplication({ ...params, comment }, context);
      },
      restoreApplication: async (params, context) => {
        if (params?.comment?.length > CONSTRAINTS.RESTORE_COMMENT_MAX_LENGTH) {
          throw new Error(
            replaceErrorString(ERROR.COMMENT_LIMIT, CONSTRAINTS.RESTORE_COMMENT_MAX_LENGTH)
          );
        }
        const comment = sanitizeHtml(params?.comment, {
          allowedTags: [],
          allowedAttributes: {},
        })?.trim();
        return dataInterface.restoreApplication({ ...params, comment }, context);
      },
      listApprovedStudies:
        approvedStudiesService.listApprovedStudiesAPI.bind(approvedStudiesService),
      createApprovedStudy: approvedStudiesService.addApprovedStudyAPI.bind(approvedStudiesService),
      updateApprovedStudy: approvedStudiesService.editApprovedStudyAPI.bind(approvedStudiesService),
      getApprovedStudy: approvedStudiesService.getApprovedStudyAPI.bind(approvedStudiesService),
      createBatch: submissionService.createBatch.bind(submissionService),
      updateBatch: submissionService.updateBatch.bind(submissionService),
      listBatches: submissionService.listBatches.bind(submissionService),
      listDataSyncs: submissionService.listDataSyncs.bind(submissionService),
      getLatestDataSync: submissionService.getLatestDataSync.bind(submissionService),
      createSubmission: submissionService.createSubmission.bind(submissionService),
      listSubmissions: submissionService.listSubmissions.bind(submissionService),
      getSubmission: submissionService.getSubmission.bind(submissionService),
      createTempCredentials: async (params, context) => {
        const aSubmission = await submissionService.verifyTempCredential(
          params?.submissionID,
          context?.userInfo
        );
        return awsService.createTempCredentials(aSubmission.bucketName, aSubmission.rootPath);
      },
      submissionAction: submissionService.submissionAction.bind(submissionService),
      validateSubmission: submissionService.validateSubmission.bind(submissionService),
      submissionStats: submissionService.submissionStats.bind(submissionService),
      aggregatedSubmissionQCResults:
        qcResultsService.aggregatedSubmissionQCResultsAPI.bind(qcResultsService),
      submissionQCResults: qcResultsService.submissionQCResultsAPI.bind(qcResultsService),
      submissionCrossValidationResults:
        submissionService.submissionCrossValidationResults.bind(submissionService),
      listSubmissionNodeTypes: submissionService.listSubmissionNodeTypes.bind(submissionService),
      getSubmissionNodes: submissionService.listSubmissionNodes.bind(submissionService),
      getNodeDetail: submissionService.getNodeDetail.bind(submissionService),
      getRelatedNodes: submissionService.getRelatedNodes.bind(submissionService),
      retrieveCLIConfig: submissionService.getUploaderCLIConfigs.bind(submissionService),
      listPotentialCollaborators:
        submissionService.listPotentialCollaborators.bind(submissionService),
      retrieveFileNodeConfig: submissionService.getDataFileConfigs.bind(submissionService),
      retrieveReleasedDataByID: submissionService.getReleasedNodeByIDs.bind(submissionService),
      retrieveSubmissionQCComparisons:
        qcResultsService.retrieveSubmissionQCComparisonsAPI.bind(qcResultsService),
      updateSubmissionInfo: submissionService.updateSubmissionInfo.bind(submissionService),
      editSubmission: submissionService.editSubmission.bind(submissionService),
      listInstitutions: institutionService.listInstitutions.bind(institutionService),
      updateInstitution: async (params, context) => {
        const aInstitution = await institutionService.updateInstitution(params, context);
        await userService.updateUserInstitution(
          aInstitution?._id,
          aInstitution?.name,
          aInstitution?.status
        );
        return aInstitution;
      },
      getInstitution: institutionService.getInstitution.bind(institutionService),
      createInstitution: institutionService.createInstitution.bind(institutionService),

      // AuthZ
      getMyUser: userInitializationService.getMyUser.bind(userInitializationService),
      getUser: userService.getUser.bind(userService),
      updateMyUser: userService.updateMyUser.bind(userService),
      listUsers: userService.listUsers.bind(userService),
      listReopenOwners: userService.listReopenOwners.bind(userService),
      editUser: userService.editUser.bind(userService),
      grantToken: userService.grantToken.bind(userService),
      listActiveDCPs: userService.listActiveDCPsAPI.bind(userService),
      listPrograms: programService.listPrograms.bind(programService),
      getOrganization: async (params, context) => {
        const userScope = await getOrgUserScope(
          authorizationService,
          context?.userInfo,
          ADMIN.MANAGE_PROGRAMS
        );
        if (userScope.isNoneScope()) {
          throw new Error(ERROR.VERIFY.INVALID_PERMISSION);
        }
        return programService.getProgramAPI(params, context);
      },
      editOrganization: async (params, context) => {
        const userScope = await getOrgUserScope(
          authorizationService,
          context?.userInfo,
          ADMIN.MANAGE_PROGRAMS
        );
        if (userScope.isNoneScope()) {
          throw new Error(ERROR.VERIFY.INVALID_PERMISSION);
        }
        return programService.editProgramAPI(params, context);
      },
      createOrganization: async (params, context) => {
        const userScope = await getOrgUserScope(
          authorizationService,
          context?.userInfo,
          ADMIN.MANAGE_PROGRAMS
        );
        if (userScope.isNoneScope()) {
          throw new Error(ERROR.VERIFY.INVALID_PERMISSION);
        }
        return programService.createProgramAPI(params, context);
      },
      deleteDataRecords: submissionService.deleteDataRecords.bind(submissionService),
      getDashboardURL: dashboardService.getDashboardURL.bind(dashboardService),
      editSubmissionCollaborators:
        submissionService.editSubmissionCollaborators.bind(submissionService),
      requestAccess: async (params, context) => {
        const institutionName = sanitizeHtml(params?.institutionName, {
          allowedTags: [],
          allowedAttributes: {},
        });
        return userService.requestAccess({ ...params, institutionName }, context);
      },
      retrievePBACDefaults: configurationService.getPBACDefaults.bind(configurationService),
      downloadMetadataFile: submissionService.getMetadataFile.bind(submissionService),
      retrieveCLIUploaderVersion:
        configurationService.retrieveCLIUploaderVersion.bind(configurationService),
      getApplicationFormVersion:
        configurationService.getApplicationFormVersion.bind(configurationService),
      userIsPrimaryContact: userService.isUserPrimaryContact.bind(userService),
      isMaintenanceMode: configurationService.isMaintenanceMode.bind(configurationService),
      isChatBotEnabled: configurationService.isChatBotEnabled.bind(configurationService),
      getTooltips: tooltipService.getTooltips.bind(tooltipService),
      getSubmissionAttributes: submissionService.getSubmissionAttributes.bind(submissionService),
      listReleasedStudies: releaseService.listReleasedStudies.bind(releaseService),
      getReleaseNodeTypes: releaseService.getReleaseNodeTypes.bind(releaseService),
      getPendingPVs: submissionService.getPendingPVs.bind(submissionService),
      listReleasedDataRecords: releaseService.listReleasedDataRecords.bind(releaseService),
      retrievePropsForNodeType: releaseService.getPropsForNodeType.bind(releaseService),
      requestPV: async (params, context) => {
        const fieldsToSanitize = ["comment", "nodeName", "property"];
        const sanitized = Object.fromEntries(
          fieldsToSanitize.map((field) => [
            field,
            sanitizeHtml(params?.[field], { allowedTags: [], allowedAttributes: {} }),
          ])
        );
        return submissionService.requestPV({ ...params, ...sanitized }, context);
      },
      downloadDBGaPLoadSheet: submissionService.downloadDBGaPLoadSheet.bind(submissionService),
      downloadDCFManifest: submissionService.downloadDCFManifest.bind(submissionService),
      getOMB: configurationService.getOMB.bind(configurationService),
      downloadAllReleasedNodes: releaseService.downloadAllReleasedNodes.bind(releaseService),
      getSubmissionSummary: submissionService.getSubmissionSummary.bind(submissionService),
      retrievePVsByPropertyName:
        propertyPVService.retrievePVsByPropertyName.bind(propertyPVService),
    };
    dataModelService
      .refreshHiddenModels()
      .then(() =>
        console.log(`Hidden models initialized: [${dataModelService.hiddenDataModels.join(", ")}]`)
      )
      .catch((error) => console.error("Failed to initialize hidden models:", error));
  })
  .catch((error) => {
    console.error("GraphQL router initialization failed:", error);
    process.exit(1);
  });

module.exports = (req, res, next) => {
  apiAuthorization(req, authenticationService, userInitializationService, publicAPIList)
    .then(() => {
      createHandler({
        schema,
        rootValue: root,
        context: req.session,
      })(req, res);
    })
    .catch((error) => {
      next(error);
    });
};
