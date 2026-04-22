import { LoadingButton } from "@mui/lab";
import {
  Checkbox,
  CheckboxProps,
  Container,
  Divider,
  FormControlLabel,
  Stack,
  styled,
} from "@mui/material";
import { isEqual, cloneDeep } from "lodash";
import { useSnackbar } from "notistack";
import { FC, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useBlocker, Blocker, Navigate, useLocation } from "react-router-dom";

import bannerPng from "../../assets/banner/submission_banner.png";
import CheckboxCheckedIconSvg from "../../assets/icons/checkbox_checked.svg?url";
import ChevronLeft from "../../assets/icons/chevron_left.svg?react";
import ChevronRight from "../../assets/icons/chevron_right.svg?react";
import CancelApplicationButton from "../../components/CancelApplicationButton";
import { Status as AuthStatus, useAuthContext } from "../../components/Contexts/AuthContext";
import { Status as FormStatus, useFormContext } from "../../components/Contexts/FormContext";
import PageBanner from "../../components/PageBanner";
import ProgressBar from "../../components/ProgressBar/ProgressBar";
import ReviewFormDialog from "../../components/Questionnaire/ReviewFormDialog";
import SubmitFormDialog from "../../components/Questionnaire/SubmitFormDialog";
import UnsavedChangesDialog from "../../components/Questionnaire/UnsavedChangesDialog";
import StatusBar from "../../components/StatusBar/StatusBar";
import StyledFormTooltip from "../../components/StyledFormComponents/StyledTooltip";
import SuspenseLoader from "../../components/SuspenseLoader";
import { hasPermission } from "../../config/AuthPermissions";
import map, { InitialSections } from "../../config/SectionConfig";
import useFormMode from "../../hooks/useFormMode";
import usePageTitle from "../../hooks/usePageTitle";
import { determineSectionStatus, Logger, sectionHasData } from "../../utils";

import Section from "./sections";

const StyledContainer = styled(Container)(() => ({
  "&.MuiContainer-root": {
    padding: 0,
    minHeight: "300px",
    scrollMarginTop: "-60px",
  },
}));

const StyledSidebar = styled(Stack)({
  position: "sticky",
  top: 0,
  marginTop: "90px",
});

const StyledDivider = styled(Divider)({
  height: "520px",
  width: "1px",
  borderRightWidth: "2px",
  borderRightColor: "#E8EAEE9",
  margin: "0 23px",
});

const StyledContentWrapper = styled(Stack)({
  paddingBottom: "75px",
});

const StyledContent = styled(Stack)({
  width: "100%",
  maxWidth: "980px",
  marginLeft: "41px",
});

const StyledControls = styled(Stack)({
  color: "#FFFFFF",
  marginTop: "15px !important",
  "& .MuiButton-root": {
    margin: "0 6px",
    padding: "10px 28px 10px !important",
    minWidth: "128px",
    fontSize: "16px",
    fontFamily: "'Nunito', 'Rubik', sans-serif",
    letterSpacing: "0.32px",
    lineHeight: "24px",
    borderRadius: "8px",
    textTransform: "none",
  },
  "& a": {
    color: "inherit",
    textDecoration: "none",
  },
  "& .MuiButton-startIcon": {
    marginRight: "20px",
    marginLeft: 0,
  },
  "& .MuiButton-endIcon": {
    marginRight: 0,
    marginLeft: "20px",
  },
  "& .MuiSvgIcon-root": {
    fontSize: "20px",
  },
});

const StyledLoadingButton = styled(LoadingButton)({
  "&.MuiButton-root": {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    minWidth: "128px",
    padding: "10px",
    fontFamily: "'Nunito', 'Rubik', sans-serif",
    fontSize: "16px",
    fontStyle: "normal",
    lineHeight: "24px",
    letterSpacing: "0.32px",
    "& .MuiSvgIcon-root": {
      fontSize: "20px",
    },
  },
});

