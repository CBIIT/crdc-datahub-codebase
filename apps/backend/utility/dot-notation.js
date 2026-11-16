/** Separator that stands in for "." in DocumentDB aggregation field names. */
const DOT_SAFE_SEPARATOR = "_DOT_";

/**
 * Restores "." in object keys that use the DOT-safe separator.
 * Only the exact substring "_DOT_" is replaced. Other spellings are left unchanged.
 * Non-plain values (primitives, null, arrays, Date, and other built-ins) are returned unchanged.
 * @param {*} record Result row whose keys may contain DOT_SAFE_SEPARATOR
 * @returns {*}
 */
function format_dot_notation(record) {
    if (Object.prototype.toString.call(record) !== "[object Object]") {
        return record;
    }
    return Object.fromEntries(
        Object.entries(record).map(([key, value]) => [key.split(DOT_SAFE_SEPARATOR).join("."), value])
    );
}

module.exports = {
    DOT_SAFE_SEPARATOR,
    format_dot_notation,
};
