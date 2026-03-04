module.exports = Object.freeze({
    // MongoDB Collections
    DATABASE_NAME: process.env.DATABASE_NAME || 'crdc-datahub',
    SESSION_COLLECTION: 'sessions',
    APPLICATION_COLLECTION: 'applications',
    SUBMISSIONS_COLLECTION: 'submissions',
    APPROVED_STUDIES_COLLECTION: 'approvedStudies',
    DATA_COMMONS_COLLECTION: 'dataCommons',
    USER_COLLECTION: 'users',
    ORGANIZATION_COLLECTION: 'organization',
    LOG_COLLECTION: 'logs',
    DATA_RECORDS_COLLECTION: 'dataRecords',
    INSTITUTION_COLLECTION: 'institutions',
    VALIDATION_COLLECTION: 'validation',
    CONFIGURATION_COLLECTION: 'configuration',
    CDE_COLLECTION : 'CDE',
    DATA_RECORDS_ARCHIVE_COLLECTION: 'dataRecordsArchived',
    QC_RESULTS_COLLECTION: 'qcResults',
    RELEASE_DATA_RECORDS_COLLECTION: "release",
    PENDING_PVS_COLLECTION: "pendingPvs"
});
