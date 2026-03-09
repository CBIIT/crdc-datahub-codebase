import { v4 } from "uuid";
import { vi } from "vitest";

import { contactFactory } from "@/factories/application/ContactFactory";
import { fundingFactory } from "@/factories/application/FundingFactory";
import { piFactory } from "@/factories/application/PIFactory";
import { questionnaireDataFactory } from "@/factories/application/QuestionnaireDataFactory";
import { studyFactory } from "@/factories/application/StudyFactory";
import { institutionFactory } from "@/factories/institution/InstitutionFactory";
import { Logger } from "@/utils/logger";

import { QuestionnaireDataMigrator } from "./QuestionnaireDataMigrator";

vi.mock("@/utils/logger", () => ({
  Logger: {
    info: vi.fn(),
    error: vi.fn(),
  },
}));

let mockGetInstitutions;
let mockGetLastApplication;

beforeEach(() => {
  vi.clearAllMocks();
  mockGetInstitutions = vi.fn();
  mockGetLastApplication = vi.fn();
});

describe("run", () => {
  it("should return the fully migrated questionnaireData object", async () => {
    const data = questionnaireDataFactory.build({
      // This needs the institutionID from API data
      pi: piFactory.build({ institution: "Missing ID" }),
      // This needs no changes
      primaryContact: contactFactory.build(),
      additionalContacts: [
        // Missing institutionID
        contactFactory.build({ institutionID: undefined, institution: "Some Mock Value" }),
        // Needs updated institution name
        contactFactory.build({ institutionID: v4(), institution: "An Outdated Name" }),
        // Needs an updated institution ID
        contactFactory.build({ institutionID: v4(), institution: "This Is No Longer New" }),
      ],
    });

    const mockInstitutions: Institution[] = [
      // PI institution
      institutionFactory.build({ _id: v4(), name: "Missing ID" }),
      // Additional contact institution 1
      institutionFactory.build({ _id: v4(), name: "Some Mock Value" }),
      // Additional contact institution 2
      institutionFactory.build({
        _id: data.additionalContacts[1].institutionID,
        name: "Some new name",
      }),
      // Additional contact institution 3
      institutionFactory.build({
        _id: v4(), // New ID, created via Institution Management
        name: "This Is No Longer New",
      }),
    ];

    mockGetInstitutions.mockResolvedValue({
      data: {
        listInstitutions: {
          institutions: mockInstitutions,
        },
      },
    });

    mockGetLastApplication.mockResolvedValue({
      data: {
        getMyLastApplication: {
          questionnaireData: JSON.stringify(
            questionnaireDataFactory.build({
              pi: piFactory.build({
                firstName: "Bob",
                lastName: "Smith",
                email: "some.mock@example.com",
                address: "756 A Mock Address, Apt 1",
                position: "Mock Position",
                ORCID: "Some ORCID which isn't actually valid",
                institution: "Missing ID", // This will be updated
              }),
            })
          ),
        },
      },
    });

    const migrator = new QuestionnaireDataMigrator(data, {
      getInstitutions: mockGetInstitutions,
      newInstitutions: [
        { id: data.additionalContacts[2].institutionID, name: "This Is No Longer New" },
      ],
      getLastApplication: mockGetLastApplication,
    });

    const result = await migrator.run();

    expect(result).not.toEqual(data);
    expect(result.pi).toEqual({
      // Added via migration
      firstName: "Bob",
      lastName: "Smith",
      email: "some.mock@example.com",
      address: "756 A Mock Address, Apt 1",
      position: "Mock Position",
      ORCID: "Some ORCID which isn't actually valid",
      institution: "Missing ID",
      // Added via migration
      institutionID: mockInstitutions[0]._id,
    });
    expect(result.primaryContact.institutionID).toBe(data.primaryContact.institutionID); // Nothing changed
    expect(result.additionalContacts[0].institutionID).toBe(mockInstitutions[1]._id); // ID was added
    expect(result.additionalContacts[1].institutionID).toBe(mockInstitutions[2]._id); // ID was unchanged
    expect(result.additionalContacts[1].institution).toBe("Some new name"); // Name was updated
    expect(result.additionalContacts[2].institutionID).toBe(mockInstitutions[3]._id); // New ID
    expect(result.additionalContacts[2].institution).toBe("This Is No Longer New"); // Name was unchanged
  });

  it("should migrate the auto-filled data from getMyLastApplication (No ID)", async () => {
    const data = questionnaireDataFactory.build({
      pi: null,
      primaryContact: null,
      additionalContacts: [],
    });

    const mockInstitutions: Institution[] = [
      institutionFactory.build({ _id: v4(), name: "I was populated without an ID!!!" }),
    ];

    mockGetInstitutions.mockResolvedValue({
      data: {
        listInstitutions: {
          institutions: mockInstitutions,
        },
      },
    });

    mockGetLastApplication.mockResolvedValue({
      data: {
        getMyLastApplication: {
          questionnaireData: JSON.stringify(
            questionnaireDataFactory.build({
              pi: piFactory.build({
                institution: "I was populated without an ID!!!", // This will be updated
              }),
            })
          ),
        },
      },
    });

    const migrator = new QuestionnaireDataMigrator(data, {
      getInstitutions: mockGetInstitutions,
      newInstitutions: [],
      getLastApplication: mockGetLastApplication,
    });

    const result = await migrator.run();

    expect(result).not.toEqual(data);
    expect(result.pi).toEqual(
      expect.objectContaining({
        institution: "I was populated without an ID!!!",
        institutionID: mockInstitutions[0]._id,
      })
    );
  });

  it("should migrate the auto-filled data from getMyLastApplication (Old Name)", async () => {
    const data = questionnaireDataFactory.build({
      pi: null,
      primaryContact: null,
      additionalContacts: [],
    });

    const mockInstitutions: Institution[] = [
      institutionFactory.build({ _id: v4(), name: "NEW NAME" }),
    ];

    mockGetInstitutions.mockResolvedValue({
      data: {
        listInstitutions: {
          institutions: mockInstitutions,
        },
      },
    });

    mockGetLastApplication.mockResolvedValue({
      data: {
        getMyLastApplication: {
          questionnaireData: JSON.stringify(
            questionnaireDataFactory.build({
              pi: piFactory.build({
                institution: "an outdated value from an old form", // This will be updated
                institutionID: mockInstitutions[0]._id,
              }),
            })
          ),
        },
      },
    });

    const migrator = new QuestionnaireDataMigrator(data, {
      getInstitutions: mockGetInstitutions,
      newInstitutions: [],
      getLastApplication: mockGetLastApplication,
    });

    const result = await migrator.run();

    expect(result.pi).toEqual(
      expect.objectContaining({
        institution: "NEW NAME",
        institutionID: mockInstitutions[0]._id,
      })
    );
  });
});

