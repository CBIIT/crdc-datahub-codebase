import { DashboardContentOptions } from "amazon-quicksight-embedding-sdk";

import { Logger } from "./logger";

/**
 * Constructs and returns an array of QuickSight parameter objects for a user's studies.
 *
 * - If the user's first study is `All`, the function returns an empty array (allowing QuickSight to display all data).
 * - If the user has a valid array of studies, it creates a `studiesParameter` whose values are the `_id` fields of each study.
 * - Otherwise, it logs an error and returns a parameter array with `["NO-CONTENT"]`.
 *
 *
 * @param {User} user - The current user
 * @returns {DashboardContentOptions["parameters"]} The updated dashboard parameters
 */
export const addStudiesParameter = (user: User): DashboardContentOptions["parameters"] => {
  const params: DashboardContentOptions["parameters"] = [];
  const { studies } = user || {};

  // If user contains the "All" study, do NOT push the "studiesParameter"
  if ((studies || [])?.findIndex((s) => s?._id === "All") !== -1) {
    return params;
  }

  // Otherwise, push a real or fallback param
  if (Array.isArray(studies) && studies.length > 0) {
    params.push({
      Name: "studiesParameter",
      Values: studies.map((s) => s._id),
    });
    return params;
  }

  Logger.error(
    "Federal Lead requires studies to be set but none or invalid values were found.",
    studies
  );
  params.push({ Name: "studiesParameter", Values: ["NO-CONTENT"] });
  return params;
};

/**
 * Constructs and returns an array of QuickSight parameter objects for a user's data commons.
 *
 * - If the user has a valid array of data commons, it creates a `dataCommonsParameter` whose values are the array elements.
 * - Otherwise, it logs an error and returns a parameter array with `["NO-CONTENT"]`.
 *
 *
 * @param {User} user - The current user
 * @returns {DashboardContentOptions["parameters"]} The updated dashboard parameters
 */
export const addDataCommonsParameter = (user: User): DashboardContentOptions["parameters"] => {
  const params: DashboardContentOptions["parameters"] = [];
  const { dataCommons } = user || {};

  if (Array.isArray(dataCommons) && dataCommons.length > 0) {
    params.push({ Name: "dataCommonsParameter", Values: dataCommons });
    return params;
  }

  Logger.error(
    "Data Commons Personnel requires dataCommons to be set but none were found.",
    dataCommons
  );
  params.push({ Name: "dataCommonsParameter", Values: ["NO-CONTENT"] });
  return params;
};
