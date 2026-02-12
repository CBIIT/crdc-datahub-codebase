import React from "react";

const QCResultsContext = React.createContext<{
  handleOpenErrorDialog?: (data: QCResult) => void;
  handleExpandClick?: (issue: AggregatedQCResult) => void;
}>({});

export default QCResultsContext;
