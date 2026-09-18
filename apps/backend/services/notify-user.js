const {createEmailTemplate, EmailContentUnavailableError} = require("../lib/create-email-template");
const {getEmailContentCache, getUninitializedCacheLogMessage, EMAIL_CONTENT_LOG_PREFIX} = require("../lib/email-content-cache");
const {getInvalidEmailConstantKeys} = require("../lib/email-content-constants");
const sanitizeHtml = require('sanitize-html');
const {replaceMessageVariables} = require("../utility/string-util");
const {defaultStudyAbbreviationToNA} = require("../utility/study-abbrev-helpers");
const {
    sanitizeAllowlistedHtml,
    PRESET_SR_APPROVAL_PENDING_HTML,
    PRESET_NOTIFICATION_TEXT_HTML
} = require("../utility/sanitize-allowlisted-html");
const NOTIFICATION_USER_HTML_TEMPLATE = "notification-template-user.html";
const ROLE = "Role";
const DATA_COMMONS = "Data Commons";
const STUDIES = "Studies";
const INSTITUTION = "Institution";
const CRDC_PORTAL_USER = "CRDC Submission Portal User";
const CRDC_SUBMISSION_PORTAL ="CRDC Submission Portal";
const USER_NAME = "User Name"
const ACCOUNT_TYPE = "Account Type";
const ACCOUNT_EMAIL = "Account Email";
const REQUESTED_ROLE = "Requested Role";
const ADDITIONAL_INFO = "Additional Info";
const AFFILIATED_INSTITUTION = "Affiliated Institution";

const SUBMITTER_NAME = "Submitter Name";
const SUBMITTER_EMAIL = "Submitter Email";
const STUDY_NAME = "Study Name";
const STUDY_ABBREVIATION = "Study Abbreviation";
const DATA_SUBMISSION_ID = "Data Submission ID";
const NODE = "Node";
const PROPERTY = "Property";
const CDE_ID = "CDE ID";
const REQUESTED_PERMISSIVE_VALUE = "Requested Permissive Value";
const JUSTIFICATION = "Justification";

const PRESET_PLAIN_TEXT_HTML = { allowedTags: [], allowedAttributes: {} };

/**
 * Strips HTML from a single runtime interpolation value.
 * @param {unknown} value
 * @returns {string}
 */
function sanitizePlainTextVariable(value) {
    if (value == null) {
        return '';
    }
    return sanitizeAllowlistedHtml(String(value), PRESET_PLAIN_TEXT_HTML);
}

/**
 * Strips HTML from each interpolation value so user-controlled copy cannot inject anchors.
 * @param {object} [messageVariables]
 * @returns {object|undefined}
 */
function sanitizeMessageVariables(messageVariables) {
    if (!messageVariables || typeof messageVariables !== 'object') {
        return messageVariables;
    }
    const sanitized = {};
    for (const key of Object.keys(messageVariables)) {
        sanitized[key] = sanitizePlainTextVariable(messageVariables[key]);
    }
    return sanitized;
}

/**
 * Interpolates plain-text variables into trusted YAML HTML, then sanitizes the fragment.
 * @param {string} yamlValue
 * @param {object} [messageVariables]
 * @returns {string}
 */
function sanitizeNotificationBody(yamlValue, messageVariables) {
    return sanitizeAllowlistedHtml(
        replaceMessageVariables(yamlValue, sanitizeMessageVariables(messageVariables)),
        PRESET_NOTIFICATION_TEXT_HTML
    );
}

/**
 * Interpolates plain-text variables into a pending-condition YAML snippet, then sanitizes it.
 * @param {string} yamlValue
 * @param {object} [templateParams]
 * @returns {string}
 */
function sanitizePendingConditionHtml(yamlValue, templateParams) {
    return sanitizeAllowlistedHtml(
        replaceMessageVariables(yamlValue, sanitizeMessageVariables(templateParams)),
        PRESET_SR_APPROVAL_PENDING_HTML
    );
}

class NotifyUser {

    /**
     * @param {object} emailService
     * @param {string} [tier] Subject prefix such as `[DEV]`
     * @param {object} [emailContentCache] Cache override for tests
     */
    constructor(emailService, tier, emailContentCache) {
        this.emailService = emailService;
        this.email_constants = undefined;
        this.tier = tier;
        this.emailContentCache = emailContentCache;
    }

    /**
     * Reloads YAML copy from the email content cache.
     * Logs when the cache is not initialized so the send is skipped.
     * @returns {Promise<boolean>}
     */
    async _refreshEmailConstants() {
        const cache = this.emailContentCache || getEmailContentCache();
        const parsed = cache ? await cache.getYaml() : undefined;
        const uninitializedMessage = cache && typeof cache.getUninitializedCacheLogMessage === 'function'
            ? cache.getUninitializedCacheLogMessage()
            : getUninitializedCacheLogMessage(0);
        if (parsed == null) {
            this.email_constants = undefined;
            console.error(uninitializedMessage);
            return false;
        }
        const invalidKeys = getInvalidEmailConstantKeys(parsed);
        if (invalidKeys.length > 0) {
            this.email_constants = undefined;
            if (invalidKeys[0] === '<root>') {
                console.error(`${EMAIL_CONTENT_LOG_PREFIX} Email not sent: email YAML is not a mapping`);
            } else {
                console.error(
                    `${EMAIL_CONTENT_LOG_PREFIX} Email not sent: email YAML missing or invalid keys: ${invalidKeys.join(', ')}`
                );
            }
            return false;
        }
        this.email_constants = parsed;
        return true;
    }

    /**
     * Runs the send callback. Assumes this.email_constants is already set by the caller.
     * Skips the send when the HTML template cannot be loaded or compiled.
     * @param {Function} fn
     * @returns {Promise<*>}
     */
    async send(fn){
        try {
            return await fn();
        } catch (e) {
            if (e instanceof EmailContentUnavailableError) {
                console.error(e.message);
                return;
            }
            throw e;
        }
    }

