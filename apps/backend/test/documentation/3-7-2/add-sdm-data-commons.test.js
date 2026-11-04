const { addSDMToDataCommonsList } = require('../../../documentation/3-7-2/add-sdm-data-commons');

const DATA_COMMONS_LIST_TYPE = 'DATA_COMMONS_LIST';
const MIGRATION_TYPE = 'MIGRATION_3_7_2_ADD_SDM_TO_DATA_COMMONS_LIST';

function createMockDb(initialDocuments = []) {
  const documents = new Map(initialDocuments.map((document) => [document.type, document]));
  const collection = {
    findOne: jest.fn(async ({ type }) => documents.get(type) || null),
    updateOne: jest.fn(async ({ type }, update) => {
      documents.get(type).key.push(update.$addToSet.key);
      return { modifiedCount: 1 };
    }),
    insertOne: jest.fn(async (document) => {
      documents.set(document.type, document);
      return { insertedId: document.type };
    })
  };

  return {
    db: { collection: jest.fn(() => collection) },
    collection,
    documents
  };
}

describe('add-sdm-data-commons migration', () => {
  beforeEach(() => {
    jest.spyOn(console, 'error').mockImplementation(() => { });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('adds SDM while preserving the existing data commons list', async () => {
    const { db, collection, documents } = createMockDb([
      { type: DATA_COMMONS_LIST_TYPE, key: ['CDS', 'PSDC'] }
    ]);

    const result = await addSDMToDataCommonsList(db);

    expect(result.success).toBe(true);
    expect(documents.get(DATA_COMMONS_LIST_TYPE).key).toEqual(['CDS', 'PSDC', 'SDM']);
    expect(collection.updateOne).toHaveBeenCalledWith(
      { type: DATA_COMMONS_LIST_TYPE },
      { $addToSet: { key: 'SDM' } }
    );
    expect(documents.has(MIGRATION_TYPE)).toBe(true);
  });

  it('does not re-add SDM after the completed migration is removed from the list', async () => {
    const { db, collection, documents } = createMockDb([
      { type: DATA_COMMONS_LIST_TYPE, key: ['CDS'] }
    ]);

    await addSDMToDataCommonsList(db);
    documents.get(DATA_COMMONS_LIST_TYPE).key = ['CDS'];

    const result = await addSDMToDataCommonsList(db);

    expect(result).toEqual({
      success: true,
      skipped: true,
      message: 'SDM configuration migration was already applied'
    });
    expect(collection.updateOne).toHaveBeenCalledTimes(1);
    expect(documents.get(DATA_COMMONS_LIST_TYPE).key).toEqual(['CDS']);
  });

  it('creates the default list with SDM when no list configuration exists', async () => {
    const { db, documents } = createMockDb();

    const result = await addSDMToDataCommonsList(db);

    expect(result.success).toBe(true);
    expect(documents.get(DATA_COMMONS_LIST_TYPE).key).toEqual([
      'CDS', 'ICDC', 'CTDC', 'CCDI', 'PSDC', 'SDM', 'Test MDF', 'Hidden Model'
    ]);
  });
});
