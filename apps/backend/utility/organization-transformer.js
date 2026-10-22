/**
 * Utility functions for transforming organization data for GraphQL responses.
 */

/**
 * Formats a nested organization object to GraphQL format (with '_id' field).
 * Accepts either `id` or Mongoose-style `_id`.
 *
 * @param {Object} org - Organization object with `id` and/or `_id`
 * @returns {Object|null} - Organization object with '_id' field, or null if input is null/undefined
 */
function formatNestedOrganization(org) {
    if (!org) {
        return null;
    }
    
    return {
        _id: org._id || org.id,
        name: org.name,
        abbreviation: org.abbreviation
    };
}

/**
 * Formats an array of nested organization objects to GraphQL format.
 *
 * @param {Array} organizations - Array of organization objects
 * @returns {Array} - Array of organization objects with '_id' field
 */
function formatNestedOrganizations(organizations) {
    if (!Array.isArray(organizations)) {
        return [];
    }
    
    return organizations.map(org => formatNestedOrganization(org));
}

module.exports = {
    formatNestedOrganization,
    formatNestedOrganizations
};
