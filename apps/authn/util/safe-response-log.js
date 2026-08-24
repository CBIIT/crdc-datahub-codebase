const VALUE_ALLOWLIST_FIELDS = ["email", "preferred_username", "first_name", "last_name"];

/**
 * True when value is a non-empty string after trimming.
 * @param {*} value
 * @returns {boolean}
 */
const isNonEmptyString = (value) => typeof value === "string" && value.trim().length > 0;

/**
 * True when a field should be reported as present with a non-empty value (value itself is never logged).
 * @param {*} value
 * @returns {boolean}
 */
const _isNonEmptyValue = (value) => {
    if (value == null) {
        return false;
    }
    if (typeof value === "string") {
        return isNonEmptyString(value);
    }
    return true;
};

/**
 * True when a present non-allowlisted field is null or a blank/whitespace string.
 * @param {*} value
 * @returns {boolean}
 */
const _isPresentButEmpty = (value) => {
    if (value == null) {
        return true;
    }
    if (typeof value === "string") {
        return !isNonEmptyString(value);
    }
    return false;
};

/**
 * Replaces CR/LF so field names and allowlisted values cannot inject extra log lines.
 * @param {string} value
 * @returns {string}
 */
const _escapeNewlines = (value) => value.replace(/\r/g, "\\r").replace(/\n/g, "\\n");

/**
 * Describes allowlisted string fields (with values) and other keys by emptiness (names only).
 * @param {*} body Parsed JSON body
 * @param {boolean} reportMissingAllowlist When true, emit "field is missing" for absent allowlist keys
 * @returns {string} Description, or "response body is an empty object" when an object has no parts to report
 */
const describeSafeResponseFields = (body, reportMissingAllowlist) => {
    if (body === null) {
        return "response body is null";
    }
    if (Array.isArray(body)) {
        return `response body is an array of length ${body.length}`;
    }
    if (typeof body !== "object") {
        return `response body is ${typeof body}`;
    }
    const parts = [];
    for (const field of VALUE_ALLOWLIST_FIELDS) {
        if (!Object.prototype.hasOwnProperty.call(body, field)) {
            if (reportMissingAllowlist) {
                parts.push(`${field} is missing`);
            }
            continue;
        }
        const value = body[field];
        if (isNonEmptyString(value)) {
            parts.push(`${field}=${_escapeNewlines(value)}`);
        } else if (typeof value === "string") {
            parts.push(`${field} is empty`);
        } else {
            parts.push(`${field} is not a string`);
        }
    }
    const otherKeys = Object.keys(body).filter((key) => !VALUE_ALLOWLIST_FIELDS.includes(key));
    const nonEmptyOther = otherKeys.filter((key) => _isNonEmptyValue(body[key]));
    const emptyOther = otherKeys.filter((key) => _isPresentButEmpty(body[key]));
    if (nonEmptyOther.length > 0) {
        parts.push(`fields with non-empty values: ${nonEmptyOther.map(_escapeNewlines).join(", ")}`);
    }
    if (emptyOther.length > 0) {
        parts.push(`fields present but empty: ${emptyOther.map(_escapeNewlines).join(", ")}`);
    }
    if (parts.length === 0) {
        return "response body is an empty object";
    }
    return parts.join("; ");
};

module.exports = {
    isNonEmptyString,
    describeSafeResponseFields
};
