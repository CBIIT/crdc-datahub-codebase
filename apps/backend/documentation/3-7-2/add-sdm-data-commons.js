const {
  createDatabaseConnection,
  closeDatabaseConnection
} = require('../recurring-steps/migration-utils');

const CONFIGURATION_COLLECTION = 'configuration';
const DATA_COMMONS_LIST_TYPE = 'DATA_COMMONS_LIST';
const MIGRATION_TYPE = 'MIGRATION_3_7_2_ADD_SDM_TO_DATA_COMMONS_LIST';
const DEFAULT_DATA_COMMONS_LIST = ['CDS', 'ICDC', 'CTDC', 'CCDI', 'PSDC', 'SDM', 'Test MDF', 'Hidden Model'];

async function addSDMToDataCommonsList(db) {
  const collection = db.collection(CONFIGURATION_COLLECTION);

  try {
    const migration = await collection.findOne({ type: MIGRATION_TYPE });
    if (migration) {
      return { success: true, skipped: true, message: 'SDM configuration migration was already applied' };
    }

    const dataCommonsConfig = await collection.findOne({ type: DATA_COMMONS_LIST_TYPE });
    if (dataCommonsConfig) {
      if (!Array.isArray(dataCommonsConfig.key)) {
        throw new Error('DATA_COMMONS_LIST configuration key must be an array');
      }
      if (!dataCommonsConfig.key.includes('SDM')) {
        await collection.updateOne(
          { type: DATA_COMMONS_LIST_TYPE },
          { $addToSet: { key: 'SDM' } }
        );
      }
    } else {
      await collection.insertOne({
        type: DATA_COMMONS_LIST_TYPE,
        key: DEFAULT_DATA_COMMONS_LIST
      });
    }

    await collection.insertOne({ type: MIGRATION_TYPE });
    return { success: true, message: 'SDM added to DATA_COMMONS_LIST' };
  } catch (error) {
    console.error('Error adding SDM to DATA_COMMONS_LIST:', error.message);
    return { success: false, error: error.message };
  }
}

async function main() {
  let client;
  try {
    const dbConnection = await createDatabaseConnection();
    client = dbConnection.client;
    const result = await addSDMToDataCommonsList(dbConnection.db);
    console.log(result.message || result.error);
    if (!result.success) {
      process.exitCode = 1;
    }
  } catch (error) {
    console.error('SDM configuration migration failed:', error.message);
    process.exitCode = 1;
  } finally {
    if (client) {
      await closeDatabaseConnection(client);
    }
  }
}

if (require.main === module) {
  main();
}

module.exports = { addSDMToDataCommonsList };
