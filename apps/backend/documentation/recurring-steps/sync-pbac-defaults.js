/**
 * Recurring step: sync PBAC defaults from resources/json/PBACDefaults_config.json into MongoDB.
 * Merges missing permission and notification entries per role without replacing the whole document.
 *
 * Usage: Called by the current release migration orchestrator (e.g. 3.7.0)
 */

const path = require('path');
const fs = require('fs');

const CONFIGURATION_COLLECTION = 'configuration';
const PBAC_CONFIG_TYPE = 'PBAC';

function loadPbacDefaultsFromJson() {
    const jsonPath = path.join(__dirname, '../../resources/json/PBACDefaults_config.json');
    const raw = fs.readFileSync(jsonPath, 'utf8');
    return JSON.parse(raw);
}

/**
 * Merge items from source array into target by _id (permissions or notifications).
 * @param {Array} targetItems
 * @param {Array} sourceItems
 * @returns {{ merged: Array, addedCount: number }}
 */
function mergeItemsById(targetItems, sourceItems) {
    const merged = Array.isArray(targetItems) ? [...targetItems] : [];
    const existingIds = new Set(merged.map((item) => item?._id).filter(Boolean));
    let addedCount = 0;

    for (const item of sourceItems || []) {
        if (!item?._id || existingIds.has(item._id)) {
            continue;
        }
        merged.push(item);
        existingIds.add(item._id);
        addedCount += 1;
    }

    return { merged, addedCount };
}

/**
 * Merge JSON Defaults into Mongo role defaults (permissions + notifications).
 * @param {Array} mongoDefaults
 * @param {Array} jsonDefaults
 * @returns {{ defaults: Array, rolesUpdated: number, itemsAdded: number }}
 */
function mergeRoleDefaults(mongoDefaults, jsonDefaults) {
    const defaults = Array.isArray(mongoDefaults) ? mongoDefaults.map((roleDef) => ({ ...roleDef })) : [];
    let rolesUpdated = 0;
    let itemsAdded = 0;

    for (const jsonRole of jsonDefaults || []) {
        const roleName = jsonRole?.role;
        if (!roleName) {
            continue;
        }

        let mongoRole = defaults.find((r) => r.role === roleName);
        if (!mongoRole) {
            defaults.push({
                role: roleName,
                permissions: [...(jsonRole.permissions || [])],
                notifications: [...(jsonRole.notifications || [])]
            });
            rolesUpdated += 1;
            itemsAdded += (jsonRole.permissions?.length || 0) + (jsonRole.notifications?.length || 0);
            continue;
        }

        const permMerge = mergeItemsById(mongoRole.permissions, jsonRole.permissions);
        const notifMerge = mergeItemsById(mongoRole.notifications, jsonRole.notifications);
        const roleAdded = permMerge.addedCount + notifMerge.addedCount;

        if (roleAdded > 0) {
            mongoRole.permissions = permMerge.merged;
            mongoRole.notifications = notifMerge.merged;
            rolesUpdated += 1;
            itemsAdded += roleAdded;
        }
    }

    return { defaults, rolesUpdated, itemsAdded };
}

/**
 * @param {import('mongodb').Db} db
 * @returns {Promise<{success: boolean, message?: string, rolesUpdated?: number, itemsAdded?: number, inserted?: boolean, error?: string}>}
 */
async function syncPbacDefaults(db) {
    console.log('🔄 Syncing PBAC defaults from JSON into configuration...');

    const jsonConfig = loadPbacDefaultsFromJson();
    const collection = db.collection(CONFIGURATION_COLLECTION);

    try {
        const existing = await collection.findOne({
            type: PBAC_CONFIG_TYPE,
            version: jsonConfig.version
        });

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
                message: `Inserted PBAC configuration version ${jsonConfig.version}`,
                rolesUpdated: jsonConfig.Defaults?.length || 0,
                itemsAdded: 0
            };
        }

        const { defaults, rolesUpdated, itemsAdded } = mergeRoleDefaults(
            existing.Defaults,
            jsonConfig.Defaults
        );

        if (itemsAdded === 0 && rolesUpdated === 0) {
            console.log('   ℹ️  PBAC configuration already up to date');
            return { success: true, skipped: true, message: 'PBAC configuration already up to date' };
        }

        await collection.updateOne(
            { _id: existing._id },
            { $set: { Defaults: defaults } }
        );

        console.log(`   ✅ Updated PBAC: ${rolesUpdated} role(s), ${itemsAdded} new permission/notification entries`);
        return {
            success: true,
            rolesUpdated,
            itemsAdded,
            message: `Merged ${itemsAdded} entries across ${rolesUpdated} role(s)`
        };
    } catch (error) {
        console.error('   ❌ Error syncing PBAC defaults:', error.message);
        return { success: false, error: error.message };
    }
}

module.exports = {
    syncPbacDefaults,
    loadPbacDefaultsFromJson,
    mergeItemsById,
    mergeRoleDefaults
};
