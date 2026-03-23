const { verifySession } = require("../verifier/user-info-verifier");
const { replaceErrorString } = require("../utility/string-util");
const ERROR = require("../constants/error-constants");

const DATA_COMMONS_LIST_TYPE = "DATA_COMMONS_LIST";

class PropertyPVService {
    constructor(configurationService, propertyPVDAO) {
        this.configurationService = configurationService;
        this.propertyPVDAO = propertyPVDAO;
    }

    async retrievePVsByPropertyName(params, context) {
        verifySession(context).verifyInitialized();
        const { propertyName, model, version } = params;
        if (typeof propertyName !== "string" || !propertyName.trim()) {
            throw new Error(ERROR.RETRIEVE_PVS_INVALID_PROPERTY_NAME);
        }
        if (typeof version !== "string" || !version.trim()) {
            throw new Error(ERROR.RETRIEVE_PVS_INVALID_VERSION);
        }
        if (typeof model !== "string" || !model.trim()) {
            throw new Error(ERROR.RETRIEVE_PVS_INVALID_MODEL);
        }
        const propertyNameTrimmed = propertyName.trim();
        const versionTrimmed = version.trim();
        const modelTrimmed = model.trim();
        const listDoc = await this.configurationService.findByType(DATA_COMMONS_LIST_TYPE);
        const allowed = listDoc?.key || [];
        if (!allowed.includes(modelTrimmed)) {
            const acceptedList = allowed.length ? [...allowed].sort().join(", ") : "(none configured)";
            throw new Error(
                replaceErrorString(
                    replaceErrorString(ERROR.INVALID_DATA_MODEL_NOT_ALLOWED, `'${modelTrimmed}'`),
                    acceptedList,
                    /\$accepted\$/g
                )
            );
        }
        return await this.propertyPVDAO.findByPropertyVersionAndModel(
            propertyNameTrimmed,
            versionTrimmed,
            modelTrimmed
        );
    }
}

module.exports = { PropertyPVService };