    /**
     * Sends the SRC review-needed notification for a submitted SRF.
     * @param {string|string[]} toEmails
     * @param {string[]} CCEmails
     * @param {string[]} BCCEmails
     * @param {object} messageVariables
     * @returns {Promise<*>}
     */
    async submitQuestionNotification(toEmails, CCEmails, BCCEmails, messageVariables) {
        if (!(await this._refreshEmailConstants())) {
            return;
        }
        const message = sanitizeNotificationBody(this.email_constants.SUBMISSION_SUBMIT_FIRST_CONTENT, messageVariables);
        const secondMessage = sanitizeNotificationBody(this.email_constants.SUBMISSION_SUBMIT_SECOND_CONTENT, messageVariables);
        const subject = this.email_constants.SUBMISSION_SUBJECT;
        return await this.send(async () => {
            await this.emailService.sendNotification(
                this.email_constants.NOTIFICATION_SENDER,
                isTierAdded(this.tier) ? `${this.tier} ${subject}` : subject,
                await createEmailTemplate("notification-template.html", {
                    message, secondMessage, firstName: this.email_constants.APPLICATION_COMMITTEE_NAME
                }),
                toEmails,
                CCEmails,
                BCCEmails
            );
        });
    }

    /**
     * Sends the submitter confirmation that an SRF was received.
     * @param {string|string[]} email
     * @param {string[]} CCEmails
     * @param {string[]} BCCsEmails
     * @param {object} messageVariables
     * @param {object} templateParams
     * @returns {Promise<*>}
     */
    async submitRequestReceivedNotification(email, CCEmails, BCCsEmails, messageVariables, templateParams) {
        if (!(await this._refreshEmailConstants())) {
            return;
        }
        const message = sanitizeNotificationBody(this.email_constants.SUBMISSION_SUBMIT_RECEIVE_CONTENT_FIRST, {});
        const secondMessage = sanitizeNotificationBody(this.email_constants.SUBMISSION_SUBMIT_RECEIVE_CONTENT_SECOND, messageVariables);
        const subject = this.email_constants.SUBMISSION_SUBMIT_RECEIVE_SUBJECT;
        return await this.send(async () => {
            const res = await this.emailService.sendNotification(
                this.email_constants.NOTIFICATION_SENDER,
                isTierAdded(this.tier) ? `${this.tier} ${subject}` : subject,
                await createEmailTemplate("notification-template.html", {
                    message, secondMessage, firstName: templateParams.userName
                }),
                email,
                CCEmails,
                BCCsEmails
            );
            if (res?.accepted?.length === 0) {
                console.error(`Failed to send Submission Request Email Notifications: ${email}`);
            }
        });
    }

    /**
     * Sends the inactive-SRF reminder to the submitter.
     * @param {string|string[]} email
     * @param {string[]} CCEmails
     * @param {string[]} BCCEmails
     * @param {object} template_params
     * @param {object} messageVariables
     * @returns {Promise<*>}
     */
    async inactiveApplicationsNotification(email, CCEmails, BCCEmails, template_params, messageVariables) {
        if (!(await this._refreshEmailConstants())) {
            return;
        }
        const message = sanitizeNotificationBody(this.email_constants.INACTIVE_APPLICATION_CONTENT, messageVariables);
        const subject = this.email_constants.INACTIVE_APPLICATION_SUBJECT;
        return await this.send(async () => {
            await this.emailService.sendNotification(
                this.email_constants.NOTIFICATION_SENDER,
                isTierAdded(this.tier) ? `${this.tier} ${subject}` : subject,
                await createEmailTemplate("notification-template.html", {
                    message, ...template_params
                }),
                email,
                CCEmails,
                BCCEmails
            );
        });
    }

    /**
     * Sends the canceled-SRF notification.
     * @param {string|string[]} email
     * @param {string[]} CCEmails
     * @param {string[]} BCCsEmails
     * @param {object} templateParams
     * @param {object} messageVariables
     * @returns {Promise<*>}
     */
    async cancelApplicationNotification(email, CCEmails, BCCsEmails, templateParams, messageVariables) {
        if (!(await this._refreshEmailConstants())) {
            return;
        }
        const message = sanitizeNotificationBody(this.email_constants.CANCEL_APPLICATION_CONTENT, messageVariables);
        const subject = this.email_constants.CANCEL_APPLICATION_SUBJECT;
        return await this.send(async () => {
            const res = await this.emailService.sendNotification(
                this.email_constants.NOTIFICATION_SENDER,
                isTierAdded(this.tier) ? `${this.tier} ${subject}` : subject,
                await createEmailTemplate("notification-template.html", {
                    message, firstName: templateParams.firstName
                }),
                email,
                CCEmails,
                BCCsEmails
            );
            if (res?.accepted?.length === 0) {
                console.error(`Failed to send Cancel Submission Request Email Notifications: ${email}`);
            }
        });
    }

    /**
     * Sends the restored-SRF notification.
     * @param {string|string[]} email
     * @param {string[]} CCEmails
     * @param {string[]} BCCsEmails
     * @param {object} templateParams
     * @param {object} messageVariables
     * @returns {Promise<*>}
     */
    async restoreApplicationNotification(email, CCEmails, BCCsEmails, templateParams, messageVariables) {
        if (!(await this._refreshEmailConstants())) {
            return;
        }
        const message = sanitizeNotificationBody(this.email_constants.RESTORE_APPLICATION_CONTENT, messageVariables);
        const secondMessage = sanitizeNotificationBody(this.email_constants.RESTORE_APPLICATION_SECOND_CONTENT, messageVariables);
        const thirdMessage = sanitizeNotificationBody(this.email_constants.RESTORE_APPLICATION_THIRD_CONTENT, messageVariables);
        const subject = this.email_constants.RESTORE_APPLICATION_SUBJECT;
        return await this.send(async () => {
            const res = await this.emailService.sendNotification(
                this.email_constants.NOTIFICATION_SENDER,
                isTierAdded(this.tier) ? `${this.tier} ${subject}` : subject,
                await createEmailTemplate("notification-template.html", {
                    message, secondMessage, thirdMessage, firstName: templateParams.firstName
                }),
                email,
                CCEmails,
                BCCsEmails
            );
            if (res?.accepted?.length === 0) {
                console.error(`Failed to send Restore Submission Request Email Notifications: ${email}`);
            }
        });
    }

