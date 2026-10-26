import { useParams } from "react-router-dom";

import { SRFMessaging } from "@/components/Messaging/adapters/SRFMessaging";

import { FormProvider } from "../../components/Contexts/FormContext";
import { InstitutionProvider } from "../../components/Contexts/InstitutionListContext";
import { OrganizationProvider } from "../../components/Contexts/OrganizationListContext";

import FormView from "./FormView";
import ListView from "./ListView";

/**
 * Render the correct view based on the URL
 *
 * @param {void}
 * @returns {FC} - React component
 */
const QuestionnaireController = () => {
  const { appId, section } = useParams();

  if (appId) {
    return (
      <OrganizationProvider preload>
        <InstitutionProvider filterInactive>
          <FormProvider id={appId}>
            <FormView section={section} />
            <SRFMessaging />
          </FormProvider>
        </InstitutionProvider>
      </OrganizationProvider>
    );
  }

  return <ListView />;
};

export default QuestionnaireController;
