const { isTrue } = require('../crdc-datahub-database-drivers/utility/string-utility');
const { EMAIL_NOTIFICATIONS } = require('../crdc-datahub-database-drivers/constants/user-permission-constants');

const getPendingConditionsAtApproval = (approvedStudy = {}) => {
    const pendingDbGaPID = isTrue(approvedStudy.controlledAccess) && !approvedStudy.dbGaPID;
    const conditions = [];
    if (isTrue(pendingDbGaPID)) {
        conditions.push(EMAIL_NOTIFICATIONS.SUBMISSION_REQUEST.REQUEST_PENDING_DBGAPID);
    }
    if (isTrue(approvedStudy.pendingModelChange)) {
        conditions.push(EMAIL_NOTIFICATIONS.SUBMISSION_REQUEST.REQUEST_PENDING_MODEL_UPDATE);
    }
    if (isTrue(approvedStudy.pendingImageDeIdentification)) {
        conditions.push(EMAIL_NOTIFICATIONS.SUBMISSION_REQUEST.REQUEST_PENDING_IMAGE_DEIDENTIFICATION);
    }
    return conditions;
};

module.exports = {
    getPendingConditionsAtApproval
};
