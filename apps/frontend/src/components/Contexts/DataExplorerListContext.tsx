import React from "react";

const DataExplorerListContext = React.createContext<{
  handleClickStudyAbbreviation?: (study: ReleasedStudy) => void;
}>({});

export default DataExplorerListContext;
