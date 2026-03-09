import { useMutation } from "@apollo/client";
import { LoadingButton } from "@mui/lab";
import { ButtonProps, styled } from "@mui/material";
import { FC, memo, useCallback, useState } from "react";

import { hasPermission } from "../../config/AuthPermissions";
import { SaveAppResp, SaveAppInput, SAVE_APP } from "../../graphql";
import { Logger } from "../../utils";
import { useAuthContext } from "../Contexts/AuthContext";
import BaseDialog from "../DeleteDialog";
import BaseBodyText from "../StyledDialogComponents/StyledBodyText";

const StyledButton = styled(LoadingButton)({
  padding: "14px 20px",
  fontWeight: 700,
  fontSize: "16px",
  lineHeight: "20.14px",
  borderRadius: "8px",
  color: "#fff",
  textTransform: "none",
  borderColor: "#26B893 !important",
  background: "#1B8369 !important",
});

const StyledBodyText = styled(BaseBodyText)({
  marginBottom: "unset !important",
});

export type CreateApplicationButtonProps = {
  /**
   * An optional callback function that is called when the Submission Request is created.
   *
   * If successful, the ID of the created Submission Request is passed as an argument.
   */
  onCreate?: (_id: string | null) => void;
} & Omit<ButtonProps, "onClick" | "loading" | "type">;

/**
 * A component that handles the creation of a new Submission Request.
 * It provides a button that, when clicked, opens a dialog for confirmation.
 *
 * @returns The CreateApplicationButton component.
 */
const CreateApplicationButton: FC<CreateApplicationButtonProps> = ({
  onCreate,
  ...buttonProps
}) => {
  const { user } = useAuthContext();

  const [creating, setCreating] = useState<boolean>(false);
  const [dialogOpen, setDialogOpen] = useState<boolean>(false);

  const [saveApp] = useMutation<SaveAppResp, SaveAppInput>(SAVE_APP, {
    context: { clientName: "backend" },
    fetchPolicy: "no-cache",
  });

  const handleCreate = useCallback(async () => {
    try {
      setCreating(true);
      const { data, errors } = await saveApp({
        variables: {
          application: {
            _id: undefined,
            studyName: "",
            studyAbbreviation: "",
            questionnaireData: "{}",
            controlledAccess: false,
            openAccess: false,
            ORCID: "",
            PI: "",
            programName: "",
            programAbbreviation: "",
            programDescription: "",
            newInstitutions: [],
            GPAName: "",
          },
          status: "New",
        },
      });

      if (!data?.saveApplication?._id || errors) {
        throw new Error(errors?.[0]?.message || "Failed to create submission request");
      }

      onCreate?.(data.saveApplication._id);
    } catch (error) {
      Logger.error("Error creating submission request", error);
      onCreate?.(null);
    } finally {
      setCreating(false);
    }
  }, [onCreate, saveApp, setCreating]);

  const handleClick = useCallback(() => {
    setDialogOpen(true);
  }, [setDialogOpen]);

  if (!hasPermission(user, "submission_request", "create")) {
    return null;
  }

  return (
    <>
      <StyledButton
        type="button"
        data-testid="create-application-button"
        onClick={handleClick}
        loading={creating}
        {...buttonProps}
      >
        Start a Submission Request
      </StyledButton>
      <BaseDialog
        scroll="body"
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        header={null}
        description={
          <StyledBodyText>
            For all NIH-funded data, the PI/research team must have the appropriate authority to
            submit data to the CRDC. The research team must ensure the submitted information is in
            accord with the original study consent, all applicable laws, regulations, and
            institutional policies. CRDC is not able to help interpret consent forms. If there are
            any questions about appropriate permissions to submit, the research team should consult
            with their Institutional Review Board (IRB) to validate the authority to submit.
          </StyledBodyText>
        }
        confirmText="I Read and Accept"
        onConfirm={handleCreate}
        confirmButtonProps={{
          disabled: creating,
          color: "success",
          sx: {
            "&.MuiButton-root": {
              width: "128px",
              minWidth: "unset",
              lineHeight: "16px",
              padding: "6px 0",
            },
          },
        }}
        aria-labelledby="dialog-description"
      />
    </>
  );
};

export default memo<CreateApplicationButtonProps>(CreateApplicationButton);
