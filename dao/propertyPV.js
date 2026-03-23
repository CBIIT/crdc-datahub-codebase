const GenericDAO = require("./generic");
const { MODEL_NAME } = require("../constants/db-constants");

class PropertyPVDAO extends GenericDAO {
    constructor() {
        super(MODEL_NAME.PROPERTY_PVS);
    }

    /**
     * @param {string} propertyName
     * @param {string} version
     * @param {string} model
     * @returns {Promise<Object|null>}
     */
    async findByPropertyVersionAndModel(propertyName, version, model) {
        return await this.findFirst({
            property: propertyName,
            version,
            model,
        });
    }
}

module.exports = PropertyPVDAO;
