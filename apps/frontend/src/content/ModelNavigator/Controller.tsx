import React from "react";
import { Navigate, useParams } from "react-router-dom";

import ErrorBoundary from "../../components/ErrorBoundary";
import usePageTitle from "../../hooks/usePageTitle";

import NavigatorView from "./NavigatorView";

const ModelNavigatorController: React.FC = () => {
  usePageTitle("Model Navigator");

  const { model, version } = useParams<{ model: string; version?: string }>();
  if (!version) {
    return <Navigate to={`/model-navigator/${model}/latest`} />;
  }

  return (
    <ErrorBoundary
      key={`${model}_${version}`}
      errorMessage="Unable to load the Model Navigator for the requested model"
    >
      <NavigatorView model={model} version={version} />
    </ErrorBoundary>
  );
};

export default ModelNavigatorController;
