import { FC } from "react";
import { Navigate, useParams } from "react-router-dom";

import { Status, useAuthContext } from "../../components/Contexts/AuthContext";
import { OrganizationProvider } from "../../components/Contexts/OrganizationListContext";
import SuspenseLoader from "../../components/SuspenseLoader";
import { hasPermission } from "../../config/AuthPermissions";

import ListView from "./ListView";
import OrganizationView from "./OrganizationView";

const WrappedListView = () => (
  <OrganizationProvider preload>
    <ListView />
  </OrganizationProvider>
);

/**
 * Renders the correct view based on the URL and permissions-tier
 *
 * @returns The Organization Controller component
 */
const OrganizationController: FC = () => {
  const { orgId } = useParams<{ orgId?: string }>();
  const { user, status: authStatus } = useAuthContext();

  if (authStatus === Status.LOADING) {
    return <SuspenseLoader data-testid="organization-suspense-loader" />;
  }

  if (!hasPermission(user, "program", "manage")) {
    return <Navigate to="/" />;
  }

  return orgId ? <OrganizationView _id={orgId} /> : <WrappedListView />;
};

export default OrganizationController;
