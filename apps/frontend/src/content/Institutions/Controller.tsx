import { FC } from "react";
import { Navigate, useParams } from "react-router-dom";

import { Status, useAuthContext } from "../../components/Contexts/AuthContext";
import SuspenseLoader from "../../components/SuspenseLoader";
import { hasPermission } from "../../config/AuthPermissions";

import InstitutionView from "./InstitutionView";
import ListView from "./ListView";

/**
 * Renders the correct view based on the URL and permissions-tier
 *
 * @returns The Institution Controller component
 */
const InstitutionController: FC = () => {
  const { institutionId } = useParams<{ institutionId?: string }>();
  const { user, status: authStatus } = useAuthContext();

  if (authStatus === Status.LOADING) {
    return <SuspenseLoader data-testid="institution-suspense-loader" />;
  }

  if (!hasPermission(user, "institution", "manage")) {
    return <Navigate to="/" />;
  }

  if (!institutionId) {
    return <ListView />;
  }

  return <InstitutionView _id={institutionId} />;
};

export default InstitutionController;