describe("getData", () => {
  it("should return the current QuestionnaireData object", () => {
    const data = questionnaireDataFactory.build();

    const migrator = new QuestionnaireDataMigrator(data, {
      getInstitutions: mockGetInstitutions,
      newInstitutions: [],
      getLastApplication: mockGetLastApplication,
    });

    // NOTE: We're not running the migration here, so the data should be identical
    expect(migrator.getData()).toEqual(data);
  });
});

describe("getDependencies", () => {
  it("should return the dependencies used for migration", () => {
    const data = questionnaireDataFactory.build();

    const migrator = new QuestionnaireDataMigrator(data, {
      getInstitutions: mockGetInstitutions,
      newInstitutions: [],
      getLastApplication: mockGetLastApplication,
    });

    expect(migrator.getDependencies()).toEqual({
      getInstitutions: mockGetInstitutions,
      newInstitutions: [],
      getLastApplication: mockGetLastApplication,
    });
  });
});

describe("_migrateLastApp", () => {
  it.each<Section>([undefined, null, { name: "A", status: "Not Started" }])(
    "should migrate only if Section A is not started",
    async (section) => {
      const data = questionnaireDataFactory.build({
        sections: [section],
      });

      const lastAppData = questionnaireDataFactory.build({
        pi: piFactory.build({
          firstName: "XYZ",
          lastName: "123",
        }),
      });

      mockGetLastApplication.mockResolvedValue({
        data: {
          getMyLastApplication: {
            questionnaireData: JSON.stringify(lastAppData),
          },
        },
      });

      const migrator = new QuestionnaireDataMigrator(data, {
        getInstitutions: mockGetInstitutions,
        newInstitutions: [],
        getLastApplication: mockGetLastApplication,
      });

      // @ts-expect-error Calling private helper function
      await migrator._migrateLastApp();
      const result = migrator.getData();

      expect(result.pi).toEqual(
        expect.objectContaining({
          firstName: "XYZ",
          lastName: "123",
        })
      );
      expect(Logger.info).toHaveBeenCalledWith(
        "_migrateLastApp: Migrating last app",
        expect.objectContaining({ ...data }),
        expect.objectContaining({ ...lastAppData })
      );
    }
  );

  it.each<Section>([
    { name: "A", status: "In Progress" },
    { name: "A", status: "Completed" },
  ])("should do nothing if Section A was started", async (section) => {
    const data = questionnaireDataFactory.build({
      sections: [section],
      pi: piFactory.build({
        firstName: "This value will persist",
        lastName: "XYZ 123 do not replace me",
      }),
    });

    mockGetLastApplication.mockResolvedValue({
      data: {
        getMyLastApplication: {
          questionnaireData: JSON.stringify(
            questionnaireDataFactory.build({
              pi: piFactory.build({
                firstName: "SHOULD NOT POPULATE",
                lastName: "NOT CALLED BY API",
              }),
            })
          ),
        },
      },
    });

    const migrator = new QuestionnaireDataMigrator(data, {
      getInstitutions: mockGetInstitutions,
      newInstitutions: [],
      getLastApplication: mockGetLastApplication,
    });

    // @ts-expect-error Calling private helper function
    await migrator._migrateLastApp();
    const result = migrator.getData();

    expect(result).toEqual(data); // No change
    expect(result.pi).toEqual(
      expect.objectContaining({
        firstName: "This value will persist",
        lastName: "XYZ 123 do not replace me",
      })
    );
    expect(mockGetLastApplication).not.toHaveBeenCalled();
    expect(Logger.info).not.toHaveBeenCalled();
  });

  it("should not throw an error if getLastApplication returns no data", async () => {
    const data = questionnaireDataFactory.build({
      sections: [{ name: "A", status: "Not Started" }],
    });

    mockGetLastApplication.mockResolvedValue({
      data: null,
    });

    const migrator = new QuestionnaireDataMigrator(data, {
      getInstitutions: mockGetInstitutions,
      newInstitutions: [],
      getLastApplication: mockGetLastApplication,
    });

    // @ts-expect-error Calling private helper function
    await expect(migrator._migrateLastApp()).resolves.not.toThrow();
    expect(migrator.getData()).toEqual(data);
  });
});