    /**
     * Sends the reopened-SRF notification.
     * @param {string|string[]} email
     * @param {string[]} CCEmails
     * @param {string[]} BCCsEmails
     * @param {object} templateParams
     * @param {object} messageVariables
     * @returns {Promise<*>}
     */
    async reopenApplicationNotification(email, CCEmails, BCCsEmails, templateParams, messageVariables) {
        if (!(await this._refreshEmailConstants())) {
            return;
        }
        const message = sanitizeNotificationBody(this.email_constants.REOPEN_APPLICATION_CONTENT, messageVariables);
        const secondMessage = sanitizeNotificationBody(this.email_constants.REOPEN_APPLICATION_SECOND_CONTENT, messageVariables);
        const thirdMessage = sanitizeNotificationBody(this.email_constants.REOPEN_APPLICATION_THIRD_CONTENT, messageVariables);
        const subject = this.email_constants.REOPEN_APPLICATION_SUBJECT;
        return await this.send(async () => {
            const res = await this.emailService.sendNotification(
                this.email_constants.NOTIFICATION_SENDER,
                isTierAdded(this.tier) ? `${this.tier} ${subject}` : subject,
                await createEmailTemplate("notification-template-sr-reopen.html", {
                    message,
                    secondMessage,
                    thirdMessage,
                    firstName: templateParams.firstName,
                    studyName: messageVariables.studyName,
                    studyAbbreviation: messageVariables.studyAbbreviation,
                    programName: messageVariables.programName,
                    programAbbreviation: messageVariables.programAbbreviation,
                    isOwnershipChanged: templateParams.isOwnershipChanged
                }),
                email,
                CCEmails,
                BCCsEmails
            );
            if (res?.accepted?.length === 0) {
                console.error(`Failed to send Reopen Submission Request Email Notifications: ${email}`);
            }
        });
    }

    /**
     * Sends the SRF inquire / request-for-information email.
     * @param {string|string[]} email
     * @param {string[]} CCEmails
     * @param {string[]} BCCEmails
     * @param {object} templateParams
     * @param {object} messageVariables
     * @returns {Promise<*>}
     */
    async inquireQuestionNotification(email, CCEmails, BCCEmails, templateParams, messageVariables) {
        if (!(await this._refreshEmailConstants())) {
            return;
        }
        const message = sanitizeNotificationBody(this.email_constants.INQUIRE_CONTENT, messageVariables);
        const secondMessage = sanitizeNotificationBody(this.email_constants.INQUIRE_SECOND_CONTENT, messageVariables);
        const thirdMessage = sanitizeNotificationBody(this.email_constants.INQUIRE_THIRD_CONTENT, messageVariables);
        const subject = this.email_constants.INQUIRE_SUBJECT;
        return await this.send(async () => {
            await this.emailService.sendNotification(
                this.email_constants.NOTIFICATION_SENDER,
                isTierAdded(this.tier) ? `${this.tier} ${subject}` : subject,
                await createEmailTemplate("notification-template-sr-inquire.html", {
                    message, secondMessage, thirdMessage, ...templateParams
                }),
                email,
                CCEmails,
                BCCEmails
            );
        });
    }

    /**
     * Sends the rejected-SRF notification.
     * @param {string|string[]} email
     * @param {string[]} toCCEmails
     * @param {string[]} toBCCEmails
     * @param {object} templateParams
     * @param {object} messageVariables
     * @returns {Promise<*>}
     */
    async rejectQuestionNotification(email, toCCEmails, toBCCEmails, templateParams, messageVariables) {
        if (!(await this._refreshEmailConstants())) {
            return;
        }
        const message = sanitizeNotificationBody(this.email_constants.REJECT_CONTENT, messageVariables);
        const secondMessage = sanitizeNotificationBody(this.email_constants.REJECT_SECOND_CONTENT, {});
        const subject = this.email_constants.REJECT_SUBJECT;
        return await this.send(async () => {
            await this.emailService.sendNotification(
                this.email_constants.NOTIFICATION_SENDER,
                isTierAdded(this.tier) ? `${this.tier} ${subject}` : subject,
                await createEmailTemplate("notification-template.html", {
                    message, secondMessage, ...templateParams
                }),
                email,
                toCCEmails,
                toBCCEmails
            );
        });
    }

    /**
     * Sends the approved-SRF notification with no pending conditions.
     * @param {string|string[]} email
     * @param {string[]} CCEmails
     * @param {string[]} BCCEmails
     * @param {object} templateParams
     * @param {object} messageVariables
     * @returns {Promise<*>}
     */
    async approveQuestionNotification(email, CCEmails, BCCEmails, templateParams, messageVariables) {
        if (!(await this._refreshEmailConstants())) {
            return;
        }
        return await this.send(async () => {
            const message = sanitizeNotificationBody(this.email_constants.APPROVE_CONTENT, messageVariables);
            const secondMessage = sanitizeNotificationBody(this.email_constants.APPROVE_SECOND_CONTENT, messageVariables);
            const thirdMessage = sanitizeNotificationBody(this.email_constants.APPROVE_THIRD_CONTENT, messageVariables);
            const subject = this.email_constants.APPROVE_SUBJECT;
            await this.emailService.sendNotification(
                this.email_constants.NOTIFICATION_SENDER,
                isTierAdded(this.tier) ? `${this.tier} ${subject}` : subject,
                await createEmailTemplate("notification-template.html", {
                    message, secondMessage, thirdMessage, ...templateParams
                }),
                email,
                CCEmails,
                BCCEmails
            );
        });
    }

    /**
     * Sends the approved-SRF email when dbGaP is still pending.
     * @param {string|string[]} email
     * @param {string[]} CCEmails
     * @param {string[]} BCCEmails
     * @param {object} templateParams
     * @returns {Promise<*>}
     */
    async dbGapMissingApproveQuestionNotification(email, CCEmails, BCCEmails, templateParams) {
        if (!(await this._refreshEmailConstants())) {
            return;
        }
        return await this.send(async () => {
            const subject = this.email_constants.APPROVE_SUBJECT;
            const topMessage = sanitizeNotificationBody(this.email_constants.SINGLE_PENDING_PENDING_TOP_MESSAGE, templateParams);
            const missingDbGapPendingCondition = sanitizePendingConditionHtml(
                this.email_constants.MISSING_DBGAP_PENDING_CHANGE,
                templateParams
            );
            await this.emailService.sendNotification(
                this.email_constants.NOTIFICATION_SENDER,
                isTierAdded(this.tier) ? `${this.tier} ${subject}` : subject,
                await createEmailTemplate("notification-template-SR-pending-conditions.html", {
                    pendingConditions: [missingDbGapPendingCondition],
                    topMessage,
                    ...templateParams,
                    isMultiplePendingConditions: false
                }),
                email,
                CCEmails,
                BCCEmails
            );
        });
    }

