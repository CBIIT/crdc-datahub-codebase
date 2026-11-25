const {verifySession} = require("../verifier/user-info-verifier");
const ConfigurationDAO = require("../dao/configuration");
const PBAC_CONFIG_TYPE = "PBAC";
const CLI_UPLOADER_VERSION = "CLI_UPLOADER_VERSION";
const APPLICATION_FORM_VERSIONS = "APPLICATION_FORM_VERSIONS";
const MAINTENANCE_MODE = "MAINTENANCE_MODE";
const CHATBOT = "CHATBOT";
const MODEL_CONTENT = "MODEL_CONTENT";
const TIER = "TIER";
const DEFAULT_MODEL_CONTENT_TTL_MINUTES = 60 * 24;
const getOMBConfiguration = require("../dao/omb");
const ERROR = require("../constants/error-constants");
const {sanitizeTierName} = require("../utility/string-util");
class ConfigurationService {
    constructor() {
        this.configurationDAO = new ConfigurationDAO();
    }
    async findByType(type) {
        return await this.configurationDAO.findByType(type) || null;
    }

    async isMaintenanceMode() {
        const result = await this.configurationDAO.findByType(MAINTENANCE_MODE);
        return (result) ? (result?.keys?.flag || false) : false;
    }

    async isChatBotEnabled() {
        const result = await this.configurationDAO.findByType(CHATBOT);
        return result?.keys?.enabled === true;
    }

    async findManyByType(type) {
         return await this.configurationDAO.findManyByType(type) || [];
    }

    /**
     * API: getPBTCDDefaults retrieve roles default permissions and notifications.
     * @param {*} params 
     * @param {*} context 
     */
    async getPBACDefaults(params, context){
        verifySession(context)
            .verifyInitialized();

        const userInfo = context.userInfo;
        console.log(`getPBACDefaults called by user: ${userInfo._id}`);

        return await this.getPBACByRoles(params.roles);
    }
    /**
     * Get PBAC defaults by roles
     * @param {Array} roles
     * @returns {Object} PBAC defaults
     */
    async getPBACByRoles(roles){
       let result = await this.configurationDAO.findByType(PBAC_CONFIG_TYPE);
        if (!result || !result?.Defaults || result?.Defaults.length === 0){
            return null;
        }
        let pbacArray = result.Defaults.map(role => {
            const permissions = (role.permissions || []).map(permission => {
                const id = permission.id ?? permission._id;
                return { ...permission, id, _id: id };
            });
            const notifications = (role.notifications || []).map(n => {
                const id = n.id ?? n._id;
                return { ...n, id, _id: id };
            });
            return {...role, permissions: permissions, notifications: notifications}
        });
        result = {Defaults:pbacArray};
        return (roles.includes("All"))? result.Defaults : result.Defaults.filter((item)=> roles.includes(item.role));
    }

    /**
     * Get User Permission Access by a role
     * UserAccessControl class to filter permissions.
     * @param {String} role - a user role.
     * @returns {Promise<{ permissions: {disabled: Array, permitted: Array}, notifications: {disabled: Array, permitted: Array} }> | null}
     */
    async getAccessControl(role) {
        const usersPermissions = await this.getPBACByRoles([role]);
        if (usersPermissions?.length === 0) {
            return null;
        }
        // Only one user
        return {
            permissions: UserAccessControl.get(usersPermissions[0]?.permissions),
            notifications: UserAccessControl.get(usersPermissions[0]?.notifications)
        };
    }

    /**
     * API: getOMB retrieve OMB message
     */
    async getOMB() {
        // get OMB info from database
        const ombConfig = await getOMBConfiguration();
        if (!ombConfig) {
            throw new Error(ERROR.OMB_NOT_FOUND);
        }
        return ombConfig;
    }

    /**
     * API: retrieveApplicationFormVersion
     * @param {*} params 
     * @param {*} context 
     * @returns 
     */
    async getApplicationFormVersion(params, context) {
        const applicationFormVersion = await this.configurationDAO.findByType(APPLICATION_FORM_VERSIONS);
        if (!applicationFormVersion) {
            throw new Error(ERROR.APPLICATION_FORM_VERSIONS_NOT_FOUND);
        }
        return {...applicationFormVersion, _id: applicationFormVersion.id}
    }

    /**
     * public API: retrieveCLIUploaderVersion
     * @param {*} params 
     * @param {*} context 
     * @returns 
     */
    async retrieveCLIUploaderVersion(params, context) {
        return await this.getCurrentCLIUploaderVersion();
    }

    async getCurrentCLIUploaderVersion() {
        const result = await this.configurationDAO.findByType(CLI_UPLOADER_VERSION);
        return (result) ? result?.current_version : null;
    }

