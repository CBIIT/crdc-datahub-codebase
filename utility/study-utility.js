/**
 * Utility functions for study-related operations
 */

const ERROR = require("../constants/error-constants");
const { APPROVED_STUDY_STATUS } = require("../crdc-datahub-database-drivers/constants/approved-study-constants");

/**
 * @param {string} status
 * @returns {boolean}
 */
function isValidApprovedStudyStatus(status) {
    return status === APPROVED_STUDY_STATUS.ACTIVE || status === APPROVED_STUDY_STATUS.INACTIVE;
}

/**
 * True when the approved study document is usable as an active study (status === Active).
 * @param {{ status?: string }|null|undefined} study
 * @returns {boolean}
 */
function isApprovedStudyActive(study) {
    return study?.status === APPROVED_STUDY_STATUS.ACTIVE;
}

/**
 * Trims and validates a value for ApprovedStudy.status (or listApprovedStudies statuses filter).
 * @param {unknown} raw
 * @returns {string} "Active" or "Inactive"
 * @throws {Error} when not Active or Inactive after trim
 */
function parseApprovedStudyStatusInput(raw) {
    const s = String(raw).trim();
    if (!isValidApprovedStudyStatus(s)) {
        throw new Error(ERROR.INVALID_APPROVED_STUDY_STATUS);
    }
    return s;
}

/**
 * Checks if a user has access to all studies.
 * Determines whether the user studies array contains an "All" value, indicating
 * unrestricted access to all studies in the system.
 * 
 * @param {Array|string} userStudies - User's assigned studies (can be array of objects/strings or single value)
 * @returns {boolean} True if user has access to all studies, false otherwise
 */
const isAllStudy = (userStudies) => {
    const studies = Array.isArray(userStudies) && userStudies.length > 0 ? userStudies : [];
    return Boolean(studies.find(study =>
        (typeof study === 'object' && study._id === "All") ||
        (typeof study === 'object' && study.id === "All") ||
        (typeof study === 'string' && study === "All")
    ));
};

module.exports = {
    isAllStudy,
    isApprovedStudyActive,
    isValidApprovedStudyStatus,
    parseApprovedStudyStatusInput,
};