    /**
     * Sends the approved-SRF email when GPA information is still pending.
     * @param {string|string[]} email
     * @param {string[]} CCEmails
     * @param {string[]} BCCEmails
     * @param {object} templateParams
     * @returns {Promise<*>}
     */
    async pendingGPANotification(email, CCEmails, BCCEmails, templateParams) {
        if (!(await this._refreshEmailConstants())) {
            return;
        }
        return await this.send(async () => {
            const subject = this.email_constants.APPROVE_SUBJECT;
            const topMessage = sanitizeNotificationBody(this.email_constants.SINGLE_PENDING_PENDING_TOP_MESSAGE, templateParams);
            const GPAPendingCondition = sanitizePendingConditionHtml(
                this.email_constants.MISSING_GPA_INFO,
                templateParams
            );
            await this.emailService.sendNotification(
                this.email_constants.NOTIFICATION_SENDER,
                isTierAdded(this.tier) ? `${this.tier} ${subject}` : subject,
                await createEmailTemplate("notification-template-SR-pending-conditions.html", {
                    pendingConditions: [GPAPendingCondition],
                    topMessage,
                    ...templateParams,
                    isMultiplePendingConditions: false
                }),
                email,
                CCEmails,
                BCCEmails
            );
        });
    }


    /**
     * Sends the approved-SRF email when a data-model change is pending.
     * @param {string|string[]} email
     * @param {string[]} CCEmails
     * @param {string[]} BCCEmails
     * @param {object} templateParams
     * @returns {Promise<*>}
     */
    async dataModelChangeApproveQuestionNotification(email, CCEmails, BCCEmails, templateParams) {
        if (!(await this._refreshEmailConstants())) {
            return;
        }
        return await this.send(async () => {
            const subject = this.email_constants.APPROVE_SUBJECT;
            const topMessage = sanitizeNotificationBody(this.email_constants.SINGLE_PENDING_PENDING_TOP_MESSAGE, templateParams);
            const dataModelPendingCondition = sanitizePendingConditionHtml(
                this.email_constants.DATA_MODEL_PENDING_CHANGE,
                {}
            );
            await this.emailService.sendNotification(
                this.email_constants.NOTIFICATION_SENDER,
                isTierAdded(this.tier) ? `${this.tier} ${subject}` : subject,
                await createEmailTemplate("notification-template-SR-pending-conditions.html", {
                    pendingConditions: [dataModelPendingCondition],
                    topMessage,
                    ...templateParams,
                    omitDataSubmissionInstructionsOnly: true,
                    isMultiplePendingConditions: false
                }),
                email,
                CCEmails,
                BCCEmails
            );
        });
    }

    /**
     * Sends the approved-SRF email when image de-identification is pending.
     * @param {string|string[]} email
     * @param {string[]} CCEmails
     * @param {string[]} BCCEmails
     * @param {object} templateParams
     * @returns {Promise<*>}
     */
    async pendingImageDeIdentificationApproveQuestionNotification(email, CCEmails, BCCEmails, templateParams) {
        if (!(await this._refreshEmailConstants())) {
            return;
        }
        return await this.send(async () => {
            const subject = this.email_constants.APPROVE_SUBJECT;
            const topMessage = sanitizeNotificationBody(this.email_constants.IMAGE_DEIDENTIFICATION_PENDING_TOP_MESSAGE, templateParams);
            const imagePendingCondition = sanitizePendingConditionHtml(
                this.email_constants.PENDING_IMAGE_DEIDENTIFICATION_APPROVE_EMAIL,
                templateParams
            );
            await this.emailService.sendNotification(
                this.email_constants.NOTIFICATION_SENDER,
                isTierAdded(this.tier) ? `${this.tier} ${subject}` : subject,
                await createEmailTemplate("notification-template-SR-pending-conditions.html", {
                    pendingConditions: [imagePendingCondition],
                    topMessage,
                    ...templateParams,
                    omitSubmissionGuideInFooter: true,
                    isMultiplePendingConditions: false
                }),
                email,
                CCEmails,
                BCCEmails
            );
        });
    }

    /**
     * Sends the approved-SRF email with multiple pending conditions.
     * @param {string|string[]} email
     * @param {string[]} CCEmails
     * @param {string[]} BCCEmails
     * @param {object} templateParams
     * @param {boolean} isDbGapMissing
     * @param {boolean} isPendingModelChange
     * @param {boolean} isPendingGPA
     * @param {boolean} isPendingImageDeIdentification
     * @returns {Promise<*>}
     */
    async multipleChangesApproveQuestionNotification(email, CCEmails, BCCEmails, templateParams, isDbGapMissing, isPendingModelChange, isPendingGPA, isPendingImageDeIdentification) {
        if (!(await this._refreshEmailConstants())) {
            return;
        }
        return await this.send(async () => {
            const subject = this.email_constants.APPROVE_SUBJECT;
            const topMessage = sanitizeNotificationBody(this.email_constants.CONDITIONAL_PENDING_MULTIPLE_CHANGES, templateParams);
            const dataModelPendingCondition = sanitizePendingConditionHtml(
                this.email_constants.DATA_MODEL_PENDING_CHANGE_MULTIPLE,
                {}
            );
            const missingDbGapPendingCondition = sanitizePendingConditionHtml(
                this.email_constants.MISSING_DBGAP_PENDING_CHANGE_MULTIPLE,
                templateParams
            );
            const missingGPAPendingCondition = sanitizePendingConditionHtml(
                this.email_constants.MISSING_GPA_INFO_MULTIPLE,
                templateParams
            );
            const imagePendingCondition = sanitizePendingConditionHtml(
                this.email_constants.PENDING_IMAGE_DEIDENTIFICATION_APPROVE_EMAIL_MULTIPLE,
                templateParams
            );
            // Only include valid pending conditions
            const pendingConditions = [
                isDbGapMissing && missingDbGapPendingCondition,
                isPendingModelChange && dataModelPendingCondition,
                isPendingGPA && missingGPAPendingCondition,
                isPendingImageDeIdentification && imagePendingCondition,
            ].filter(Boolean);

            if (pendingConditions.length === 0) {
                console.warn(`Sending Approve Question Email Notification to ${email} with no pending conditions.`);
            }

            await this.emailService.sendNotification(
                this.email_constants.NOTIFICATION_SENDER,
                isTierAdded(this.tier) ? `${this.tier} ${subject}` : subject,
                await createEmailTemplate("notification-template-SR-pending-conditions.html", {
                    pendingConditions: pendingConditions,
                    topMessage,
                    ...templateParams,
                    omitSubmissionGuideInFooter: Boolean(isPendingImageDeIdentification),
                    isMultiplePendingConditions: true
                }),
                email,
                CCEmails,
                BCCEmails
            );
        });
    }

