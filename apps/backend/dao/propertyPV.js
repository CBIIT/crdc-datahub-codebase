const MongooseGenericDAO = require("./mongoose-generic");
const PropertyPVModel = require("../mongoose/models/property-pv");

/**
 * Mongoose-backed DAO for property permissible values (propertyPVs).
 */
class PropertyPVDAO extends MongooseGenericDAO {
    constructor() {
        super(PropertyPVModel);
    }

    /**
     * Finds property PV documents matching any of the given property names for a model/version.
     * Maps BSON PermissibleValues to GraphQL-facing permissibleValues (null when missing/null).
     *
     * @param {string[]} propertyNames non-empty deduped list
     * @param {string} version
     * @param {string} model
     * @returns {Promise<Object[]>}
     */
    async findByPropertiesVersionAndModel(propertyNames, version, model) {
        if (!propertyNames.length) {
            return [];
        }
        const docs = await this.findMany({
            property: { $in: propertyNames },
            version,
            model,
        });
        return docs.map((doc) => ({
            ...doc,
            permissibleValues: doc.PermissibleValues ?? null,
        }));
    }
}

module.exports = PropertyPVDAO;
