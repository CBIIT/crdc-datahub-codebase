/**
 * Recurring step: sync PBAC defaults from resources/json/PBACDefaults_config.json into MongoDB.
 * Inserts when no PBAC config exists; overwrites when the JSON version is higher than Mongo;
 * otherwise does nothing.
 *
 * Usage: Called by the current release migration orchestrator (e.g. 3.7.0)
 */

const path = require('path');
const fs = require('fs');
const semver = require('semver');

const CONFIGURATION_COLLECTION = 'configuration';
const PBAC_CONFIG_TYPE = 'PBAC';

function loadPbacDefaultsFromJson() {
    const jsonPath = path.join(__dirname, '../../resources/json/PBACDefaults_config.json');
    const raw = fs.readFileSync(jsonPath, 'utf8');
    return JSON.parse(raw);
}

/**
 * Coerces a version string to a valid semver, or null if unparseable.
 * @param {*} version
 * @returns {string|null}
 */
function coerceSemver(version) {
    return semver.valid(semver.coerce(version));
}

/**
 * True when the Mongo PBAC version should be replaced by the JSON version.
 * Invalid or missing Mongo versions are treated as older so overwrite still runs.
 * @param {string} mongoVersion
 * @param {string} jsonVersion Must be a valid (coercible) semver
 * @returns {boolean}
 * @throws {Error} When jsonVersion is invalid or unparseable
 */
function shouldOverwriteVersion(mongoVersion, jsonVersion) {
    const json = coerceSemver(jsonVersion);
    if (!json) {
        throw new Error(`Invalid PBAC JSON version: ${jsonVersion}`);
    }
    const mongo = coerceSemver(mongoVersion);
    if (!mongo) {
        return true;
    }
    return semver.lt(mongo, json);
}

/**
 * Syncs PBAC defaults from JSON into the configuration collection.
 * Inserts when no PBAC doc exists; overwrites type/version/Defaults when Mongo version is lower;
 * skips when versions are equal or Mongo is newer.
 * @param {import('mongodb').Db} db
 * @returns {Promise<{success: boolean, message?: string, inserted?: boolean, overwritten?: boolean, skipped?: boolean, error?: string}>}
 */
async function syncPbacDefaults(db) {
    console.log('🔄 Syncing PBAC defaults from JSON into configuration...');

    const collection = db.collection(CONFIGURATION_COLLECTION);

    try {
        const jsonConfig = loadPbacDefaultsFromJson();
        if (!coerceSemver(jsonConfig.version)) {
            throw new Error(`Invalid PBAC JSON version: ${jsonConfig.version}`);
        }

        const existing = await collection.findOne({ type: PBAC_CONFIG_TYPE });

        if (!existing) {
            const doc = {
                _id: jsonConfig._id,
                type: jsonConfig.type,
                version: jsonConfig.version,
                Defaults: jsonConfig.Defaults
            };
            await collection.insertOne(doc);
            console.log(`   ✅ Inserted PBAC configuration version ${jsonConfig.version}`);
            return {
                success: true,
                inserted: true,
                message: `Inserted PBAC configuration version ${jsonConfig.version}`
            };
        }

        if (!shouldOverwriteVersion(existing.version, jsonConfig.version)) {
            console.log('   ℹ️  PBAC configuration already up to date');
            return { success: true, skipped: true, message: 'PBAC configuration already up to date' };
        }

        await collection.replaceOne(
            { _id: existing._id },
            {
                _id: existing._id,
                type: jsonConfig.type,
                version: jsonConfig.version,
                Defaults: jsonConfig.Defaults
            }
        );

        console.log(`   ✅ Overwrote PBAC configuration (version ${existing.version} → ${jsonConfig.version})`);
        return {
            success: true,
            overwritten: true,
            message: `Overwrote PBAC configuration version ${existing.version} with ${jsonConfig.version}`
        };
    } catch (error) {
        console.error('   ❌ Error syncing PBAC defaults:', error.message);
        return { success: false, error: error.message };
    }
}

module.exports = {
    syncPbacDefaults,
    loadPbacDefaultsFromJson,
    shouldOverwriteVersion
};
