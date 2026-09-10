const MongooseGenericDAO = require("./mongoose-generic");
const ValidationModel = require("../mongoose/models/validation");

/**
 * Mongoose-backed DAO for validation records.
 */
class ValidationDAO extends MongooseGenericDAO {
    constructor() {
        super(ValidationModel);
    }
}

module.exports = ValidationDAO;