describe("_migrateInstitutionsToID", () => {
  it("should modify nothing if all institutionIDs are valid", async () => {
    const data = questionnaireDataFactory.build({
      pi: piFactory.build({ institution: "mock-1", institutionID: v4() }),
      primaryContact: contactFactory.build({ institution: "mock-2", institutionID: v4() }),
      additionalContacts: [contactFactory.build({ institution: "mock-3", institutionID: v4() })],
    });

    mockGetInstitutions.mockResolvedValue({
      data: {
        listInstitutions: {
          institutions: [],
        },
      },
    });

    const migrator = new QuestionnaireDataMigrator(data, {
      getInstitutions: mockGetInstitutions,
      newInstitutions: [],

      getLastApplication: mockGetLastApplication,
    });

    // @ts-expect-error Calling private helper function
    await migrator._migrateInstitutionsToID();

    expect(migrator.getData()).toEqual(data);
  });

  it("should modify nothing if no contacts are present (1/2)", async () => {
    const data = questionnaireDataFactory.build({
      pi: null,
      primaryContact: null,
      additionalContacts: [],
    });

    mockGetInstitutions.mockResolvedValue({
      data: {
        listInstitutions: {
          institutions: [],
        },
      },
    });

    const migrator = new QuestionnaireDataMigrator(data, {
      getInstitutions: mockGetInstitutions,
      newInstitutions: [],
      getLastApplication: mockGetLastApplication,
    });

    // @ts-expect-error Calling private helper function
    await migrator._migrateInstitutionsToID();

    expect(migrator.getData()).toEqual(data);
  });

  it("should modify nothing if no contacts are present (2/2)", async () => {
    const data = questionnaireDataFactory.build({
      pi: undefined,
      primaryContact: undefined,
      additionalContacts: null,
    });

    mockGetInstitutions.mockResolvedValue({
      data: {
        listInstitutions: {
          institutions: [],
        },
      },
    });

    const migrator = new QuestionnaireDataMigrator(data, {
      getInstitutions: mockGetInstitutions,
      newInstitutions: [],
      getLastApplication: mockGetLastApplication,
    });

    // @ts-expect-error Calling private helper function
    await migrator._migrateInstitutionsToID();

    expect(migrator.getData()).toEqual(data);
  });

  it("should modify nothing if no contacts have institutions", async () => {
    const data = questionnaireDataFactory.build({
      pi: piFactory.build({ institution: null }), // Institution is null
      primaryContact: contactFactory.build({ institution: "" }), // Institution is empty string
      additionalContacts: [contactFactory.build({ institution: undefined })], // Institution is undefined
    });

    mockGetInstitutions.mockResolvedValue({
      data: {
        listInstitutions: {
          institutions: [],
        },
      },
    });

    const migrator = new QuestionnaireDataMigrator(data, {
      getInstitutions: mockGetInstitutions,
      newInstitutions: [],
      getLastApplication: mockGetLastApplication,
    });

    // @ts-expect-error Calling private helper function
    await migrator._migrateInstitutionsToID();

    expect(migrator.getData()).toEqual(data);
  });

  it.each<unknown>([[], null, undefined])(
    "should log an error when no institutions are returned by the API",
    async (result) => {
      const data = questionnaireDataFactory.build({
        pi: piFactory.build({ institution: "mock-1" }),
        primaryContact: contactFactory.build({ institution: "mock-2" }),
        additionalContacts: [contactFactory.build({ institution: "mock-3" })],
      });

      mockGetInstitutions.mockResolvedValue({
        data: {
          listInstitutions: {
            institutions: result,
          },
        },
      });

      const migrator = new QuestionnaireDataMigrator(data, {
        getInstitutions: mockGetInstitutions,
        newInstitutions: [],
        getLastApplication: mockGetLastApplication,
      });

      // @ts-expect-error Calling private helper function
      await migrator._migrateInstitutionsToID();

      expect(Logger.error).toHaveBeenCalledWith(
        expect.stringContaining("No institutions found for migration")
      );
    }
  );

  it("should log an error if no matching institution was found", async () => {
    const data = questionnaireDataFactory.build({
      pi: piFactory.build({ institution: "mock-1" }),
      primaryContact: contactFactory.build({ institution: "mock-2" }),
      additionalContacts: [contactFactory.build({ institution: "mock-3" })],
    });

    mockGetInstitutions.mockResolvedValue({
      data: {
        listInstitutions: {
          institutions: [
            institutionFactory.build({ _id: v4(), name: "mock-1" }),
            // mock-2 is missing to simulate no match
            institutionFactory.build({ _id: v4(), name: "mock-3" }),
          ],
        },
      },
    });

    const migrator = new QuestionnaireDataMigrator(data, {
      getInstitutions: mockGetInstitutions,
      newInstitutions: [],
      getLastApplication: mockGetLastApplication,
    });

    // @ts-expect-error Calling private helper function
    await migrator._migrateInstitutionsToID();

    expect(Logger.error).toHaveBeenCalledWith(
      "_migrateInstitutionsToID: Unable to find a matching institution",
      expect.objectContaining({
        ...contactFactory.build({ institution: "mock-2" }),
      })
    );
  });

  it("should migrate each outdated contact", async () => {
    const data = questionnaireDataFactory.build({
      pi: piFactory.build({ institution: "Some Mock Value" }),
      primaryContact: contactFactory.build({ institution: "AREA-51 Institution XYZ" }),
      additionalContacts: [
        ...contactFactory.build(5, (idx) => ({ institution: `mock-${idx + 1}` })),
        contactFactory.build({ institution: "Some Mock Value" }), // Duplicate of the PI
      ],
    });

    const mockInstitutions: Institution[] = [
      // PI and Primary Contact institutions
      institutionFactory.build({ _id: v4(), name: "Some Mock Value" }),
      institutionFactory.build({ _id: v4(), name: "AREA-51 Institution XYZ" }),
      // First 5 Additional Contacts institutions
      ...institutionFactory.build(5, (idx) => ({ _id: v4(), name: `mock-${idx + 1}` })),
    ];

    mockGetInstitutions.mockResolvedValue({
      data: {
        listInstitutions: {
          institutions: mockInstitutions,
        },
      },
    });

    const migrator = new QuestionnaireDataMigrator(data, {
      getInstitutions: mockGetInstitutions,
      newInstitutions: [],
      getLastApplication: mockGetLastApplication,
    });

    // @ts-expect-error Calling private helper function
    await migrator._migrateInstitutionsToID();
    const result = migrator.getData();

    // Just a sanity check to ensure data was modified
    expect(result).not.toEqual(data);

    // Check that IDs were assigned correctly
    expect(result.pi.institutionID).toBe(mockInstitutions[0]._id);
    expect(result.primaryContact.institutionID).toBe(mockInstitutions[1]._id);
    expect(result.additionalContacts[0].institutionID).toBe(mockInstitutions[2]._id);
    expect(result.additionalContacts[1].institutionID).toBe(mockInstitutions[3]._id);
    expect(result.additionalContacts[2].institutionID).toBe(mockInstitutions[4]._id);
    expect(result.additionalContacts[3].institutionID).toBe(mockInstitutions[5]._id);
    expect(result.additionalContacts[4].institutionID).toBe(mockInstitutions[6]._id);
    expect(result.additionalContacts[5].institutionID).toBe(mockInstitutions[0]._id); // Duplicate of PI

    // Check that Logger.info was called for each migration
    expect(Logger.info).toHaveBeenCalledWith(
      "_migrateInstitutionsToID: Adding institution UUID",
      expect.objectContaining({ ...data.pi }),
      expect.objectContaining({ ...mockInstitutions[0] })
    );
    expect(Logger.info).toHaveBeenCalledWith(
      "_migrateInstitutionsToID: Adding institution UUID",
      expect.objectContaining({ ...data.primaryContact }),
      expect.objectContaining({ _id: mockInstitutions[1]._id })
    );
    data.additionalContacts.slice(0, 4).forEach((contact, idx) => {
      expect(Logger.info).toHaveBeenCalledWith(
        "_migrateInstitutionsToID: Adding institution UUID",
        expect.objectContaining({ ...contact }),
        expect.objectContaining({ _id: mockInstitutions[idx + 2]._id })
      );
    });
    expect(Logger.info).toHaveBeenCalledWith(
      "_migrateInstitutionsToID: Adding institution UUID",
      expect.objectContaining({ ...data.additionalContacts[5] }),
      expect.objectContaining({ _id: mockInstitutions[0]._id })
    );
  });
});

