const { OMB_INFO } = require('../constants/db-constants');
const ConfigurationDAO = require('./configuration');

/**
 * Load the OMB_INFO configuration document.
 * @returns {Promise<object|null>}
 */
async function getOMBConfiguration() {
    const configurationDAO = new ConfigurationDAO();
    return configurationDAO.findByType(OMB_INFO);
}

module.exports = getOMBConfiguration;
