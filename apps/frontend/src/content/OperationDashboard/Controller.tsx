import { useQuery } from "@apollo/client";
import { useSnackbar } from "notistack";
import { useMemo } from "react";
import { Navigate, useSearchParams } from "react-router-dom";

import { Status, useAuthContext } from "../../components/Contexts/AuthContext";
import SuspenseLoader from "../../components/SuspenseLoader";
import { hasPermission } from "../../config/AuthPermissions";
import { GET_DASHBOARD_URL, GetDashboardURLInput, GetDashboardURLResp } from "../../graphql";
import usePageTitle from "../../hooks/usePageTitle";

import DashboardView from "./DashboardView";

/**
 * Handles the logic for the OperationDashboard component.
 *
 * @returns The DashboardController component
 */
const DashboardController = () => {
  usePageTitle("Operation Dashboard");

  const { user, status: authStatus } = useAuthContext();
  const { enqueueSnackbar } = useSnackbar();
  const [searchParams] = useSearchParams({ type: "Submission" });

  const canManage = useMemo<boolean>(
    () => authStatus === Status.LOADED && hasPermission(user, "dashboard", "view"),
    [authStatus, user]
  );

  const { data, error, loading } = useQuery<GetDashboardURLResp, GetDashboardURLInput>(
    GET_DASHBOARD_URL,
    {
      variables: { type: searchParams.get("type") },
      skip: !canManage || !searchParams.get("type"),
      onError: (e) =>
        enqueueSnackbar(e?.message, {
          variant: "error",
        }),
      fetchPolicy: "no-cache",
    }
  );

  if (authStatus === Status.LOADING) {
    return <SuspenseLoader />;
  }

  if (!canManage) {
    return <Navigate to="/" />;
  }

  return (
    <DashboardView
      loading={loading}
      url={!error && data?.getDashboardURL ? data?.getDashboardURL?.url : null}
      currentType={searchParams.get("type")}
    />
  );
};

export default DashboardController;