    /**
     * Sends the user role-change notification.
     * @param {string|string[]} email
     * @param {object} templateParams
     * @param {object} messageVariables
     * @returns {Promise<*>}
     */
    async userRoleChangeNotification(email, templateParams, messageVariables) {
        if (!(await this._refreshEmailConstants())) {
            return;
        }
        const topMessage = sanitizeNotificationBody(this.email_constants.USER_ROLE_CHANGE_CONTENT_TOP, messageVariables);
        const bottomMessage = sanitizeNotificationBody(this.email_constants.USER_ROLE_CHANGE_CONTENT_BOTTOM, messageVariables);
        const subject = this.email_constants.USER_ROLE_CHANGE_SUBJECT;
        const additionalInfo = [
            [ACCOUNT_TYPE, templateParams.accountType?.toUpperCase()],
            [ACCOUNT_EMAIL, templateParams.email],
            ...(templateParams.role) ? [[ROLE, templateParams.role]] : [],
            ...(templateParams.dataCommons) ? [[DATA_COMMONS, templateParams.dataCommons]] : [],
            ...(templateParams?.studies?.length > 0) ? [[STUDIES, templateParams.studies]] : [],
            ...(templateParams?.institution) ? [[INSTITUTION, templateParams.institution]] : [],
        ];
        return await this.send(async () => {
            await this.emailService.sendNotification(
                this.email_constants.NOTIFICATION_SENDER,
                isTierAdded(this.tier) ? `${this.tier} ${subject}` : subject,
                await createEmailTemplate(NOTIFICATION_USER_HTML_TEMPLATE, {
                    topMessage, bottomMessage, ...{
                        firstName: CRDC_PORTAL_USER,
                        senderName: CRDC_SUBMISSION_PORTAL,
                        ...templateParams, additionalInfo}
                }),
                email
            );
        });
    }


    /**
     * Sends the inactive-user warning to the account holder.
     * @param {string|string[]} email
     * @param {object} template_params
     * @param {object} messageVariables
     * @returns {Promise<*>}
     */
    async inactiveUserNotification(email, template_params, messageVariables) {
        if (!(await this._refreshEmailConstants())) {
            return;
        }
        const message = sanitizeNotificationBody(this.email_constants.INACTIVE_USER_CONTENT, messageVariables);
        const subject = this.email_constants.INACTIVE_USER_SUBJECT;
        return await this.send(async () => {
            await this.emailService.sendNotification(
                this.email_constants.NOTIFICATION_SENDER,
                isTierAdded(this.tier) ? `${this.tier} ${subject}` : subject,
                await createEmailTemplate("notification-template.html", {
                    message, ...template_params
                }),
                email,
                []
            );
        });
    }

    /**
     * Sends the inactive-user notice to admins.
     * @param {string|string[]} email
     * @param {string[]} BCCEmails
     * @param {object} template_params
     * @param {object} messageVariables
     * @returns {Promise<*>}
     */
    async inactiveUserAdminNotification(email, BCCEmails, template_params, messageVariables) {
        if (!(await this._refreshEmailConstants())) {
            return;
        }
        const message = sanitizeNotificationBody(this.email_constants.INACTIVE_ADMIN_USER_CONTENT, messageVariables);
        const subject = this.email_constants.INACTIVE_ADMIN_USER_SUBJECT;
        const recipientName = this.email_constants.INACTIVE_ADMIN_USER_RECIPIENT_NAME;
        return await this.send(async () => {
            await this.emailService.sendNotification(
                this.email_constants.NOTIFICATION_SENDER,
                isTierAdded(this.tier) ? `${this.tier} ${subject}` : subject,
                await createEmailTemplate("notification-template.html", {
                    message, ...template_params, firstName: recipientName
                }),
                email,
                [],
                BCCEmails
            );
        });
    }

    /**
     * Sends the deleted data-submission notification.
     * @param {string|string[]} email
     * @param {string[]} BCCEmails
     * @param {object} templateParams
     * @param {object} messageVariables
     * @returns {Promise<*>}
     */
    async deleteSubmissionNotification(email, BCCEmails, templateParams, messageVariables) {
        if (!(await this._refreshEmailConstants())) {
            return;
        }
        const message = sanitizeNotificationBody(this.email_constants.SUBMISSION_FIRST_CONTENT, messageVariables);
        const secondMessage = sanitizeNotificationBody(this.email_constants.SUBMISSION_SECOND_CONTENT, messageVariables);
        const subject = this.email_constants.DELETE_SUBMISSION_SUBJECT;
        return await this.send(async () => {
            await this.emailService.sendNotification(
                this.email_constants.NOTIFICATION_SENDER,
                isTierAdded(this.tier) ? `${this.tier} ${subject}` : subject,
                await createEmailTemplate("notification-template.html", {
                    message, secondMessage, ...templateParams
                }),
                email,
                [],
                BCCEmails
            );
        });
    }