describe("_migrateInstitutionNames", () => {
  it("should modify nothing if no contacts are present (1/2)", async () => {
    const data = questionnaireDataFactory.build({
      pi: null,
      primaryContact: null,
      additionalContacts: [],
    });

    mockGetInstitutions.mockResolvedValue({
      data: {
        listInstitutions: {
          institutions: [
            institutionFactory.build({ _id: v4(), name: "Institution A" }),
            institutionFactory.build({ _id: v4(), name: "Institution B" }),
          ],
        },
      },
    });

    const migrator = new QuestionnaireDataMigrator(data, {
      getInstitutions: mockGetInstitutions,
      newInstitutions: [],
      getLastApplication: mockGetLastApplication,
    });

    // @ts-expect-error Calling private helper function
    await migrator._migrateInstitutionNames();

    expect(migrator.getData()).toEqual(data);
  });

  it("should modify nothing if no contacts are present (2/2)", async () => {
    const data = questionnaireDataFactory.build({
      pi: undefined,
      primaryContact: undefined,
      additionalContacts: null,
    });

    mockGetInstitutions.mockResolvedValue({
      data: {
        listInstitutions: {
          institutions: [
            institutionFactory.build({ _id: v4(), name: "Institution A" }),
            institutionFactory.build({ _id: v4(), name: "Institution B" }),
          ],
        },
      },
    });

    const migrator = new QuestionnaireDataMigrator(data, {
      getInstitutions: mockGetInstitutions,
      newInstitutions: [],
      getLastApplication: mockGetLastApplication,
    });

    // @ts-expect-error Calling private helper function
    await migrator._migrateInstitutionNames();

    expect(migrator.getData()).toEqual(data);
  });

  it("should modify nothing if no contacts have institutions", async () => {
    const data = questionnaireDataFactory.build({
      pi: piFactory.build({ institutionID: null }),
      primaryContact: contactFactory.build({ institutionID: "" }),
      additionalContacts: [contactFactory.build({ institutionID: undefined })],
    });

    mockGetInstitutions.mockResolvedValue({
      data: {
        listInstitutions: {
          institutions: [
            institutionFactory.build({ _id: v4(), name: "Institution A" }),
            institutionFactory.build({ _id: v4(), name: "Institution B" }),
          ],
        },
      },
    });

    const migrator = new QuestionnaireDataMigrator(data, {
      getInstitutions: mockGetInstitutions,
      newInstitutions: [],
      getLastApplication: mockGetLastApplication,
    });

    // @ts-expect-error Calling private helper function
    await migrator._migrateInstitutionNames();

    expect(migrator.getData()).toEqual(data);
  });

  it.each<unknown>([[], null, undefined])(
    "should log an error when no institutions are returned by the API",
    async (institutions) => {
      const data = questionnaireDataFactory.build({
        pi: piFactory.build({ institutionID: v4(), institution: "Institution A" }),
        primaryContact: contactFactory.build({
          institutionID: v4(),
          institution: "Institution B",
        }),
        additionalContacts: [
          contactFactory.build({ institutionID: v4(), institution: "Institution C" }),
        ],
      });

      mockGetInstitutions.mockResolvedValue({
        data: {
          listInstitutions: {
            institutions,
          },
        },
      });

      const migrator = new QuestionnaireDataMigrator(data, {
        getInstitutions: mockGetInstitutions,
        newInstitutions: [],
        getLastApplication: mockGetLastApplication,
      });

      // @ts-expect-error Calling private helper function
      await migrator._migrateInstitutionNames();

      expect(migrator.getData()).toEqual(data);
      expect(Logger.error).toHaveBeenCalledWith(
        expect.stringContaining("No institutions found for migration")
      );
    }
  );

  it("should modify nothing if the institution was not returned by the API", async () => {
    const data = questionnaireDataFactory.build({
      pi: piFactory.build({ institutionID: v4(), institution: "Institution A" }),
      primaryContact: contactFactory.build({
        institutionID: v4(),
        institution: "Institution B",
      }),
      additionalContacts: [
        contactFactory.build({ institutionID: v4(), institution: "Institution C" }),
      ],
    });

    mockGetInstitutions.mockResolvedValue({
      data: {
        listInstitutions: {
          institutions: [
            // NOTE: Using different UUIDs to simulate no match
            institutionFactory.build({ _id: v4(), name: "Institution D" }),
          ],
        },
      },
    });

    const migrator = new QuestionnaireDataMigrator(data, {
      getInstitutions: mockGetInstitutions,
      newInstitutions: [],
      getLastApplication: mockGetLastApplication,
    });

    // @ts-expect-error Calling private helper function
    await migrator._migrateInstitutionNames();

    expect(migrator.getData()).toEqual(data);
    expect(Logger.error).toHaveBeenCalledWith(
      "_migrateInstitutionNames: Unable to find a matching institution",
      expect.objectContaining({ ...data.pi })
    );
    expect(Logger.error).toHaveBeenCalledWith(
      "_migrateInstitutionNames: Unable to find a matching institution",
      expect.objectContaining({ ...data.primaryContact })
    );
    expect(Logger.error).toHaveBeenCalledWith(
      "_migrateInstitutionNames: Unable to find a matching institution",
      expect.objectContaining({ ...data.additionalContacts[0] })
    );
  });

  it("should update each outdated contact name", async () => {
    const data = questionnaireDataFactory.build({
      pi: piFactory.build({ institutionID: v4(), institution: "OLD NAME A" }),
      primaryContact: contactFactory.build({
        institutionID: v4(),
        institution: "OLD NAME B",
      }),
      additionalContacts: [
        contactFactory.build({ institutionID: v4(), institution: "OLD NAME C" }),
        contactFactory.build({ institutionID: v4(), institution: "OLD NAME D" }),
      ],
    });

    const mockInstitutions = [
      // NOTE: we're referencing the same institution IDs as in the data
      institutionFactory.build({ _id: data.pi.institutionID, name: "Institution A" }),
      institutionFactory.build({ _id: data.primaryContact.institutionID, name: "Institution B" }),
      institutionFactory.build({
        _id: data.additionalContacts[0].institutionID,
        name: "Institution C",
      }),
      institutionFactory.build({
        _id: data.additionalContacts[1].institutionID,
        name: "Institution D",
      }),
    ];

    mockGetInstitutions.mockResolvedValue({
      data: {
        listInstitutions: {
          institutions: mockInstitutions,
        },
      },
    });

    const migrator = new QuestionnaireDataMigrator(data, {
      getInstitutions: mockGetInstitutions,
      newInstitutions: [],

      getLastApplication: mockGetLastApplication,
    });

    // @ts-expect-error Calling private helper function
    await migrator._migrateInstitutionNames();
    const result = migrator.getData();

    // Just a sanity check to ensure data was modified
    expect(result).not.toEqual(data);

    // Check that names were updated correctly
    expect(result.pi.institution).toBe(mockInstitutions[0].name);
    expect(result.primaryContact.institution).toBe(mockInstitutions[1].name);
    expect(result.additionalContacts[0].institution).toBe(mockInstitutions[2].name);
    expect(result.additionalContacts[1].institution).toBe(mockInstitutions[3].name);

    // Check that Logger.info was called for each migration
    expect(Logger.info).toHaveBeenCalledWith(
      "_migrateInstitutionNames: Updating institution name",
      expect.objectContaining({ ...data.pi }),
      expect.objectContaining({ ...mockInstitutions[0] })
    );
    expect(Logger.info).toHaveBeenCalledWith(
      "_migrateInstitutionNames: Updating institution name",
      expect.objectContaining({ ...data.primaryContact }),
      expect.objectContaining({ ...mockInstitutions[1] })
    );
    expect(Logger.info).toHaveBeenCalledWith(
      "_migrateInstitutionNames: Updating institution name",
      expect.objectContaining({ ...data.additionalContacts[0] }),
      expect.objectContaining({ ...mockInstitutions[2] })
    );
    expect(Logger.info).toHaveBeenCalledWith(
      "_migrateInstitutionNames: Updating institution name",
      expect.objectContaining({ ...data.additionalContacts[1] }),
      expect.objectContaining({ ...mockInstitutions[3] })
    );
  });

  it("should not update institution name if it matches the API data", async () => {
    const data = questionnaireDataFactory.build({
      pi: piFactory.build({ institutionID: v4(), institution: "good-to-go" }),
      primaryContact: contactFactory.build({
        institutionID: v4(),
        institution: "good-name",
      }),
      additionalContacts: [
        contactFactory.build({ institutionID: v4(), institution: "we-are-good" }),
      ],
    });

    const mockInstitutions = [
      // NOTE: we're referencing the same institution IDs as in the data
      institutionFactory.build({ _id: data.pi.institutionID, name: "good-to-go" }),
      institutionFactory.build({ _id: data.primaryContact.institutionID, name: "good-name" }),
      institutionFactory.build({
        _id: data.additionalContacts[0].institutionID,
        name: "we-are-good",
      }),
    ];

    mockGetInstitutions.mockResolvedValue({
      data: {
        listInstitutions: {
          institutions: mockInstitutions,
        },
      },
    });

    const migrator = new QuestionnaireDataMigrator(data, {
      getInstitutions: mockGetInstitutions,
      newInstitutions: [],
      getLastApplication: mockGetLastApplication,
    });

    // @ts-expect-error Calling private helper function
    await migrator._migrateInstitutionNames();
    const result = migrator.getData();

    // Ensure data was not modified
    expect(result).toEqual(data);
    expect(Logger.info).not.toHaveBeenCalled();
    expect(Logger.error).not.toHaveBeenCalled();
  });

  it("should not log an error if the institution was not found but is in newInstitutions", async () => {
    const data = questionnaireDataFactory.build({
      pi: piFactory.build({ institutionID: v4(), institution: "This is new" }),
      primaryContact: contactFactory.build(),
      additionalContacts: [],
    });

    mockGetInstitutions.mockResolvedValue({
      data: {
        listInstitutions: {
          institutions: [
            // NOTE: We're just populating this to avoid a pre-condition error
            institutionFactory.build({ _id: v4(), name: "Institution D" }),
          ],
        },
      },
    });

    const migrator = new QuestionnaireDataMigrator(data, {
      getInstitutions: mockGetInstitutions,
      newInstitutions: [{ id: data.pi.institutionID, name: "Institution A" }],
      getLastApplication: mockGetLastApplication,
    });

    // @ts-expect-error Calling private helper function
    await migrator._migrateInstitutionNames();
    const result = migrator.getData();

    // Ensure data was not modified
    expect(result).toEqual(data);
    expect(Logger.error).not.toHaveBeenCalled();
  });
});

