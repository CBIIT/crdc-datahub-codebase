import { useLazyQuery, useMutation } from "@apollo/client";
import { merge, cloneDeep } from "lodash";
import React, { FC, createContext, useContext, useEffect, useMemo, useState } from "react";
import { v4 } from "uuid";

import { QuestionnaireDataMigrator } from "@/classes/QuestionnaireDataMigrator";

import { InitialApplication, InitialQuestionnaire } from "../../config/InitialValues";
import {
  APPROVE_APP,
  GET_APP,
  LAST_APP,
  REJECT_APP,
  INQUIRE_APP,
  REOPEN_APP,
  SAVE_APP,
  SUBMIT_APP,
  ApproveAppResp,
  GetAppResp,
  LastAppResp,
  InquireAppResp,
  RejectAppResp,
  ReopenAppResp,
  SaveAppResp,
  SubmitAppResp,
  ApproveAppInput,
  SaveAppInput,
  LIST_INSTITUTIONS,
  ListInstitutionsInput,
  ListInstitutionsResp,
} from "../../graphql";
import { Logger } from "../../utils";
import { FormInput as ApproveFormInput } from "../Questionnaire/ApproveFormDialog";

export type SetDataReturnType =
  | { status: "success"; id: string }
  | { status: "failed"; errorMessage: string };

export type ContextState = {
  status: Status;
  data: Application;
  formRef: React.RefObject<HTMLFormElement>;
  submitData?: () => Promise<string | boolean>;
  reopenForm?: () => Promise<string | boolean>;
  approveForm?: (data: ApproveFormInput, wholeProgram: boolean) => Promise<SetDataReturnType>;
  inquireForm?: (comment: string) => Promise<string | boolean>;
  rejectForm?: (comment: string) => Promise<string | boolean>;
  setData?: (
    questionnaire: QuestionnaireData,
    opts?: { skipSave?: boolean }
  ) => Promise<SetDataReturnType>;
  error?: string;
};

export enum Status {
  LOADING = "LOADING", // Loading initial data
  LOADED = "LOADED", // Successfully loaded data
  ERROR = "ERROR", // Error loading data
  SAVING = "SAVING", // Saving data to the API
  SUBMITTING = "SUBMITTING", // Submitting data to the API
}

const initialState: ContextState = {
  status: Status.LOADING,
  data: null,
  formRef: React.createRef<HTMLFormElement>(),
  error: null,
};

/**
 * Form Context
 *
 * NOTE: Do NOT use this context directly. Use the useFormContext hook instead.
 *       this is exported for testing purposes only.
 *
 * @see ContextState – Form context state
 * @see useFormContext – Form context hook
 */
export const Context = createContext<ContextState>(null);
Context.displayName = "FormContext";

/**
 * Form Context Hook
 *
 * @see FormProvider – Must be wrapped in a FormProvider component
 * @see ContextState – Form context state returned by the hook
 * @returns {ContextState} - Form context
 */
export const useFormContext = (): ContextState => {
  const context = useContext<ContextState>(Context);

  if (!context) {
    throw new Error("FormContext cannot be used outside of the FormProvider component");
  }

  return context;
};

type ProviderProps = {
  id: string;
  children: React.ReactNode;
};

/**
 * Creates a form context for the given form ID
 *
 * @see useFormContext – Form context hook
 * @param props Form context provider props
 * @returns The Form context provider
 */
