import { useLazyQuery } from "@apollo/client";
import { Button, ButtonProps, styled } from "@mui/material";
import dayjs from "dayjs";
import { useSnackbar } from "notistack";
import { memo, useState } from "react";

import DownloadIcon from "@/assets/icons/download_icon_filled.svg?react";
import StyledFormTooltip from "@/components/StyledFormComponents/StyledTooltip";
import {
  ListInstitutionsResp,
  ListInstitutionsInput,
  LIST_INSTITUTIONS,
  GET_APPLICATION_FORM_VERSION,
  GetApplicationFormVersionResp,
  ListOrgsResp,
  ListOrgsInput,
  LIST_ORGS,
} from "@/graphql";
import { downloadBlob, Logger } from "@/utils";

const StyledTooltip = styled(StyledFormTooltip)({
  marginLeft: "0 !important",
  "& .MuiTooltip-tooltip": {
    color: "#000000",
  },
});

const StyledButton = styled(Button)({
  color: "#156071",
  fontSize: "16px",
  fontWeight: 600,
  "& .MuiButton-endIcon": {
    marginLeft: "10px",
  },
});

type Props = Omit<ButtonProps, "onClick">;

/**
 * A button that exports a Excel template for the Submission Request form.
 *
 * @returns The ExportTemplateButton component.
 */
const ExportTemplateButton = ({ disabled, ...rest }: Props) => {
  const { enqueueSnackbar } = useSnackbar();

  const [downloading, setDownloading] = useState<boolean>(false);

  const [getInstitutions] = useLazyQuery<ListInstitutionsResp, ListInstitutionsInput>(
    LIST_INSTITUTIONS,
    {
      variables: { status: "Active", first: -1, orderBy: "name", sortDirection: "asc" },
      context: { clientName: "backend" },
      fetchPolicy: "cache-first",
      onError: (e) => Logger.error("ExportTemplateButton: listInstitutions API error:", e),
    }
  );

  const [listOrgs] = useLazyQuery<ListOrgsResp, ListOrgsInput>(LIST_ORGS, {
    context: { clientName: "backend" },
    variables: { status: "All", first: -1, orderBy: "name", sortDirection: "asc" },
    fetchPolicy: "cache-first",
    onError: (e) => Logger.error("ExportTemplateButton: listOrgs API error:", e),
  });

  const [retrieveFormVersion] = useLazyQuery<GetApplicationFormVersionResp>(
    GET_APPLICATION_FORM_VERSION,
    {
      context: { clientName: "backend" },
      fetchPolicy: "cache-first",
      onError: (e) => Logger.error("ExportTemplateButton: getFormVersion API error:", e),
    }
  );

  const onButtonClick = async () => {
    setDownloading(true);
    try {
      const { QuestionnaireExcelMiddleware } = await import(
        "@/classes/QuestionnaireExcelMiddleware"
      );

      const { data } = await retrieveFormVersion();
      const { getApplicationFormVersion: { version } = {} } = data || {};
      const formattedDate = dayjs().format("MMDDYYYY");

      if (!version || typeof version !== "string") {
        throw new Error("Invalid form version data received");
      }

      const middleware = new QuestionnaireExcelMiddleware(null, {
        getInstitutions,
        getPrograms: listOrgs,
      });
      const file = await middleware.serialize();
      const filename = `CRDC_Submission_Request_Template_v${version}_${formattedDate}.xlsx`;

      downloadBlob(file, filename, "application/vnd.ms-excel");
    } catch (error) {
      Logger.error("ExportTemplateButton: Error downloading template", error);
      enqueueSnackbar("Oops! Unable to generate the template. Please try again later.", {
        variant: "error",
      });
    } finally {
      setDownloading(false);
    }
  };

  return (
    <StyledTooltip
      title="Download the Submission Request Excel Template."
      placement="top"
      data-testid="export-application-excel-template-tooltip"
      disableInteractive
      arrow
    >
      <span>
        <StyledButton
          variant="text"
          type="button"
          size="large"
          onClick={onButtonClick}
          disabled={disabled || downloading}
          aria-label="Export application to Excel button"
          data-testid="export-application-excel-template-button"
          endIcon={<DownloadIcon />}
          {...rest}
        >
          Download Template
        </StyledButton>
      </span>
    </StyledTooltip>
  );
};

export default memo<Props>(ExportTemplateButton);