    /**
     * Sends the missing-primary-contact reminder.
     * @param {string|string[]} toEmails
     * @param {string[]} CCEmails
     * @param {object} templateParams
     * @returns {Promise<*>}
     */
    async remindNoPrimaryContact(toEmails, CCEmails, templateParams) {
        if (!(await this._refreshEmailConstants())) {
            return;
        }
        const subject = replaceMessageVariables(this.email_constants.REMIND_PRIMARY_CONTACT_SUBJECT, templateParams);
        return await this.send(async () => {
            return await this.emailService.sendNotification(
                this.email_constants.NOTIFICATION_SENDER,
                isTierAdded(this.tier) ? `${this.tier} ${subject}` : subject,
                await createEmailTemplate("notification-template-submission.html", templateParams),
                toEmails,
                CCEmails
            );
        });
    }

    /**
     * Sends the expiring-SRF reminder.
     * @param {string|string[]} email
     * @param {string[]} CCEmails
     * @param {string[]} BCCEmails
     * @param {object} templateParams
     * @param {object} messageVariables
     * @returns {Promise<*>}
     */
    async remindApplicationsNotification(email, CCEmails, BCCEmails, templateParams, messageVariables) {
        if (!(await this._refreshEmailConstants())) {
            return;
        }
        const message = sanitizeNotificationBody(this.email_constants.REMIND_EXPIRED_APPLICATION_CONTENT, messageVariables);
        const secondMessage = sanitizeNotificationBody(this.email_constants.REMIND_EXPIRED_APPLICATION_SECOND_CONTENT, messageVariables);
        const subject = replaceMessageVariables(this.email_constants.REMIND_EXPIRED_APPLICATION_SUBJECT, messageVariables);
        return await this.send(async () => {
            await this.emailService.sendNotification(
                this.email_constants.NOTIFICATION_SENDER,
                isTierAdded(this.tier) ? `${this.tier} ${subject}` : subject,
                await createEmailTemplate("notification-template.html", {
                    message, secondMessage, ...templateParams
                }),
                email,
                CCEmails,
                BCCEmails
            );
        });
    }

    /**
     * Sends the final inactive-SRF reminder.
     * @param {string|string[]} email
     * @param {string[]} CCEmails
     * @param {string[]} BCCEmails
     * @param {object} templateParams
     * @param {object} messageVariables
     * @returns {Promise<*>}
     */
    async finalRemindApplicationsNotification(email, CCEmails, BCCEmails, templateParams, messageVariables) {
        if (!(await this._refreshEmailConstants())) {
            return;
        }
        const message = sanitizeNotificationBody(this.email_constants.FINAL_INACTIVE_APPLICATION_CONTENT, messageVariables);
        const secondMessage = sanitizeNotificationBody(this.email_constants.FINAL_INACTIVE_APPLICATION_SECOND_CONTENT, messageVariables);
        const thirdMessage = sanitizeNotificationBody(this.email_constants.FINAL_INACTIVE_APPLICATION_THIRD_CONTENT, messageVariables);
        const subject = this.email_constants.FINAL_INACTIVE_APPLICATION_SUBJECT;
        return await this.send(async () => {
            await this.emailService.sendNotification(
                this.email_constants.NOTIFICATION_SENDER,
                isTierAdded(this.tier) ? `${this.tier} ${subject}` : subject,
                await createEmailTemplate("notification-template.html", {
                    message, secondMessage, thirdMessage, ...templateParams
                }),
                email,
                CCEmails,
                BCCEmails
            );
        });
    }

    /**
     * Sends the released data-submission notification.
     * @param {string|string[]} emails
     * @param {string[]} BCCsEmails
     * @param {object} template_params
     * @param {object} subjectVariables
     * @param {object} messageVariables
     * @returns {Promise<*>}
     */
    async releaseDataSubmissionNotification(emails, BCCsEmails,template_params, subjectVariables, messageVariables) {
        if (!(await this._refreshEmailConstants())) {
            return;
        }
        const message = sanitizeNotificationBody(this.email_constants.RELEASE_DATA_SUBMISSION_CONTENT, messageVariables);
        const subject = replaceMessageVariables(this.email_constants.RELEASE_DATA_SUBMISSION_SUBJECT, subjectVariables)
        return await this.send(async () => {
            await this.emailService.sendNotification(
                this.email_constants.NOTIFICATION_SENDER,
                isTierAdded(this.tier) ? `${this.tier} ${subject}` : subject,
                await createEmailTemplate("notification-template.html", {
                    message, ...template_params
                }),
                emails,
                [],
                BCCsEmails
            );
        });
    }

    /**
     * Sends the submitted data-submission notification.
     * @param {string|string[]} email
     * @param {string[]} BCCEmails
     * @param {object} templateParams
     * @param {object} messageVariables
     * @returns {Promise<*>}
     */
    async submitDataSubmissionNotification(email, BCCEmails,templateParams, messageVariables) {
        if (!(await this._refreshEmailConstants())) {
            return;
        }
        const message = sanitizeNotificationBody(this.email_constants.SUBMIT_DATA_SUBMISSION_CONTENT_FIRST, messageVariables);
        const secondMessage = sanitizeNotificationBody(this.email_constants.SUBMIT_DATA_SUBMISSION_CONTENT_SECOND, messageVariables);
        const subject = this.email_constants.SUBMIT_DATA_SUBMISSION_SUBJECT;
        return await this.send(async () => {
            await this.emailService.sendNotification(
                this.email_constants.NOTIFICATION_SENDER,
                isTierAdded(this.tier) ? `${this.tier} ${subject}` : subject,
                await createEmailTemplate("notification-template.html", {
                    message, secondMessage, ...templateParams
                }),
                email,
                [],
                BCCEmails
            );
        });
    }

    /**
     * Sends the completed data-submission notification.
     * @param {string|string[]} email
     * @param {string[]} BCCEmails
     * @param {object} template_params
     * @param {object} messageVariables
     * @returns {Promise<*>}
     */
    async completeSubmissionNotification(email, BCCEmails, template_params, messageVariables) {
        if (!(await this._refreshEmailConstants())) {
            return;
        }
        const message = sanitizeNotificationBody(this.email_constants.COMPLETE_DATA_SUBMISSION_CONTENT, messageVariables);
        const subject = this.email_constants.COMPLETE_DATA_SUBMISSION_SUBJECT;
        return await this.send(async () => {
            await this.emailService.sendNotification(
                this.email_constants.NOTIFICATION_SENDER,
                isTierAdded(this.tier) ? `${this.tier} ${subject}` : subject,
                await createEmailTemplate("notification-template.html", {
                    message, ...template_params
                }),
                email,
                [],
                BCCEmails
            );
        });
    }