    /**
     * Returns the model content.json cache TTL in minutes from MODEL_CONTENT.
     * A missing, invalid, or unreadable value falls back to lastTTLMinutes when that
     * value exists, and to 1440 (24 hours) only when there is no last TTL yet.
     * @param {number} [lastTTLMinutes] TTL from the last successful read
     * @returns {Promise<number>}
     */
    async getModelContentTTLMinutes(lastTTLMinutes) {
        try {
            const result = await this.configurationDAO.findByType(MODEL_CONTENT);
            return await this._validateTTLMinutes(result?.keys?.ttl_minutes, lastTTLMinutes);
        } catch (error) {
            console.error('Unable to read MODEL_CONTENT ttl_minutes:', error);
            return await this._validateTTLMinutes(lastTTLMinutes);
        }
    }

    /**
     * Builds the model content.json URL from the tier, model content repo, and content path.
     * The tier is sanitized to a branch name (non-alphanumerics removed, lowercased).
     * Logs and returns null when any required configuration value is missing.
     * @returns {Promise<string|null>}
     */
    async getModelContentURL() {
        const tier = sanitizeTierName(await this._getTier());
        if (tier === null) {
            console.error('Unable to read the tier from the configuration');
            return null;
        }
        const { repoURL, contentPath } = await this._getModelContentSettings();
        if (repoURL === null) {
            console.error('Unable to read the model content repo from the configuration');
            return null;
        }
        if (contentPath === null) {
            console.error('Unable to read the content path from the configuration');
            return null;
        }
        return `${repoURL}/refs/heads/${tier}/${contentPath}`;
    }

    /**
     * Reads the raw TIER value from the configuration.
     * @returns {Promise<string|null>} Raw tier value, or null when missing
     */
    async _getTier() {
        const result = await this.configurationDAO.findByType(TIER);
        return result?.keys?.tier || null;
    }

    /**
     * Reads the model content repo URL and content path with a single MODEL_CONTENT lookup.
     * @returns {Promise<{repoURL: string|null, contentPath: string|null}>}
     */
    async _getModelContentSettings() {
        const result = await this.configurationDAO.findByType(MODEL_CONTENT);
        return {
            repoURL: result?.keys?.repo_url || null,
            contentPath: result?.keys?.content_path || null
        };
    }

    /**
     * Returns ttlMinutes when it is a positive integer.
     * Otherwise returns lastTTLMinutes when that is a positive integer, or 1440 (24 hours).
     * @param {*} ttlMinutes Candidate TTL
     * @param {number} [lastTTLMinutes] TTL from the last successful read, used when ttlMinutes is invalid
     * @returns {Promise<number>}
     */
    async _validateTTLMinutes(ttlMinutes, lastTTLMinutes) {
        if (Number.isInteger(ttlMinutes) && ttlMinutes > 0) {
            return ttlMinutes;
        }
        console.error('Invalid MODEL_CONTENT ttl_minutes:', ttlMinutes);
        const fallbackTTLMinutes = lastTTLMinutes;
        if (Number.isInteger(fallbackTTLMinutes) && fallbackTTLMinutes > 0) {
            console.error('Using cached TTL minutes:', fallbackTTLMinutes);
            return fallbackTTLMinutes;
        }
        console.error('Using default TTL minutes:', DEFAULT_MODEL_CONTENT_TTL_MINUTES);
        return DEFAULT_MODEL_CONTENT_TTL_MINUTES;
    }
}

class UserAccessControl {
    constructor(permissions) {
        this.permssions = permissions;
    }
    /**
     * UserAccessControl class to filter permissions.
     * @param {Array} permissions - List of user permissions.
     * @returns {{ disabled: Array, permitted: Array, getInherited: function }} - permission IDs.
     */
    static get(permissions) {
        const accessControl = new UserAccessControl(permissions);
        return {
            disabled: accessControl._getDisabled(),
            permitted: accessControl._getPermitted(),
            getInherited: (permissions)=> {
                return accessControl._getInherited(permissions);
            }
        }
    }

    _getDisabled() {
        return this.permssions
            .filter((u) => u?.disabled)
            .map((u) => u?._id);
    }

    _getPermitted() {
        return this.permssions
            .filter((u) => u?.checked)
            .map((u) => u?._id);
    }
    // In PBAC settings, some permissions in the inherited property must be chosen.
    _getInherited(parentPermissions) {
        const inheritedArray = this.permssions
            .filter((p) => parentPermissions.includes(p?._id) && p?.inherited)
            .flatMap((p) => p?.inherited);
        return new Set(inheritedArray).toArray();
    }
}


module.exports = {
    ConfigurationService
};