const MongooseGenericDAO = require("./mongoose-generic");
const ReleaseModel = require("../mongoose/models/release");

/**
 * Data access for the release collection via Mongoose.
 */
class ReleaseDAO extends MongooseGenericDAO {
    constructor() {
        super(ReleaseModel);
    }
}

module.exports = ReleaseDAO;