export const FormProvider: FC<ProviderProps> = ({ children, id }: ProviderProps) => {
  const [state, setState] = useState<ContextState>(initialState);

  const [getInstitutions] = useLazyQuery<ListInstitutionsResp, ListInstitutionsInput>(
    LIST_INSTITUTIONS,
    {
      variables: { first: -1, orderBy: "name", sortDirection: "asc" },
      context: { clientName: "backend" },
      fetchPolicy: "cache-first",
      onError: (e) => Logger.error("FormContext listInstitutions API error:", e),
    }
  );

  const [lastApp] = useLazyQuery<LastAppResp>(LAST_APP, {
    context: { clientName: "backend" },
    fetchPolicy: "no-cache",
  });

  const [getApp] = useLazyQuery<GetAppResp>(GET_APP, {
    variables: { id },
    context: { clientName: "backend" },
    fetchPolicy: "no-cache",
  });

  const [saveApp] = useMutation<SaveAppResp, SaveAppInput>(SAVE_APP, {
    context: { clientName: "backend" },
    fetchPolicy: "no-cache",
  });

  const [submitApp] = useMutation<SubmitAppResp>(SUBMIT_APP, {
    variables: { id },
    context: { clientName: "backend" },
    fetchPolicy: "no-cache",
  });

  const [reopenApp] = useMutation<ReopenAppResp>(REOPEN_APP, {
    variables: { id },
    context: { clientName: "backend" },
    fetchPolicy: "no-cache",
  });

  const [approveApp] = useMutation<ApproveAppResp, ApproveAppInput>(APPROVE_APP, {
    context: { clientName: "backend" },
    fetchPolicy: "no-cache",
  });

  const [inquireApp] = useMutation<InquireAppResp>(INQUIRE_APP, {
    variables: { id },
    context: { clientName: "backend" },
    fetchPolicy: "no-cache",
  });

  const [rejectApp] = useMutation<RejectAppResp>(REJECT_APP, {
    variables: { id },
    context: { clientName: "backend" },
    fetchPolicy: "no-cache",
  });

  const setData = async (
    data: QuestionnaireData,
    opts?: { skipSave?: boolean }
  ): Promise<SetDataReturnType> => {
    const newState = {
      ...state,
      data: {
        ...state.data,
        questionnaireData: data,
      },
    };

    setState((prevState) => ({ ...prevState, status: Status.SAVING }));
    const fullPIName = `${data?.pi?.firstName || ""} ${data?.pi?.lastName || ""}`.trim();

    const newStatus: ApplicationStatus = data?.sections?.some((s) => s.status !== "Not Started")
      ? "In Progress"
      : "New";

    const newInstitutions = [...newState.data.newInstitutions];
    const { pi, primaryContact, additionalContacts } = newState.data.questionnaireData;
    const contacts = [pi, primaryContact, ...(additionalContacts || [])].filter(
      (obj) => obj && (obj.institution || obj.institutionID)
    );

    contacts.forEach((contact) => {
      if (contact.institutionID) {
        return;
      }

      const prevId = newInstitutions.find(({ name }) => name === contact.institution)?.id;
      if (prevId) {
        contact.institutionID = prevId;
      } else {
        const newId = v4();
        newInstitutions.push({ id: newId, name: contact.institution });
        contact.institutionID = newId;
      }
    });

    if (opts?.skipSave) {
      setState({ ...newState, status: Status.LOADED, error: null });
      return {
        status: "success",
        id: newState.data._id,
      };
    }

    const { data: d, errors } = await saveApp({
      variables: {
        application: {
          _id: newState?.data?._id === "new" ? undefined : newState?.data?._id,
          studyName: data?.study?.name,
          studyAbbreviation: data?.study?.abbreviation || data?.study?.name,
          questionnaireData: JSON.stringify(data),
          controlledAccess: data?.accessTypes?.includes("Controlled Access") || false,
          openAccess: data?.accessTypes?.includes("Open Access") || false,
          ORCID: data?.pi?.ORCID,
          PI: fullPIName,
          programName: data?.program?.name,
          programAbbreviation: data?.program?.abbreviation,
          programDescription: data?.program?.description,
          newInstitutions: newInstitutions
            .filter((inst) => contacts.findIndex((c) => c.institutionID === inst.id) !== -1)
            .map(({ id, name }) => ({ id, name })),
          GPAName: data?.study?.GPAName,
        },
        status: newStatus,
      },
    }).catch((e) => ({ data: null, errors: [e] }));

    if (errors || !d?.saveApplication?._id) {
      const errorMessage = errors?.[0]?.message || "An unknown GraphQL Error occurred";

      Logger.error("Unable to save application", errors);
      setState({
        ...newState,
        status: Status.ERROR,
        error: errorMessage,
      });

      return {
        status: "failed",
        errorMessage,
      };
    }

    // eslint-disable-next-line @typescript-eslint/dot-notation
    if (d?.saveApplication?._id && data["_id"] === "new") {
      newState.data = {
        ...newState.data,
        _id: d.saveApplication._id,
        applicant: d?.saveApplication?.applicant,
      };
    }

    newState.data = {
      ...newState.data,
      programName: d?.saveApplication?.programName,
      studyAbbreviation: d?.saveApplication?.studyAbbreviation,
      status: d?.saveApplication?.status,
      updatedAt: d?.saveApplication?.updatedAt,
      createdAt: d?.saveApplication?.createdAt,
      submittedDate: d?.saveApplication?.submittedDate,
      history: d?.saveApplication?.history,
      newInstitutions: d?.saveApplication?.newInstitutions,
    };

    setState({ ...newState, status: Status.LOADED, error: null });
    return {
      status: "success",
      id: d.saveApplication._id,
    };
  };

  const submitData = async () => {
    setState((prevState) => ({ ...prevState, status: Status.SUBMITTING }));

    const { data: res, errors } = await submitApp({
      variables: {
        _id: state?.data._id,
      },
    });

    if (errors) {
      setState((prevState) => ({ ...prevState, status: Status.LOADED }));
      return false;
    }

    setState((prevState) => ({ ...prevState, status: Status.LOADED }));
    return res?.submitApplication?._id || false;
  };

  // Here we approve the form to the API with a comment and wholeProgram
  const approveForm = async (
    data: ApproveFormInput,
    wholeProgram: boolean
  ): Promise<SetDataReturnType> => {
    setState((prevState) => ({ ...prevState, status: Status.SUBMITTING }));

    const { data: res, errors } = await approveApp({
      variables: {
        id: state?.data?._id,
        comment: data?.reviewComment,
        wholeProgram,
        pendingModelChange: data?.pendingModelChange,
      },
    }).catch((e) => ({ data: null, errors: [e] }));

    if (errors || !res?.approveApplication?._id) {
      setState((prevState) => ({ ...prevState, status: Status.ERROR }));
      return {
        status: "failed",
        errorMessage: errors?.[0]?.message || "An unknown GraphQL Error occurred",
      };
    }

    setState((prevState) => ({ ...prevState, status: Status.LOADED }));
    return {
      status: "success",
      id: res?.approveApplication?._id,
    };
  };

  // Here we set the form to inquired through the API with a comment
  const inquireForm = async (comment: string) => {
    setState((prevState) => ({ ...prevState, status: Status.SUBMITTING }));

    const { data: res, errors } = await inquireApp({
      variables: {
        _id: state?.data._id,
        comment,
      },
    }).catch((e) => ({ data: null, errors: [e] }));

    if (errors || !res?.inquireApplication?._id) {
      setState((prevState) => ({ ...prevState, status: Status.ERROR }));
      return false;
    }

    setState((prevState) => ({ ...prevState, status: Status.LOADED }));
    return res?.inquireApplication?._id;
  };

  // Here we reject the form to the API with a comment
  const rejectForm = async (comment: string) => {
    setState((prevState) => ({ ...prevState, status: Status.SUBMITTING }));

    const { data: res, errors } = await rejectApp({
      variables: {
        _id: state?.data._id,
        comment,
      },
    }).catch((e) => ({ data: null, errors: [e] }));

    if (errors || !res?.rejectApplication?._id) {
      setState((prevState) => ({ ...prevState, status: Status.ERROR }));
      return false;
    }

    setState((prevState) => ({ ...prevState, status: Status.LOADED }));
    return res?.rejectApplication?._id;
  };

  // Reopen a form when it has been rejected and they submit an updated form
  const reopenForm = async () => {
    setState((prevState) => ({ ...prevState, status: Status.LOADING }));

    const { data: res, errors } = await reopenApp({
      variables: {
        _id: state?.data._id,
      },
    }).catch((e) => ({ data: null, errors: [e] }));

    if (errors || !res?.reopenApplication?._id) {
      setState((prevState) => ({ ...prevState, status: Status.ERROR }));
      return false;
    }

    setState((prevState) => ({
      ...prevState,
      data: {
        ...prevState?.data,
        ...res?.reopenApplication,
      },
      status: Status.LOADED,
    }));
    return res?.reopenApplication?._id;
  };

  useEffect(() => {
    if (!id || !id.trim()) {
      setState({
        status: Status.ERROR,
        data: null,
        formRef: null,
        error: "Invalid application ID provided",
      });
      return;
    }

    (async () => {
      const { data: d, error } = await getApp();
      if (error || !d?.getApplication?.questionnaireData) {
        setState({
          status: Status.ERROR,
          data: null,
          formRef: null,
          error: "An unknown API or GraphQL error occurred",
        });
        return;
      }

      const { getApplication } = d;
      const questionnaireData: QuestionnaireData = JSON.parse(
        getApplication?.questionnaireData || null
      );

      const migrator = new QuestionnaireDataMigrator(questionnaireData, {
        getInstitutions,
        newInstitutions: getApplication?.newInstitutions || [],
        getLastApplication: lastApp,
      });
      const migratedData = await migrator.run();

      setState({
        status: Status.LOADED,
        formRef: state.formRef,
        data: {
          ...merge(cloneDeep(InitialApplication), d?.getApplication),
          questionnaireData: {
            ...merge(cloneDeep(InitialQuestionnaire), migratedData),
          },
        },
      });
    })();
  }, [id]);

  const value = useMemo(
    () => ({
      ...state,
      setData,
      submitData,
      approveForm,
      inquireForm,
      rejectForm,
      reopenForm,
    }),
    [state]
  );

  return <Context.Provider value={value}>{children}</Context.Provider>;
};
