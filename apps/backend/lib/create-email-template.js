const fsp = require('fs/promises');
const path = require('path');
const handlebars = require('handlebars');
const { marked } = require('marked');
const { sanitizeAllowlistedHtml, PRESET_SR_REVIEW_COMMENT_HTML } = require('../utility/sanitize-allowlisted-html');

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


async function createEmailTemplate(templateName, params, basePath = 'resources/email-templates') {
    const templatePath = path.resolve(basePath, templateName);
    const templateSource = await fsp.readFile(templatePath, "utf-8");
    return handlebars.compile(templateSource)(params);
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


module.exports = { createEmailTemplate }
