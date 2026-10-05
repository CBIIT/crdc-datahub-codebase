const handlebars = require('handlebars');
const { marked } = require('marked');
const { sanitizeAllowlistedHtml, PRESET_SR_REVIEW_COMMENT_HTML } = require('../utility/sanitize-allowlisted-html');
const {
    getEmailContentCache,
    getUninitializedCacheLogMessage,
    EMAIL_CONTENT_LOG_PREFIX,
} = require('./email-content-cache');

const BLANK_LINE_RUN_PATTERN = /\n{3,}/g;

// isArray is a helper function in this html template,
handlebars.registerHelper('isArray', function (value) {
    return Array.isArray(value);
});

// AND helper
handlebars.registerHelper('and', function () {
    return Array.from(arguments).slice(0, -1).every(Boolean);
});

// OR helper
handlebars.registerHelper('or', function () {
    return Array.from(arguments).slice(0, -1).some(Boolean);
});

// nlToBr helper: converts newlines to <br> for compatibility
handlebars.registerHelper('nlToBr', function (text) {
    if (!text) {
        return '';
    }
    const escaped = handlebars.Utils.escapeExpression(text);
    return new handlebars.SafeString(escaped.replace(/\n/g, '<br>'));
});

// markdownToHtml helper: parses markdown and sanitizes output for email injection
handlebars.registerHelper('markdownToHtml', function (text) {
    if (!text) {
        return '';
    }
    const rawHtml = renderMarkdown(text);
    return new handlebars.SafeString(sanitizeAllowlistedHtml(rawHtml, PRESET_SR_REVIEW_COMMENT_HTML));
});

/**
 * Thrown when GitHub-backed email HTML cannot be loaded. NotifyUser skips the send.
 */
class EmailContentUnavailableError extends Error {
    /**
     * @param {string} message
     */
    constructor(message) {
        super(message);
        this.name = 'EmailContentUnavailableError';
    }
}

/**
 * Compiles a Handlebars email layout from the GitHub-backed cache.
 *
 * Content-repo layouts (CBIIT/crdc-submission-portal-email-content) must inject YAML body
 * HTML as a block, not inside `<p>` and not with escaped `{{ }}`, or lists will not render:
 * - notification-template.html: `<div>{{{ message }}}</div>`, same for secondMessage/thirdMessage
 * - notification-template-sr-reopen.html and notification-template-sr-inquire.html: same
 * - notification-template-user.html: `<div>{{{ topMessage }}}</div>` and bottomMessage
 * - notification-template-SR-pending-conditions.html: topMessage in a `<div>`, not `<p>`
 * @param {string} templateName Allowlisted HTML file name
 * @param {object} params Handlebars template parameters
 * @param {object} [emailContentCache] Cache override for tests
 * @returns {Promise<string>}
 * @throws {EmailContentUnavailableError} When the cache is uninitialized, the template cannot be loaded, or Handlebars compile fails
 */
async function createEmailTemplate(templateName, params, emailContentCache) {
    const cache = emailContentCache || getEmailContentCache();
    if (!cache) {
        throw new EmailContentUnavailableError(getUninitializedCacheLogMessage(0));
    }
    const templateSource = await cache.getTemplate(templateName);
    if (!templateSource) {
        const message = typeof cache.getUninitializedCacheLogMessage === 'function'
            ? cache.getUninitializedCacheLogMessage()
            : getUninitializedCacheLogMessage(0);
        throw new EmailContentUnavailableError(message);
    }
    try {
        return handlebars.compile(templateSource)(params);
    } catch (e) {
        throw new EmailContentUnavailableError(
            `${EMAIL_CONTENT_LOG_PREFIX} Handlebars compile failed for ${templateName}: ${e.message}`
        );
    }
}

/**
 * A helper function to render markdown text to HTML.
 *
 * @param {string} text 
 * @returns {string} Markdown content converted to a HTML string
 */
function renderMarkdown(text) {
    const source = String(text).replace(/\r\n?/g, '\n');
    const formattedSource = source.replace(BLANK_LINE_RUN_PATTERN, (lineBreaks) => {
        const blankParagraphCount = Math.ceil((lineBreaks.length - 2) / 2);
        const blankParagraphs = Array.from({ length: blankParagraphCount }, () => '<br />').join('\n\n');

        return `\n\n${blankParagraphs}\n\n`;
    });

    return marked.parse(formattedSource, { async: false, breaks: true });
}


module.exports = { createEmailTemplate, EmailContentUnavailableError }
