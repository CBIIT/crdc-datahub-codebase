const MongooseGenericDAO = require("./mongoose-generic");
const ConfigurationModel = require("../mongoose/models/configuration");

/**
 * Mongoose-backed DAO for configuration documents (type-discriminated).
 */
class ConfigurationDAO extends MongooseGenericDAO {
    constructor() {
        super(ConfigurationModel);
    }

    /**
     * Find the first configuration document with the given type.
     * @param {string} type Configuration type discriminator
     * @returns {Promise<object|null>}
     */
    async findByType(type) {
        return this.findFirst({ type });
    }

    /**
     * Find all configuration documents with the given type.
     * @param {string} type Configuration type discriminator
     * @returns {Promise<object[]>}
     */
    async findManyByType(type) {
        return this.findMany({ type });
    }
}

module.exports = ConfigurationDAO;
