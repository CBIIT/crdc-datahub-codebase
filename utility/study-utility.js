/**
 * Utility functions for study-related operations
 */

const { APPROVED_STUDY_STATUS } = require("../crdc-datahub-database-drivers/constants/approved-study-constants");

/**
 * True when the approved study document is usable as an active study (status === Active).
 * @param {{ status?: string }|null|undefined} study
 * @returns {boolean}
 */
function isApprovedStudyActive(study) {
    return study?.status === APPROVED_STUDY_STATUS.ACTIVE;
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
};
