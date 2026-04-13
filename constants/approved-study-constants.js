/**
 * Approved study lifecycle status (stored on ApprovedStudy.status).
 */
const APPROVED_STUDY_STATUS = Object.freeze({
    ACTIVE: "Active",
    INACTIVE: "Inactive",
});

/** Maximum number of distinct approved study statuses defined in APPROVED_STUDY_STATUS. */
const APPROVED_STUDY_STATUS_FILTER_MAX_LENGTH = Object.keys(APPROVED_STUDY_STATUS).length;

module.exports = Object.freeze({
    APPROVED_STUDY_STATUS,
    APPROVED_STUDY_STATUS_FILTER_MAX_LENGTH,
});
