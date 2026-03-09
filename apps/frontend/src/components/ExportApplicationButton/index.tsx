import { useLazyQuery } from "@apollo/client";
import { Button, ButtonProps, Stack, styled, Typography } from "@mui/material";
import { isEqual } from "lodash";
import { memo, useState } from "react";

import ExportIconSvg from "@/assets/icons/export_icon.svg?react";
import { useFormContext } from "@/components/Contexts/FormContext";
import StyledFormTooltip from "@/components/StyledFormComponents/StyledTooltip";
import {
  LIST_INSTITUTIONS,
  LIST_ORGS,
  ListInstitutionsInput,
  ListInstitutionsResp,
  ListOrgsInput,
  ListOrgsResp,
} from "@/graphql";
import { downloadBlob, Logger } from "@/utils";

const StyledExportIcon = styled(ExportIconSvg)({
  width: "27px",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  marginRight: "16px",
  color: "currentColor",
});

const StyledText = styled(Typography)({
  fontFamily: "'Nunito Sans', 'Rubik', sans-serif",
  letterSpacing: "-0.25px",
  fontWeight: 600,
  fontSize: "16px",
  lineHeight: "150%",
  color: "inherit",
  paddingLeft: "14px",
});

const StyledStack = styled(Stack)({
  margin: "0 !important",
  width: "100%",
});

const StyledExportButton = styled(Button)({
  justifyContent: "flex-start",
  padding: "12px 14px",
  marginRight: "auto",
  color: "#136071",
  "&:hover": {
    color: "#00819E",
    background: "transparent",
  },
  "&.Mui-disabled": {
    color: "#BBBBBB",
    opacity: 1,
  },
  "& .MuiButton-startIcon": {
    marginRight: "0px !important",
  },
});

const StyledTooltip = styled(StyledFormTooltip)({
  marginLeft: "0 !important",
  "& .MuiTooltip-tooltip": {
    color: "#000000",
  },
});

type Props = Omit<ButtonProps, "onClick">;

/**
 * A button that exports the current Submission Request to an Excel file.
 *
 * @returns The ExportApplicationButton component.
 */
const ExportApplicationButton = ({ disabled, ...rest }: Props) => {
  const { data } = useFormContext();

  const [downloading, setDownloading] = useState<boolean>(false);
  const isDisabled = disabled || downloading;

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

  const onButtonClick = async () => {
    if (!data?.questionnaireData) {
      Logger.error("ExportTemplateButton: No questionnaire data found");
      return;
    }

    setDownloading(true);

    const { questionnaireData } = data || {};

    const { QuestionnaireExcelMiddleware } = await import("@/classes/QuestionnaireExcelMiddleware");

    const middleware = new QuestionnaireExcelMiddleware(questionnaireData, {
      application: data,
      getInstitutions,
      getPrograms: listOrgs,
    });
    const file = await middleware.serialize();

    downloadBlob(
      file,
      `CRDC_Submission_Request_${data.studyAbbreviation || ""}_v${data.version || ""}.xlsx`,
      "application/vnd.ms-excel"
    );

    setDownloading(false);
  };

  return (
    <StyledStack direction="row" alignItems="center" justifyContent="center">
      <StyledExportButton
        variant="text"
        onClick={onButtonClick}
        disabled={isDisabled}
        startIcon={<StyledExportIcon />}
        aria-label="Export application to Excel button"
        data-testid="export-application-excel-button"
        disableTouchRipple
        {...rest}
      >
        <StyledTooltip
          title="Export the Submission Request to Excel."
          placement="top"
          data-testid="export-application-excel-tooltip"
          disableInteractive
          arrow
        >
          <StyledText variant="body2" data-testid="export-application-excel-button-text">
            Export Form
          </StyledText>
        </StyledTooltip>
      </StyledExportButton>
    </StyledStack>
  );
};

export default memo<Props>(ExportApplicationButton, isEqual);
