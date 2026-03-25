const GenericDAO = require("./generic");
const { MODEL_NAME } = require("../constants/db-constants");

class PropertyPVDAO extends GenericDAO {
    constructor() {
        super(MODEL_NAME.PROPERTY_PVS);
    }

    /**
     * @param {string[]} propertyNames non-empty deduped list
     * @param {string} version
     * @param {string} model
     * @returns {Promise<Object[]>}
     */
    async findByPropertiesVersionAndModel(propertyNames, version, model) {
        if (!propertyNames.length) {
            return [];
        }
        return await this.findMany({
            property: { $in: propertyNames },
            version,
            model,
        });
    }
}

module.exports = PropertyPVDAO;
