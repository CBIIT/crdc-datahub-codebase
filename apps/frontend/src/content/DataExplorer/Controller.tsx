import { lazy, memo } from "react";
import { useParams } from "react-router-dom";

import { Status as AuthStatus, useAuthContext } from "../../components/Contexts/AuthContext";
import LazyLoader from "../../components/LazyLoader";
import SuspenseLoader from "../../components/SuspenseLoader";

import ListView from "./ListView";

const StudyView = LazyLoader(lazy(() => import("./StudyView")));

type RouteParams = {
  studyId?: string;
};

/**
 * Render the correct view based on the URL
 *
 * @returns The Data Explorer Controller component
 */
const DataExplorerController = () => {
  const { status: authStatus } = useAuthContext();
  const { studyId } = useParams<RouteParams>();

  if (authStatus === AuthStatus.LOADING) {
    return <SuspenseLoader data-testid="data-explorer-suspense-loader" />;
  }

  if (studyId) {
    return <StudyView _id={studyId} />;
  }

  return <ListView />;
};

export default memo(DataExplorerController);
