import { LazyQueryExecFunction } from "@apollo/client";
import { cloneDeep, unset } from "lodash";
import { validate as validateUUID } from "uuid";

import { LastAppResp, ListInstitutionsResp } from "@/graphql";
import { safeParse } from "@/utils";
import { Logger } from "@/utils/logger";

/**
 * The required dependencies to run data migrations
 */
type MigratorDependencies = {
  getInstitutions: LazyQueryExecFunction<ListInstitutionsResp, unknown>;
  newInstitutions: Array<{ id: string; name: string }>;
  getLastApplication: LazyQueryExecFunction<LastAppResp, unknown>;
};

/**
 * A specialized class to handle data migrations of QuestionnaireData
 */
export class QuestionnaireDataMigrator {
  /**
   * The QuestionnaireData object that will be migrated.
   */
  private data: QuestionnaireData;

  /**
   * The dependencies required for migration, such as fetching institutions.
   * This allows the migrator to be decoupled from specific data-fetching implementations.
   */
  private dependencies: MigratorDependencies;

  /**
   * Creates an instance of the QuestionnaireDataMigrator.
   *
   * @param data The QuestionnaireData object to be migrated.
   * @param dependencies The migration dependencies
   */
  constructor(data: QuestionnaireData, dependencies: MigratorDependencies) {
    this.data = cloneDeep(data);
    this.dependencies = dependencies;
  }

  /**
   * Executes all migration steps in a predefined order.
   *
   * @returns The fully migrated questionnaireData object.
   */
  public async run(): Promise<QuestionnaireData> {
    await this._migrateLastApp();
    await this._migrateExistingInstitutions();
    await this._migrateInstitutionsToID();
    await this._migrateInstitutionNames();
    await this._migrateGPA();

    return this.data;
  }

  /**
   * Gets the mutated QuestionnaireData object.
   * This method is primarily for testing purposes to verify the migration results.
   *
   * @returns The mutated QuestionnaireData object.
   */
  public getData(): QuestionnaireData {
    return this.data;
  }

  /**
   * Gets the dependencies used by the migrator.
   * This method is useful for testing or further operations that may require the same dependencies.
   *
   * @returns The dependencies used by the migrator, useful for testing or further operations.
   */
  public getDependencies(): MigratorDependencies {
    return this.dependencies;
  }

  /**
   * Migrates information from the last Submission Request on create
   */
  private async _migrateLastApp(): Promise<void> {
    const { sections } = this.data;
    const { getLastApplication } = this.dependencies;

    const sectionA: Section = sections?.find((s: Section) => s?.name === "A");
    if (!sectionA || sectionA?.status === "Not Started") {
      const { data: lastAppData } = await getLastApplication();
      const { getMyLastApplication: lastApp } = lastAppData || {};
      const parsedLastAppData = safeParse<QuestionnaireData>(lastApp?.questionnaireData);

      Logger.info("_migrateLastApp: Migrating last app", { ...this.data }, parsedLastAppData);
      this.data.pi = {
        ...this.data.pi,
        ...parsedLastAppData.pi,
      };
    }
  }

  /**
   * Migrates institution names to IDs in the questionnaireData.
   */
  private async _migrateInstitutionsToID(): Promise<void> {
    const { pi, primaryContact, additionalContacts } = this.data;
    const { getInstitutions } = this.dependencies;

    const outdatedContacts = [pi, primaryContact, ...(additionalContacts || [])].filter(
      (obj) => obj && !!obj.institution && !validateUUID(obj.institutionID)
    );
    if (outdatedContacts.length === 0) {
      return;
    }

    const { data } = await getInstitutions();
    const institutionList = data?.listInstitutions?.institutions || [];
    if (institutionList.length === 0) {
      Logger.error("_migrateInstitutionsToID: No institutions found for migration");
      return;
    }

    outdatedContacts.forEach((contact) => {
      const { institution } = contact;

      // Find the institution by name
      const apiData = institutionList.find((i) => i.name === institution);
      if (validateUUID(apiData?._id)) {
        Logger.info("_migrateInstitutionsToID: Adding institution UUID", { ...contact }, apiData);
        contact.institutionID = apiData._id;
        return;
      }

      Logger.error("_migrateInstitutionsToID: Unable to find a matching institution", contact);
    });
  }

