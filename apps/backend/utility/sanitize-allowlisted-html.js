const sanitizeHtml = require('sanitize-html');

/**
 * Sanitize an HTML fragment using explicit sanitize-html options (tag/attribute/scheme allowlists).
 * Use shared presets (e.g. {@link PRESET_SR_APPROVAL_PENDING_HTML}) or pass a custom options object.
 *
 * @param {unknown} input - raw HTML string
 * @param {import('sanitize-html').IOptions} options - sanitize-html configuration (required)
 * @returns {string} empty string when input is null, undefined, or not a string
 */
function sanitizeAllowlistedHtml(input, options) {
    if (input == null || typeof input !== 'string') {
        return '';
    }
    if (options == null || typeof options !== 'object') {
        throw new TypeError('sanitizeAllowlistedHtml requires an options object');
    }
    return sanitizeHtml(input, options);
}

const EMAIL_BODY_HTML_BASE = {
    allowedTags: ['a', 'br', 'p', 'span', 'strong', 'b', 'em', 'i', 'ul', 'ol', 'li'],
    allowedAttributes: {
        a: ['href', 'rel']
    },
    allowedSchemes: ['http', 'https', 'mailto'],
    allowedSchemesByTag: {
        a: ['http', 'https', 'mailto']
    },
    allowProtocolRelative: false,
    transformTags: {
        a: (tagName, attribs) => {
            const nextAttribs = {
                rel: 'noopener noreferrer'
            };
            const href = attribs.href;
            if (href != null && String(href).trim() !== '') {
                nextAttribs.href = href;
            }
            return { tagName, attribs: nextAttribs };
        }
    }
};

/**
 * Preset: SR pending-condition snippets (Handlebars triple-stash / DB+YAML copy).
 * Links and basic block/inline formatting only.
 */
const PRESET_SR_APPROVAL_PENDING_HTML = EMAIL_BODY_HTML_BASE;

/**
 * Preset: Notification email body text from YAML.
 * Paragraphs, lists, links, underline, and basic inline formatting.
 */
const PRESET_NOTIFICATION_TEXT_HTML = {
    ...EMAIL_BODY_HTML_BASE,
    allowedTags: [...EMAIL_BODY_HTML_BASE.allowedTags, 'u']
};

/** Preset: markdown-rendered SRF review comment HTML injected into decision emails. */
const PRESET_SR_REVIEW_COMMENT_HTML = EMAIL_BODY_HTML_BASE;

module.exports = {
    sanitizeAllowlistedHtml,
    PRESET_SR_APPROVAL_PENDING_HTML,
    PRESET_NOTIFICATION_TEXT_HTML,
    PRESET_SR_REVIEW_COMMENT_HTML
};
