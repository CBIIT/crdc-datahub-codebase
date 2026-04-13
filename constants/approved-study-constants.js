/**
 * Approved study lifecycle status (stored on ApprovedStudy.status).
 */
const APPROVED_STUDY_STATUS = Object.freeze({
    ACTIVE: "Active",
    INACTIVE: "Inactive",
});

/** Max length of the `statuses` filter array for listApprovedStudies (one slot per distinct valid status). */
const APPROVED_STUDY_STATUS_FILTER_MAX_LENGTH = Object.keys(APPROVED_STUDY_STATUS).length;

module.exports = Object.freeze({
    APPROVED_STUDY_STATUS,
    APPROVED_STUDY_STATUS_FILTER_MAX_LENGTH,
});
