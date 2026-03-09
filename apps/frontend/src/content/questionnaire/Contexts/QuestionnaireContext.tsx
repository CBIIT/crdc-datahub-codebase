import React from "react";

import { ListApplicationsResp } from "../../../graphql";

const QuestionnaireContext = React.createContext<{
  /**
   * The current user
   */
  user?: User;
  /**
   * Action performed when 'Review' button is clicked
   */
  handleOnReviewClick?: (
    application: ListApplicationsResp["listApplications"]["applications"][number]
  ) => void;
  /**
   * A reference to the table's actions
   */
  tableRef?: React.RefObject<TableMethods>;
}>({});

export default QuestionnaireContext;
