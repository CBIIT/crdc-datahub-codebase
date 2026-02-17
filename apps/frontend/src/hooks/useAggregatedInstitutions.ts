import { useQuery } from "@apollo/client";
import { useEffect, useState } from "react";

import { useFormContext } from "@/components/Contexts/FormContext";
import { ListInstitutionsResp, ListInstitutionsInput, LIST_INSTITUTIONS } from "@/graphql";
import { Logger } from "@/utils";

/**
 * Represents the result of calling the `useAggregatedInstitutions` hook.
 */
type UseAggregatedInstitutionsResult = {
  /**
   * The combined dataset derived from the Submission Request data and listInstitutions result
   */
  data: AggregatedInstitution[];
};

/**
 * Represents an Institution returned by the `useAggregatedInstitutions` hook.
 */
export type AggregatedInstitution = Pick<Institution, "_id" | "name">;

/**
 * A hook to aggregate the list of institutions from two locations:
 *
 *  1. The current Submission Request
 *  2. The listInstitutions API
 *
 * Also provides related utilities.
 *
 * @returns {UseAggregatedInstitutionsResult} The aggregated institutions data and related utils.
 */
const useAggregatedInstitutions = (): UseAggregatedInstitutionsResult => {
  const [list, setList] = useState<AggregatedInstitution[]>([]);

  const { data: appData } = useFormContext();
  const { data: apiData } = useQuery<ListInstitutionsResp, ListInstitutionsInput>(
    LIST_INSTITUTIONS,
    {
      variables: { first: -1, orderBy: "name", sortDirection: "asc", status: "Active" },
      context: { clientName: "backend" },
      fetchPolicy: "cache-first",
      onError: (e) => Logger.error("useAggregatedInstitutions received API error:", e),
    }
  );

  useEffect(() => {
    const newList: AggregatedInstitution[] = [];
    newList.push(
      ...(apiData?.listInstitutions?.institutions?.map(({ _id, name }) => ({
        _id,
        name,
      })) || [])
    );

    newList.push(
      ...(appData?.newInstitutions
        ?.map(({ id, name }) => ({
          _id: id,
          name,
        }))
        .filter(({ name }) => newList.findIndex((inst) => inst.name === name) === -1) || [])
    );

    newList.sort((a, b) => a.name?.toLocaleLowerCase().localeCompare(b.name?.toLocaleLowerCase()));

    setList(newList);
  }, [appData?.newInstitutions, apiData?.listInstitutions?.institutions]);

  return { data: list };
};

export default useAggregatedInstitutions;
