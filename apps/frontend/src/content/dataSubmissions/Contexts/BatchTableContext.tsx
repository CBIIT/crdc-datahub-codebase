import React from "react";

const BatchTableContext = React.createContext<{
  handleOpenErrorDialog?: (data: Batch) => void;
  handleOpenFileListDialog?: (data: Batch) => void;
}>({});

export default BatchTableContext;