const StyledExtendedLoadingButton = styled(StyledLoadingButton)({
  "&.MuiButton-root": {
    minWidth: "137px",
  },
});

const StyledTooltip = styled(StyledFormTooltip)({
  margin: "0 !important",
  "& .MuiTooltip-tooltip": {
    color: "#000000",
  },
});

const UncheckedIcon = styled("div")<{ readOnly?: boolean }>(({ readOnly }) => ({
  outline: "2px solid #1D91AB",
  outlineOffset: -2,
  width: "24px",
  height: "24px",
  backgroundColor: readOnly ? "#E5EEF4" : "initial",
  color: "#083A50",
  cursor: readOnly ? "not-allowed" : "pointer",
}));

const CheckedIcon = styled("div")<{ readOnly?: boolean }>(({ readOnly }) => ({
  backgroundImage: `url("${CheckboxCheckedIconSvg}")`,
  backgroundSize: "auto",
  backgroundRepeat: "no-repeat",
  width: "24px",
  height: "24px",
  backgroundColor: readOnly ? "#E5EEF4" : "initial",
  color: "#1D91AB",
  cursor: readOnly ? "not-allowed" : "pointer",
}));

const StyledCheckbox = styled(Checkbox)({
  "&.MuiCheckbox-root": {
    padding: "10px",
  },
  "& .MuiSvgIcon-root": {
    fontSize: "24px",
  },
  "&.Mui-disabled": {
    cursor: "not-allowed",
  },
});

const validateSection = (section: string): section is SectionKey =>
  typeof map[section] !== "undefined";

export type SaveForm =
  | { status: "success"; id: string }
  | { status: "failed"; errorMessage: string };

type Props = {
  section?: string;
};

/**
 * Intake Form View Component
 *
 * @param {Props} props
 * @returns {JSX.Element}
 */