    /**
     * Sends the canceled data-submission notification.
     * @param {string|string[]} email
     * @param {string[]} BCCEmails
     * @param {object} template_params
     * @param {object} messageVariables
     * @returns {Promise<*>}
     */
    async cancelSubmissionNotification(email, BCCEmails, template_params, messageVariables) {
        if (!(await this._refreshEmailConstants())) {
            return;
        }
        const message = sanitizeNotificationBody(this.email_constants.CANCEL_DATA_SUBMISSION_CONTENT, messageVariables);
        const subject = this.email_constants.CANCEL_DATA_SUBMISSION_SUBJECT;
        return await this.send(async () => {
            await this.emailService.sendNotification(
                this.email_constants.NOTIFICATION_SENDER,
                isTierAdded(this.tier) ? `${this.tier} ${subject}` : subject,
                await createEmailTemplate("notification-template.html", {
                    message, ...template_params
                }),
                email,
                [],
                BCCEmails
            );
        });
    }

    /**
     * Sends the withdrawn data-submission notification.
     * @param {string|string[]} email
     * @param {string[]} BCCEmails
     * @param {object} template_params
     * @param {object} messageVariables
     * @returns {Promise<*>}
     */
    async withdrawSubmissionNotification(email, BCCEmails, template_params, messageVariables) {
        if (!(await this._refreshEmailConstants())) {
            return;
        }
        const message = sanitizeNotificationBody(this.email_constants.WITHDRAW_DATA_SUBMISSION_CONTENT, messageVariables);
        const subject = this.email_constants.WITHDRAW_DATA_SUBMISSION_SUBJECT;
        return await this.send(async () => {
            await this.emailService.sendNotification(
                this.email_constants.NOTIFICATION_SENDER,
                isTierAdded(this.tier) ? `${this.tier} ${subject}` : subject,
                await createEmailTemplate("notification-template.html", {
                    message, ...template_params
                }),
                email,
                [],
                BCCEmails
            );
        });
    }

    /**
     * Sends the rejected data-submission notification.
     * @param {string|string[]} email
     * @param {string[]} BCCEmails
     * @param {object} template_params
     * @param {object} messageVariables
     * @returns {Promise<*>}
     */
    async rejectSubmissionNotification(email, BCCEmails, template_params, messageVariables) {
        if (!(await this._refreshEmailConstants())) {
            return;
        }
        const message = sanitizeNotificationBody(this.email_constants.REJECT_DATA_SUBMISSION_CONTENT, messageVariables);
        const subject = this.email_constants.REJECT_DATA_SUBMISSION_SUBJECT;
        return await this.send(async () => {
            await this.emailService.sendNotification(
                this.email_constants.NOTIFICATION_SENDER,
                isTierAdded(this.tier) ? `${this.tier} ${subject}` : subject,
                await createEmailTemplate("notification-template.html", {
                    message, ...template_params
                }),
                email,
                [],
                BCCEmails
            );
        });
    }

    /**
     * Sends the deactivated-user notification.
     * @param {string|string[]} email
     * @param {object} template_params
     * @param {object} messageVariables
     * @returns {Promise<*>}
     */
    async deactivateUserNotification(email, template_params, messageVariables) {
        if (!(await this._refreshEmailConstants())) {
            return;
        }
        const message = sanitizeNotificationBody(this.email_constants.DEACTIVATE_USER_CONTENT, messageVariables);
        const subject = this.email_constants.DEACTIVATE_USER_SUBJECT;
        return await this.send(async () => {
            await this.emailService.sendNotification(
                this.email_constants.NOTIFICATION_SENDER,
                isTierAdded(this.tier) ? `${this.tier} ${subject}` : subject,
                await createEmailTemplate("notification-template.html", {
                    message, ...template_params
                }),
                email
            );
        });
    }

    /**
     * Sends the inactive data-submission reminder.
     * @param {string|string[]} email
     * @param {string[]} BCCEmails
     * @param {object} template_params
     * @param {object} messageVariables
     * @returns {Promise<*>}
     */
    async inactiveSubmissionNotification(email, BCCEmails, template_params, messageVariables) {
        if (!(await this._refreshEmailConstants())) {
            return;
        }
        const subject = replaceMessageVariables(this.email_constants.INACTIVE_SUBMISSION_SUBJECT, messageVariables);
        const message = sanitizeNotificationBody(this.email_constants.INACTIVE_SUBMISSION_CONTENT, messageVariables);
        return await this.send(async () => {
            await this.emailService.sendNotification(
                this.email_constants.NOTIFICATION_SENDER,
                isTierAdded(this.tier) ? `${this.tier} ${subject}` : subject,
                await createEmailTemplate("notification-template.html", {
                    message, ...template_params
                }),
                email,
                [],
                BCCEmails
            );
        });
    }

    /**
     * Sends the user access-request notification.
     * @param {string|string[]} email
     * @param {object} templateParams
     * @returns {Promise<*>}
     */
    async requestUserAccessNotification(email, templateParams) {
        if (!(await this._refreshEmailConstants())) {
            return;
        }
        const sanitizedAdditionalInfo = sanitizeHtml(templateParams.additionalInfo, {allowedTags: [],allowedAttributes: {}});
        const topMessage = sanitizeNotificationBody(this.email_constants.USER_REQUEST_ACCESS_CONTENT, {});
        const subject = this.email_constants.USER_REQUEST_ACCESS_SUBJECT;
        const additionalInfo = [
            [USER_NAME, templateParams.userName],
            [ACCOUNT_TYPE, templateParams.accountType?.toUpperCase()],
            [ACCOUNT_EMAIL, templateParams.email],
            ...(templateParams.role) ? [[REQUESTED_ROLE, templateParams.role]] : [],
            ...(templateParams.institutionName) ? [[AFFILIATED_INSTITUTION, templateParams.institutionName]] : [],
            ...(templateParams.studies) ? [[STUDIES, templateParams.studies]] : [],
            ...(sanitizedAdditionalInfo) ? [[ADDITIONAL_INFO, sanitizedAdditionalInfo]] : [],
        ];
        return await this.send(async () => {
            return await this.emailService.sendNotification(
                this.email_constants.NOTIFICATION_SENDER,
                isTierAdded(this.tier) ? `${this.tier} ${subject}` : subject,
                await createEmailTemplate(NOTIFICATION_USER_HTML_TEMPLATE, {
                    topMessage, ...{
                        firstName: this.email_constants.USER_REQUEST_ACCESS_RECIPIENT_NAME,
                        senderName: CRDC_SUBMISSION_PORTAL,
                        ...templateParams, additionalInfo}
                }),
                email,
                []
            );
        });
    }