describe("_migrateExistingInstitutions", () => {
  it("should migrate duplicate institutions by name to the existing institutions list", async () => {
    const data = questionnaireDataFactory.build({
      pi: piFactory.build({ institutionID: v4(), institution: "Institution A" }),
      primaryContact: contactFactory.build({
        institutionID: v4(),
        institution: "Institution B",
      }),
      additionalContacts: [
        contactFactory.build({ institutionID: v4(), institution: "Institution C" }),
      ],
    });

    const mockInstitutions = [
      // API data has different IDs but same names
      institutionFactory.build({ _id: v4(), name: "Institution A" }),
      institutionFactory.build({ _id: v4(), name: "Institution B" }),
      institutionFactory.build({ _id: v4(), name: "Institution C" }),
    ];

    mockGetInstitutions.mockResolvedValue({
      data: {
        listInstitutions: {
          institutions: mockInstitutions,
        },
      },
    });

    const migrator = new QuestionnaireDataMigrator(data, {
      getInstitutions: mockGetInstitutions,
      newInstitutions: [
        // These institutions are already in the data
        { id: data.pi.institutionID, name: data.pi.institution },
        { id: data.primaryContact.institutionID, name: data.primaryContact.institution },
        {
          id: data.additionalContacts[0].institutionID,
          name: data.additionalContacts[0].institution,
        },
      ],
      getLastApplication: mockGetLastApplication,
    });

    // @ts-expect-error Calling private helper function
    await migrator._migrateExistingInstitutions();
    const result = migrator.getData();

    // Check data
    expect(result).not.toEqual(data);
    expect(result.pi.institutionID).toBe(mockInstitutions[0]._id);
    expect(result.primaryContact.institutionID).toBe(mockInstitutions[1]._id);
    expect(result.additionalContacts[0].institutionID).toBe(mockInstitutions[2]._id);

    // Check logs
    expect(Logger.info).toHaveBeenCalledWith(
      "_migrateExistingInstitutions: Migrating to API ID",
      expect.objectContaining({ ...data.pi }),
      expect.objectContaining({ ...mockInstitutions[0] })
    );
    expect(Logger.info).toHaveBeenCalledWith(
      "_migrateExistingInstitutions: Migrating to API ID",
      expect.objectContaining({ ...data.primaryContact }),
      expect.objectContaining({ ...mockInstitutions[1] })
    );
    expect(Logger.info).toHaveBeenCalledWith(
      "_migrateExistingInstitutions: Migrating to API ID",
      expect.objectContaining({ ...data.additionalContacts[0] }),
      expect.objectContaining({ ...mockInstitutions[2] })
    );
  });

  it("should not migrate if the institution is already in existing institutions", async () => {
    const data = questionnaireDataFactory.build({
      pi: piFactory.build({ institutionID: v4(), institution: "Institution A" }),
      primaryContact: contactFactory.build({
        institutionID: v4(),
        institution: "Institution B",
      }),
      additionalContacts: [
        contactFactory.build({ institutionID: v4(), institution: "Institution C" }),
      ],
    });

    const mockInstitutions = [
      // API data has the same data as the questionnaire
      institutionFactory.build({ _id: data.pi.institutionID, name: "Institution A" }),
      institutionFactory.build({ _id: data.primaryContact.institutionID, name: "Institution B" }),
      institutionFactory.build({
        _id: data.additionalContacts[0].institutionID,
        name: "Institution C",
      }),
    ];

    mockGetInstitutions.mockResolvedValue({
      data: {
        listInstitutions: {
          institutions: mockInstitutions,
        },
      },
    });

    const migrator = new QuestionnaireDataMigrator(data, {
      getInstitutions: mockGetInstitutions,
      newInstitutions: [
        // These institutions are already in the data and in the API
        { id: mockInstitutions[0]._id, name: mockInstitutions[0].name },
        { id: mockInstitutions[1]._id, name: mockInstitutions[1].name },
        { id: mockInstitutions[2]._id, name: mockInstitutions[2].name },
      ],
      getLastApplication: mockGetLastApplication,
    });

    // @ts-expect-error Calling private helper function
    await migrator._migrateExistingInstitutions();
    const result = migrator.getData();

    // Ensure no changes were made
    expect(result).toEqual(data);
    expect(Logger.info).not.toHaveBeenCalled();
    expect(Logger.error).not.toHaveBeenCalled();
  });

  it("should not migrate if the institution is not new", async () => {
    const data = questionnaireDataFactory.build({
      pi: piFactory.build({ institutionID: v4(), institution: "Institution A" }),
      primaryContact: contactFactory.build({
        institutionID: v4(),
        institution: "Institution B",
      }),
      additionalContacts: [
        contactFactory.build({ institutionID: v4(), institution: "Institution C" }),
      ],
    });

    const mockInstitutions = [
      // API data has different IDs but same names
      institutionFactory.build({ _id: v4(), name: "Institution A" }),
      institutionFactory.build({ _id: v4(), name: "Institution B" }),
      institutionFactory.build({ _id: v4(), name: "Institution C" }),
    ];

    mockGetInstitutions.mockResolvedValue({
      data: {
        listInstitutions: {
          institutions: mockInstitutions,
        },
      },
    });

    const migrator = new QuestionnaireDataMigrator(data, {
      getInstitutions: mockGetInstitutions,
      newInstitutions: [],
      getLastApplication: mockGetLastApplication,
    });

    // @ts-expect-error Calling private helper function
    await migrator._migrateExistingInstitutions();
    const result = migrator.getData();

    // Even though the IDs are different, the institutions are not explicitly new
    // so no changes should be made
    expect(result).toEqual(data);
    expect(Logger.info).not.toHaveBeenCalled();
    expect(Logger.error).not.toHaveBeenCalled();
  });

  it("should make no changes if no institutions are present", async () => {
    const data = questionnaireDataFactory.build({
      pi: null,
      primaryContact: null,
      additionalContacts: null,
    });

    mockGetInstitutions.mockResolvedValue({
      data: {
        listInstitutions: {
          // Provide some data to avoid pre-condition errors
          institutions: [institutionFactory.build({ _id: v4(), name: "Institution A" })],
        },
      },
    });

    const migrator = new QuestionnaireDataMigrator(data, {
      getInstitutions: mockGetInstitutions,
      newInstitutions: [],
      getLastApplication: mockGetLastApplication,
    });

    // @ts-expect-error Calling private helper function
    await migrator._migrateExistingInstitutions();
    const result = migrator.getData();

    // Ensure no changes were made
    expect(result).toEqual(data);
    expect(Logger.info).not.toHaveBeenCalled();
    expect(Logger.error).not.toHaveBeenCalled();
  });

  it.each<unknown>([null, []])(
    "should log an error if no institutions are returned by the API",
    async (resp) => {
      const data = questionnaireDataFactory.build({
        pi: piFactory.build({ institutionID: v4(), institution: "Institution A" }),
        primaryContact: null,
        additionalContacts: [],
      });

      mockGetInstitutions.mockResolvedValue({
        data: {
          listInstitutions: {
            institutions: resp,
          },
        },
      });

      const migrator = new QuestionnaireDataMigrator(data, {
        getInstitutions: mockGetInstitutions,
        newInstitutions: [],
        getLastApplication: mockGetLastApplication,
      });

      // @ts-expect-error Calling private helper function
      await migrator._migrateExistingInstitutions();
      const result = migrator.getData();

      // Ensure no changes were made
      expect(result).toEqual(data);
      expect(Logger.error).toHaveBeenCalledWith(
        expect.stringContaining("No institutions found for migration")
      );
    }
  );
});