const FormView: FC<Props> = ({ section }: Props) => {
  const navigate = useNavigate();
  const location = useLocation();

  const { enqueueSnackbar } = useSnackbar();
  const {
    status,
    data,
    setData,
    submitData,
    approveForm,
    inquireForm,
    rejectForm,
    reopenForm,
    error,
  } = useFormContext();
  const { user, status: authStatus } = useAuthContext();
  const { formMode, readOnlyInputs } = useFormMode();

  const [activeSection, setActiveSection] = useState<SectionKey>(
    validateSection(section) ? section : "A"
  );
  const [blockedNavigate, setBlockedNavigate] = useState<boolean>(false);
  const [openSubmitDialog, setOpenSubmitDialog] = useState<boolean>(false);
  const [openApproveDialog, setOpenApproveDialog] = useState<boolean>(false);
  const [openInquireDialog, setOpenInquireDialog] = useState<boolean>(false);
  const [openRejectDialog, setOpenRejectDialog] = useState<boolean>(false);
  const [pendingModelChange, setPendingModelChange] = useState<boolean>(false);
  const [pendingImageDeIdentification, setPendingImageDeIdentification] = useState<boolean>(false);
  const [allSectionsComplete, setAllSectionsComplete] = useState<boolean>(false);

  const sectionKeys = Object.keys(map);
  const sectionIndex = sectionKeys.indexOf(activeSection);
  const prevSection = sectionKeys[sectionIndex - 1]
    ? `/submission-request/${data?._id}/${sectionKeys[sectionIndex - 1]}`
    : null;
  const nextSection = sectionKeys[sectionIndex + 1]
    ? `/submission-request/${data?._id}/${sectionKeys[sectionIndex + 1]}`
    : null;
  const isSectionD = activeSection === "D";
  const formContentRef = useRef(null);
  const lastSectionRef = useRef(null);
  const hasReopenedFormRef = useRef(false);
  const bypassBlockerRef = useRef<boolean>(false);
  const previousIDRef = useRef<string | null>(null);
  const shouldShowToolTip = isSectionD && !allSectionsComplete;

  const refs: FormSectionProps["refs"] = {
    getFormObjectRef: useRef<(() => FormObject) | null>(null),
  };

  usePageTitle(`Submission Request ${data?._id && data?._id !== "new" ? `- ${data._id}` : ""}`);

  /**
   * Determines if the form has unsaved changes.
   *
   * @returns {boolean} true if the form has unsaved changes, false otherwise
   */
  const isDirty = (): boolean => {
    const { ref, data: newData } = refs.getFormObjectRef.current?.() || {};

    return ref && (!data || !isEqual(data.questionnaireData, newData));
  };

  const isAllSectionsComplete = (): boolean => {
    if (status === FormStatus.LOADING) {
      return false;
    }

    // form has not been created
    if (
      !data?.questionnaireData ||
      data?.questionnaireData?.sections?.length !== Object.keys(map).length - 1
    ) {
      return false;
    }

    return data?.questionnaireData?.sections?.every((section) => section.status === "Completed");
  };

  /**
   * submit the form data to the database.
   *
   * @returns {Promise<boolean>} true if the submit was successful, false otherwise
   */
  const submitForm = async (): Promise<string | boolean> => {
    const { ref, data: newData } = refs.getFormObjectRef.current?.() || {};

    if (!ref?.current || !newData) {
      return false;
    }

    try {
      const r = await submitData();
      setOpenSubmitDialog(false);
      navigate("/submission-requests");

      return r;
    } catch (err) {
      setOpenSubmitDialog(false);
      enqueueSnackbar("An error occurred while submitting the form. Please try again.", {
        variant: "error",
      });
      return false;
    }
  };

  /**
   * submit the approval comment from the form submission to the database.
   *
   * @returns {Promise<boolean>} true if the approval submission was successful, false otherwise
   */
  const submitApproveForm = async (reviewComment: string): Promise<string | boolean> => {
    if (formMode !== "Review") {
      return false;
    }
    const { ref, data: newData } = refs.getFormObjectRef.current?.() || {};

    if (!ref?.current || !newData) {
      return false;
    }

    const res = await approveForm(
      { reviewComment, pendingModelChange, pendingImageDeIdentification },
      true
    );
    setOpenApproveDialog(false);
    setPendingModelChange(false);
    setPendingImageDeIdentification(false);
    if (res?.status === "success") {
      navigate("/submission-requests");
    } else {
      enqueueSnackbar(
        res?.errorMessage || "An error occurred while approving the form. Please try again.",
        {
          variant: "error",
        }
      );
    }
    return res?.status === "success";
  };

  /**
   * submit the inquire comment from the form submission to the database.
   *
   *
   * @returns {Promise<boolean>} true if the inquire submission was successful, false otherwise
   */
  const submitInquireForm = async (reviewComment: string): Promise<string | boolean> => {
    if (formMode !== "Review") {
      return false;
    }
    const { ref, data: newData } = refs.getFormObjectRef.current?.() || {};

    if (!ref?.current || !newData) {
      return false;
    }

    const res = await inquireForm(reviewComment);
    if (!res) {
      enqueueSnackbar("An error occurred while inquiring the form. Please try again.", {
        variant: "error",
      });
    } else {
      navigate("/submission-requests");
    }
    setOpenInquireDialog(false);
    return res;
  };

  /**
   * submit the reject comment from the form submission to the database.
   *
   *
   * @returns {Promise<boolean>} true if the reject submission was successful, false otherwise
   */
  const submitRejectForm = async (reviewComment: string): Promise<string | boolean> => {
    if (formMode !== "Review") {
      return false;
    }
    const { ref, data: newData } = refs.getFormObjectRef.current?.() || {};

    if (!ref?.current || !newData) {
      return false;
    }

    const res = await rejectForm(reviewComment);
    if (!res) {
      enqueueSnackbar("An error occurred while rejecting the form. Please try again.", {
        variant: "error",
      });
    } else {
      navigate("/submission-requests");
    }
    setOpenRejectDialog(false);
    return res;
  };

  /**
   * Reopen the form when it has already been inquired
   * and the user wants to retry submission
   *
   *
   * @returns {Promise<boolean>} true if the review submit was successful, false otherwise
   */
  const handleReopenForm = async (): Promise<string | boolean> => {
    if (formMode !== "Edit") {
      return false;
    }
    const { ref, data: newData } = refs.getFormObjectRef.current?.() || {};

    if (!ref?.current || !newData) {
      return false;
    }

    const res = await reopenForm();
    if (!res) {
      navigate("/submission-requests", {
        state: {
          error: "An error occurred while marking the form as In Progress. Please try again.",
        },
      });
    }
    return res;
  };

  /**
   * Saves the form data to the database.
   *
   * NOTE:
   * - This function relies on HTML5 reportValidity() to
   *   validate the form section status.
   *
   * @returns {Promise<boolean>} true if the save was successful, false otherwise
   */
  const saveForm = async (): Promise<SaveForm> => {
    if (readOnlyInputs || formMode !== "Edit") {
      return {
        status: "failed",
        errorMessage: null,
      };
    }

    const { ref, data: newData } = refs.getFormObjectRef.current?.() || {};
    if (!ref?.current || !newData) {
      return {
        status: "failed",
        errorMessage: null,
      };
    }

    // Update section status
    if (newData?.sections?.length !== Object.keys(map).length - 1) {
      // Not including review section
      newData.sections = cloneDeep(InitialSections);
    }

    const newStatus: SectionStatus = determineSectionStatus(
      ref.current.checkValidity(),
      sectionHasData(activeSection, newData)
    );
    const currentSection: Section = newData.sections.find((s) => s.name === activeSection);
    if (currentSection) {
      currentSection.status = newStatus;
    } else {
      newData.sections.push({ name: activeSection, status: newStatus });
    }

    const saveResult = await setData(newData);
    if (saveResult?.status === "failed" && !!saveResult?.errorMessage) {
      enqueueSnackbar(`An error occurred while saving the ${map[activeSection].title} section.`, {
        variant: "error",
      });
    } else {
      enqueueSnackbar(
        `Your changes for the ${map[activeSection].title} section have been successfully saved.`,
        {
          variant: "success",
        }
      );
    }

    if (saveResult?.status === "success") {
      return {
        status: "success",
        id: saveResult.id,
      };
    }

    return {
      status: "failed",
      errorMessage: saveResult?.errorMessage,
    };
  };

  // Intercept React Router navigation actions with unsaved changes
  const blocker: Blocker = useBlocker(() => {
    // if unauthorized, skip blocker and redirect away
    if (
      formMode === "Unauthorized" &&
      status === FormStatus.LOADED &&
      authStatus === AuthStatus.LOADED
    ) {
      return false;
    }
    if (!isDirty() || readOnlyInputs || bypassBlockerRef.current) {
      return false;
    }

    // If there are no validation errors, save form data without a prompt
    const { ref } = refs.getFormObjectRef.current?.() || {};
    if (ref?.current?.checkValidity() === true) {
      saveForm();
      return false;
    }

    setBlockedNavigate(true);
    return true;
  });

  const isNavigationBlocked = useMemo<boolean>(() => blocker?.state === "blocked", [blocker]);

  const areSectionsValid = (): boolean => {
    if (status === FormStatus.LOADING) {
      return false;
    }

    const { ref, data: newData } = refs.getFormObjectRef.current?.() || {};

    if (!ref?.current || !newData) {
      return false;
    }

    const sectionsClone = cloneDeep(data?.questionnaireData?.sections);
    if (sectionsClone?.length !== Object.keys(map).length - 1) {
      // Not including review section
      return false;
    }

    const newStatus = ref.current.checkValidity() ? "Completed" : "In Progress";
    const currentSection: Section = sectionsClone.find((s) => s.name === activeSection);
    if (currentSection) {
      currentSection.status = newStatus;
    } else {
      sectionsClone.push({ name: activeSection, status: newStatus });
    }

    return sectionsClone?.every((section) => section.status === "Completed");
  };

  const saveAndNavigate = async (): Promise<void> => {
    // Wait for the save handler to complete
    const res = await saveForm();
    const reviewSectionUrl = `/submission-request/${data._id}/REVIEW`; // TODO: Update to dynamic url instead
    const isNavigatingToReviewSection = blocker?.location?.pathname === reviewSectionUrl;

    setBlockedNavigate(false);

    // if invalid data, then block navigation
    if (
      isNavigatingToReviewSection &&
      ((res?.status === "success" && !res?.id) || !areSectionsValid())
    ) {
      return;
    }

    blocker.proceed?.();
  };

  /**
   * Provides a discard handler for the Unsaved Changes dialog.
   * Will discard the form changes and then navigate to the blocked section.
   */
  const discardAndNavigate = (): void => {
    setBlockedNavigate(false);
    blocker.proceed?.();
  };

  const handleSubmitForm = () => {
    if (!hasPermission(user, "submission_request", "submit", data)) {
      Logger.error("Invalid request to submit Submission Request form.");
      return;
    }
    setOpenSubmitDialog(true);
  };

  const handleApproveForm = () => {
    if (formMode !== "Review") {
      return;
    }
    setOpenApproveDialog(true);
  };

  const handleInquireForm = () => {
    if (formMode !== "Review") {
      return;
    }
    setOpenInquireDialog(true);
  };

  const handleRejectForm = () => {
    if (formMode !== "Review") {
      return;
    }
    setOpenRejectDialog(true);
  };

  const handleCloseApproveFormDialog = () => {
    setOpenApproveDialog(false);
    setPendingModelChange(false);
    setPendingImageDeIdentification(false);
  };

  const handleCloseInquireFormDialog = () => {
    setOpenInquireDialog(false);
  };

  const handleCloseRejectFormDialog = () => {
    setOpenRejectDialog(false);
  };

  const handleBackClick = () => {
    if (status === FormStatus.SAVING || !prevSection) {
      return;
    }
    navigate(prevSection, { preventScrollReset: true });
  };

  const handleNextClick = () => {
    if (status === FormStatus.SAVING || !nextSection) {
      return;
    }
    if (isSectionD && !allSectionsComplete) {
      return;
    }
    navigate(nextSection, { preventScrollReset: true });
  };

  const handleOnCancel = useCallback(() => {
    bypassBlockerRef.current = true;
    enqueueSnackbar("Successfully canceled that Submission Request.", {
      variant: "success",
    });
    navigate("/submission-requests");
  }, [enqueueSnackbar, navigate]);

  useEffect(() => {
    const newSection = validateSection(section) ? section : "A";
    setActiveSection(newSection);
    lastSectionRef.current = newSection;
  }, [section]);

  // Intercept browser navigation actions (e.g. closing the tab) with unsaved changes
  useEffect(() => {
    const unloadHandler = (event: BeforeUnloadEvent) => {
      if (!isDirty() || bypassBlockerRef.current) {
        return;
      }

      // If there are no validation errors, save form data without a prompt
      const { ref } = refs.getFormObjectRef.current?.() || {};
      if (ref?.current?.checkValidity() === true) {
        saveForm();
        return;
      }

      event.preventDefault();
      event.returnValue = "You have unsaved form changes. Are you sure you want to leave?";
    };

    window.addEventListener("beforeunload", unloadHandler);

    return () => {
      window.removeEventListener("beforeunload", unloadHandler);
    };
  });

  useEffect(() => {
    const isComplete = isAllSectionsComplete();
    setAllSectionsComplete(isComplete);
  }, [status, data]);

  useEffect(() => {
    if (status !== FormStatus.LOADED && authStatus !== AuthStatus.LOADED) {
      return;
    }
    if (!hasReopenedFormRef.current && data?.status === "Inquired" && formMode === "Edit") {
      handleReopenForm();
      hasReopenedFormRef.current = true;
    }
  }, [status, authStatus, formMode, data?.status]);

  useEffect(() => {
    // Skip URL overwrite if the form isn't loaded, or the blocker is active
    if (!data || isNavigationBlocked) {
      return;
    }

    if (previousIDRef.current === "new" && data?._id !== "new") {
      Logger.info("Form created with new ID. Redirecting to new form URL.", { uuid: data._id });
      bypassBlockerRef.current = true;
      navigate(
        location.pathname.replace("/submission-request/new", `/submission-request/${data._id}`),
        { replace: true, preventScrollReset: true }
      );
      bypassBlockerRef.current = false;
    }

    previousIDRef.current = data._id;
  }, [data?._id, previousIDRef.current, isNavigationBlocked]);

  // Show loading spinner if the form is still loading
  if (status === FormStatus.LOADING || authStatus === AuthStatus.LOADING) {
    return <SuspenseLoader />;
  }

  // Hide form content if the user is unauthorized
  if (authStatus === AuthStatus.ERROR) {
    return null;
  }

  // Redirect to ListView if no data is found and the form is in the error state
  if (status === FormStatus.ERROR && !data?._id) {
    return <Navigate to="/submission-requests" state={{ error: error || "Unknown error" }} />;
  }

  return (
    <>
      <PageBanner
        title="Submission Request Form"
        subTitle="The following set of high-level questions are intended to provide insight to the CRDC, related to data storage, access, secondary sharing needs and other requirements of data submitters."
        bannerSrc={bannerPng}
      />

      <StyledContainer ref={formContentRef} maxWidth="xl">
        <StyledContentWrapper direction="row" justifyContent="center">
          <StyledSidebar direction="row" justifyContent="center" alignSelf="flex-start">
            <ProgressBar section={activeSection} />
            <StyledDivider orientation="vertical" />
          </StyledSidebar>

          <StyledContent direction="column" spacing={5}>
            <StatusBar />

            <Section section={activeSection} refs={refs} />

            <StyledControls direction="row" justifyContent="center" alignItems="center" spacing={2}>
              <StyledLoadingButton
                id="submission-form-back-button"
                variant="contained"
                color="info"
                type="button"
                disabled={status === FormStatus.SAVING || !prevSection}
                onClick={handleBackClick}
                size="large"
                startIcon={<ChevronLeft />}
              >
                Back
              </StyledLoadingButton>

              {activeSection === "REVIEW" &&
                hasPermission(user, "submission_request", "submit", data) && (
                  <StyledExtendedLoadingButton
                    id="submission-form-submit-button"
                    variant="contained"
                    color="primary"
                    type="submit"
                    size="large"
                    onClick={handleSubmitForm}
                  >
                    Submit
                  </StyledExtendedLoadingButton>
                )}
              {activeSection !== "REVIEW" && formMode === "Edit" && (
                <StyledLoadingButton
                  id="submission-form-save-button"
                  variant="contained"
                  color="success"
                  loading={status === FormStatus.SAVING}
                  onClick={saveForm}
                >
                  Save
                </StyledLoadingButton>
              )}

              <CancelApplicationButton onCancel={handleOnCancel} />

              {activeSection !== "REVIEW" && (
                <StyledTooltip
                  title={
                    shouldShowToolTip
                      ? "Click ‘Save’ to validate your answers. Once all pages are complete, you can proceed to the Review page to submit."
                      : ""
                  }
                  placement="top"
                  arrow
                  disableHoverListener={!shouldShowToolTip}
                >
                  <span>
                    <StyledLoadingButton
                      id="submission-form-next-button"
                      variant="contained"
                      color="info"
                      type="button"
                      onClick={handleNextClick}
                      disabled={status === FormStatus.SAVING || !nextSection || shouldShowToolTip}
                      size="large"
                      endIcon={<ChevronRight />}
                    >
                      Next
                    </StyledLoadingButton>
                  </span>
                </StyledTooltip>
              )}

              {activeSection === "REVIEW" && formMode === "Review" && (
                <>
                  <StyledExtendedLoadingButton
                    id="submission-form-approve-button"
                    variant="contained"
                    color="primary"
                    size="large"
                    onClick={handleApproveForm}
                  >
                    Approve
                  </StyledExtendedLoadingButton>
                  <StyledExtendedLoadingButton
                    id="submission-form-reject-button"
                    variant="contained"
                    color="error"
                    size="large"
                    onClick={handleRejectForm}
                  >
                    Reject
                  </StyledExtendedLoadingButton>
                  <StyledLoadingButton
                    id="submission-form-inquire-button"
                    variant="contained"
                    color="info"
                    size="large"
                    onClick={handleInquireForm}
                  >
                    Request Additional Information
                  </StyledLoadingButton>
                </>
              )}
            </StyledControls>
          </StyledContent>
        </StyledContentWrapper>
      </StyledContainer>

      <UnsavedChangesDialog
        open={blockedNavigate}
        onCancel={() => setBlockedNavigate(false)}
        onSave={saveAndNavigate}
        onDiscard={discardAndNavigate}
        disableActions={status === FormStatus.SAVING}
      />
      <SubmitFormDialog
        open={openSubmitDialog}
        onCancel={() => setOpenSubmitDialog(false)}
        onSubmit={submitForm}
        disableActions={status === FormStatus.SUBMITTING}
      />
      <ReviewFormDialog
        open={openApproveDialog}
        header="Approve Submission Request"
        confirmText="Confirm to Approve"
        confirmButtonProps={{ color: "success" }}
        onCancel={handleCloseApproveFormDialog}
        onSubmit={(reviewComment) => submitApproveForm(reviewComment)}
        loading={status === FormStatus.SUBMITTING}
      >
        <Stack direction="column">
          <FormControlLabel
            control={
              <StyledCheckbox
                checked={pendingModelChange}
                onChange={(e) => setPendingModelChange(e.target.checked)}
                checkedIcon={<CheckedIcon readOnly={status === FormStatus.SUBMITTING} />}
                icon={<UncheckedIcon readOnly={status === FormStatus.SUBMITTING} />}
                disabled={status === FormStatus.SUBMITTING}
                inputProps={
                  { "data-testid": "pendingModelChange-checkbox" } as CheckboxProps["inputProps"]
                }
              />
            }
            label="Require Data Model changes"
          />
          <FormControlLabel
            control={
              <StyledCheckbox
                checked={pendingImageDeIdentification}
                onChange={(e) => setPendingImageDeIdentification(e.target.checked)}
                checkedIcon={<CheckedIcon readOnly={status === FormStatus.SUBMITTING} />}
                icon={<UncheckedIcon readOnly={status === FormStatus.SUBMITTING} />}
                disabled={status === FormStatus.SUBMITTING}
                inputProps={
                  {
                    "data-testid": "pendingImageDeIdentification-checkbox",
                  } as CheckboxProps["inputProps"]
                }
              />
            }
            label="Require Risk Mitigation document & De-identification protocol"
          />
        </Stack>
      </ReviewFormDialog>
      <ReviewFormDialog
        open={openInquireDialog}
        header="Request Additional Changes"
        confirmText="Confirm to move to Inquired"
        onCancel={handleCloseInquireFormDialog}
        onSubmit={(reviewComment) => submitInquireForm(reviewComment)}
      />
      <ReviewFormDialog
        open={openRejectDialog}
        header="Reject Submission Request"
        confirmText="Confirm to Reject"
        onCancel={handleCloseRejectFormDialog}
        onSubmit={(reviewComment) => submitRejectForm(reviewComment)}
      />
    </>
  );
};

export default FormView;