  /**
   * Updates any outdated institution names in the questionnaireData.
   */
  private async _migrateInstitutionNames(): Promise<void> {
    const { pi, primaryContact, additionalContacts } = this.data;
    const { getInstitutions, newInstitutions } = this.dependencies;

    const contactsWithUUID = [pi, primaryContact, ...(additionalContacts || [])].filter(
      (obj) => obj && validateUUID(obj.institutionID)
    );
    if (contactsWithUUID.length === 0) {
      return;
    }

    const { data } = await getInstitutions();
    const institutionList = data?.listInstitutions?.institutions || [];
    if (institutionList.length === 0) {
      Logger.error("_migrateInstitutionNames: No institutions found for migration");
      return;
    }

    contactsWithUUID.forEach((contact) => {
      const { institutionID } = contact;

      // Find the institution by ID
      const apiData = institutionList.find((i) => i._id === institutionID);
      const newInstitution = newInstitutions.find((i) => i.id === institutionID);
      if (!!apiData?.name && apiData.name !== contact.institution) {
        Logger.info("_migrateInstitutionNames: Updating institution name", { ...contact }, apiData);
        contact.institution = apiData.name;
      } else if (!apiData && !newInstitution) {
        Logger.error("_migrateInstitutionNames: Unable to find a matching institution", contact);
      }
    });
  }

  /**
   * Migrates any duplicate institutions by name to the existing institutions list ID.
   * This de-duplicates institutions that may have been created with the same name
   * during the questionnaire creation process.
   */
  private async _migrateExistingInstitutions(): Promise<void> {
    const { pi, primaryContact, additionalContacts } = this.data;
    const { getInstitutions, newInstitutions } = this.dependencies;

    const outdatedContacts = [pi, primaryContact, ...(additionalContacts || [])].filter(
      (obj) => obj && !!obj.institution && validateUUID(obj.institutionID)
    );
    if (outdatedContacts.length === 0) {
      return;
    }

    const { data } = await getInstitutions();
    const institutionList = data?.listInstitutions?.institutions || [];
    if (institutionList.length === 0) {
      Logger.error("_migrateExistingInstitutions: No institutions found for migration");
      return;
    }

    outdatedContacts.forEach((contact) => {
      const { institution, institutionID } = contact;

      // Find the institution by name
      const apiData = institutionList.find((i) => i.name === institution);
      const newInstitution = newInstitutions.find((i) => i.id === institutionID);
      if (newInstitution && apiData && apiData._id !== institutionID) {
        Logger.info("_migrateExistingInstitutions: Migrating to API ID", { ...contact }, apiData);
        contact.institutionID = apiData._id;
      }
    });
  }

  /**
   * Migrates the outdated GPA field to new location in the questionnaireData.
   */
  private async _migrateGPA(): Promise<void> {
    const fundingHasOutdatedProperty = this.data?.study?.funding?.some((f) =>
      Object.hasOwn(f, "nciGPA")
    );
    if (!fundingHasOutdatedProperty) {
      return;
    }

    Logger.info("_migrateGPA: Found outdated nciGPA field", cloneDeep(this.data.study.funding));

    // Find first valid nciGPA and migrate it, if found
    const fundingWithGPA = this.data.study.funding.find(
      (f) => typeof f.nciGPA === "string" && f.nciGPA.trim().length > 0
    );
    if (fundingWithGPA) {
      Logger.info("_migrateGPA: Migrating GPA to study level", this.data);
      this.data.study = {
        ...this.data.study,
        GPAName: fundingWithGPA.nciGPA.trim() || "",
      };
    }

    // Remove outdated nciGPA fields
    this.data.study.funding.forEach((f) => unset(f, "nciGPA"));
  }
}