    /**
     * Sends the permissive-value request notification.
     * @param {string|string[]} email
     * @param {string[]} CCEmails
     * @param {string} dataCommonsName
     * @param {object} templateParams
     * @returns {Promise<*>}
     */
    async requestPVNotification(email, CCEmails, dataCommonsName, templateParams) {
        if (!(await this._refreshEmailConstants())) {
            return;
        }
        const topMessage = sanitizeNotificationBody(this.email_constants.PV_REQUEST_SUBJECT_CONTENT, {});
        const bottomMessage = sanitizeNotificationBody(this.email_constants.PV_REQUEST_SUBJECT_SECOND_CONTENT, {});
        const subject = this.email_constants.PV_REQUEST_SUBJECT;
        const pendingPV = [
            [SUBMITTER_NAME, templateParams?.submitterName],
            [SUBMITTER_EMAIL, templateParams?.submitterEmail],
            [STUDY_NAME, templateParams?.studyName],
            [STUDY_ABBREVIATION, defaultStudyAbbreviationToNA(templateParams?.studyAbbreviation)],
            [DATA_SUBMISSION_ID, templateParams?.submissionID],
            [NODE, templateParams?.nodeName],
            [PROPERTY, templateParams?.property],
            [CDE_ID, templateParams?.CDEId],
            [REQUESTED_PERMISSIVE_VALUE, templateParams.value],
            ...(templateParams.comment) ? [[JUSTIFICATION, templateParams.comment]] : []
        ];
        return await this.send(async () => {
            return await this.emailService.sendNotification(
                this.email_constants.NOTIFICATION_SENDER,
                isTierAdded(this.tier) ? `${this.tier} ${subject}` : subject,
                await createEmailTemplate(NOTIFICATION_USER_HTML_TEMPLATE, {
                    topMessage,
                    bottomMessage,
                    ...{
                        firstName: dataCommonsName + " Team",
                        senderName: CRDC_SUBMISSION_PORTAL,
                        ...templateParams, pendingPV},
                }),
                email,
                CCEmails
            );
        });
    }

    /**
     * Sends the edited data-submission notification.
     * @param {string|string[]} email
     * @param {string[]} CCEmails
     * @param {string[]} BCCEmails
     * @param {object} templateParams
     * @returns {Promise<*>}
     */
    async updateSubmissionNotification(email, CCEmails, BCCEmails, templateParams) {
        if (!(await this._refreshEmailConstants())) {
            return;
        }
        const subject = replaceMessageVariables(this.email_constants.UPDATE_SUBMISSION_SUBJECT, {});
        return await this.send(async () => {
            return await this.emailService.sendNotification(
                this.email_constants.NOTIFICATION_SENDER,
                isTierAdded(this.tier) ? `${this.tier} ${subject}` : subject,
                await createEmailTemplate("notification-template-edit-submission.html", {
                    ...{...templateParams}
                }),
                email,
                CCEmails,
                BCCEmails
            );
        });
    }

    /**
     * Sends the final inactive data-submission notification.
     * @param {string|string[]} email
     * @param {string[]} BCCEmails
     * @param {object} template_params
     * @param {object} messageVariables
     * @returns {Promise<*>}
     */
    async finalInactiveSubmissionNotification(email, BCCEmails, template_params, messageVariables) {
        if (!(await this._refreshEmailConstants())) {
            return;
        }
        const subject = replaceMessageVariables(this.email_constants.FINAL_INACTIVE_SUBMISSION_SUBJECT, messageVariables);
        const message = sanitizeNotificationBody(this.email_constants.FINAL_INACTIVE_SUBMISSION_CONTENT, messageVariables);
        const additionalMsg = this.email_constants.FINAL_INACTIVE_SUBMISSION_ADDITIONAL_CONTENT
            .map((item) => sanitizeAllowlistedHtml(item, PRESET_NOTIFICATION_TEXT_HTML));
        return await this.send(async () => {
            await this.emailService.sendNotification(
                this.email_constants.NOTIFICATION_SENDER,
                isTierAdded(this.tier) ? `${this.tier} ${subject}` : subject,
                await createEmailTemplate("notification-template.html", {
                    message, ...{...template_params, additionalMsg: additionalMsg}
                }),
                email,
                [],
                BCCEmails
            );
        });
    }

    /**
     * Sends the pending-model-state cleared notification.
     * @param {string|string[]} email
     * @param {string[]} CCEmails
     * @param {string[]} BCCEmails
     * @param {object} template_params
     * @returns {Promise<*>}
     */
    async clearPendingModelState(email, CCEmails, BCCEmails, template_params) {
        if (!(await this._refreshEmailConstants())) {
            return;
        }
        const subject = replaceMessageVariables(this.email_constants.CLEAR_PENDING_STATE_SUBJECT, {});
        return await this.send(async () => {
            return await this.emailService.sendNotification(
                this.email_constants.NOTIFICATION_SENDER,
                isTierAdded(this.tier) ? `${this.tier} ${subject}` : subject,
                await createEmailTemplate("notification-template-pending-clear.html", {
                    ...{...template_params, senderName: CRDC_SUBMISSION_PORTAL}
                }),
                email,
                CCEmails,
                BCCEmails
            );
        });
    }
}

const isTierAdded = (tier) => {
    return tier?.trim()?.length > 0
};

module.exports = {
    NotifyUser,
    sanitizeNotificationBody,
    sanitizePendingConditionHtml
}