describe("_migrateGPA", () => {
  it("should migrate the first funding nciGPA found to GPAName and remove nciGPA from all funding objects", async () => {
    const data = questionnaireDataFactory.build({
      study: studyFactory.build({
        funding: [
          fundingFactory.build({ nciGPA: "", agency: "NCI" }),
          fundingFactory.build({ nciGPA: null, agency: "NIH" }),
          fundingFactory.build({ nciGPA: 123 as unknown as string, agency: "Other" }),
          fundingFactory.build({ nciGPA: "GPA-11111", agency: "Other" }),
        ],
      }),
    });

    const migrator = new QuestionnaireDataMigrator(data, {
      getInstitutions: mockGetInstitutions,
      newInstitutions: [],
      getLastApplication: mockGetLastApplication,
    });

    // @ts-expect-error Calling private helper function
    await migrator._migrateGPA();
    const result = migrator.getData();

    expect(result).not.toEqual(data);
    expect(result.study.GPAName).toBe("GPA-11111");
    expect(result.study.funding[0]).not.toHaveProperty("nciGPA");
    expect(result.study.funding[1]).not.toHaveProperty("nciGPA");
    expect(result.study.funding[2]).not.toHaveProperty("nciGPA");
    expect(result.study.funding[0].agency).toBe("NCI");
    expect(result.study.funding[1].agency).toBe("NIH");
    expect(result.study.funding[2].agency).toBe("Other");

    expect(Logger.info).toHaveBeenCalledWith(
      "_migrateGPA: Migrating GPA to study level",
      expect.objectContaining({
        study: expect.objectContaining({
          funding: expect.arrayContaining([
            expect.objectContaining({ agency: "NCI" }),
            expect.objectContaining({ agency: "NIH" }),
            expect.objectContaining({ agency: "Other" }),
          ]),
        }),
      })
    );
  });

  it("should handle empty nciGPA value by setting GPAName to empty string", async () => {
    const data = questionnaireDataFactory.build({
      study: studyFactory.build({
        funding: [
          fundingFactory.build({ nciGPA: "", agency: "NCI" }),
          fundingFactory.build({ nciGPA: "", agency: "NIH" }),
        ],
      }),
    });

    const migrator = new QuestionnaireDataMigrator(data, {
      getInstitutions: mockGetInstitutions,
      newInstitutions: [],
      getLastApplication: mockGetLastApplication,
    });

    // @ts-expect-error Calling private helper function
    await migrator._migrateGPA();
    const result = migrator.getData();

    expect(result.study.GPAName).toBe("");
    expect(result.study.funding[0]).not.toHaveProperty("nciGPA");
    expect(result.study.funding[1]).not.toHaveProperty("nciGPA");
  });

  it("should handle null nciGPA value by setting GPAName to empty string", async () => {
    const data = questionnaireDataFactory.build({
      study: studyFactory.build({
        funding: fundingFactory.build(1, { nciGPA: null, agency: "NCI" }),
      }),
    });

    const migrator = new QuestionnaireDataMigrator(data, {
      getInstitutions: mockGetInstitutions,
      newInstitutions: [],
      getLastApplication: mockGetLastApplication,
    });

    // @ts-expect-error Calling private helper function
    await migrator._migrateGPA();
    const result = migrator.getData();

    expect(result.study.GPAName).toBe("");
    expect(result.study.funding[0]).not.toHaveProperty("nciGPA");
  });

  it("should handle undefined nciGPA value by setting GPAName to empty string", async () => {
    const data = questionnaireDataFactory.build({
      study: studyFactory.build({
        funding: fundingFactory.build(1, { agency: "NCI", nciGPA: undefined }),
      }),
    });

    const migrator = new QuestionnaireDataMigrator(data, {
      getInstitutions: mockGetInstitutions,
      newInstitutions: [],
      getLastApplication: mockGetLastApplication,
    });

    // @ts-expect-error Calling private helper function
    await migrator._migrateGPA();
    const result = migrator.getData();

    expect(result.study.GPAName).toBe("");
    expect(result.study.funding[0]).not.toHaveProperty("nciGPA");
  });

  it("should do nothing if no funding array exists", async () => {
    const data = questionnaireDataFactory.build({
      study: studyFactory.build({ funding: null }),
    });

    const migrator = new QuestionnaireDataMigrator(data, {
      getInstitutions: mockGetInstitutions,
      newInstitutions: [],
      getLastApplication: mockGetLastApplication,
    });

    // @ts-expect-error Calling private helper function
    await migrator._migrateGPA();
    const result = migrator.getData();

    expect(result).toEqual(data);
    expect(Logger.info).not.toHaveBeenCalled();
  });

  it("should do nothing if funding array is empty", async () => {
    const data = questionnaireDataFactory.build({
      study: studyFactory.build({ funding: [] }),
    });

    const migrator = new QuestionnaireDataMigrator(data, {
      getInstitutions: mockGetInstitutions,
      newInstitutions: [],
      getLastApplication: mockGetLastApplication,
    });

    // @ts-expect-error Calling private helper function
    await migrator._migrateGPA();
    const result = migrator.getData();

    expect(result).toEqual(data);
    expect(Logger.info).not.toHaveBeenCalled();
  });

  it("should do nothing if study is null", async () => {
    const data = questionnaireDataFactory.build({ study: null });

    const migrator = new QuestionnaireDataMigrator(data, {
      getInstitutions: mockGetInstitutions,
      newInstitutions: [],
      getLastApplication: mockGetLastApplication,
    });

    // @ts-expect-error Calling private helper function
    await migrator._migrateGPA();
    const result = migrator.getData();

    expect(result).toEqual(data);
    expect(Logger.info).not.toHaveBeenCalled();
  });

  it("should do nothing if study is undefined", async () => {
    const data = questionnaireDataFactory.build({ study: undefined });

    const migrator = new QuestionnaireDataMigrator(data, {
      getInstitutions: mockGetInstitutions,
      newInstitutions: [],
      getLastApplication: mockGetLastApplication,
    });

    // @ts-expect-error Calling private helper function
    await migrator._migrateGPA();
    const result = migrator.getData();

    expect(result).toEqual(data);
    expect(Logger.info).not.toHaveBeenCalled();
  });

  it("should preserve existing study properties while adding GPAName", async () => {
    const data = questionnaireDataFactory.build({
      study: studyFactory.build({
        name: "Test Study",
        description: "A test study",
        abbreviation: "should be preserved",
        funding: fundingFactory.build(1, {
          nciGPA: "GPA-98765",
          agency: "NCI",
          grantNumbers: "1a0x35b",
        }),
      }),
    });

    const migrator = new QuestionnaireDataMigrator(data, {
      getInstitutions: mockGetInstitutions,
      newInstitutions: [],
      getLastApplication: mockGetLastApplication,
    });

    // @ts-expect-error Calling private helper function
    await migrator._migrateGPA();
    const result = migrator.getData();

    expect(result.study.name).toBe("Test Study");
    expect(result.study.description).toBe("A test study");
    expect(result.study.abbreviation).toBe("should be preserved");
    expect(result.study.GPAName).toBe("GPA-98765");
    expect(result.study.funding[0]).not.toHaveProperty("nciGPA");
    expect(result.study.funding[0].agency).toBe("NCI");
    expect(result.study.funding[0].grantNumbers).toBe("1a0x35b");
  });
});
