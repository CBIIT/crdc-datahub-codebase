import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  styled,
} from "@mui/material";
import Grid from "@mui/material/Unstable_Grid2";

import CloseIconSvg from "@/assets/icons/close_icon.svg?react";
import { FormatDate } from "@/utils";

const StyledDialog = styled(Dialog, {
  shouldForwardProp: (prop) => prop !== "status" && prop !== "accentColor",
})<{
  status: unknown;
  accentColor: string;
}>(({ accentColor }) => ({
  "& .MuiDialog-paper": {
    borderRadius: "8px",
    border: "2px solid",
    borderColor: accentColor,
    background: "linear-gradient(0deg, #F2F6FA 0%, #F2F6FA 100%), #2E4D7B",
    boxShadow: "0px 4px 45px 0px rgba(0, 0, 0, 0.40)",
    padding: "22px 24px 24px 24px",
    width: "567px !important",
  },
}));

const StyledCloseDialogButton = styled(IconButton)(() => ({
  position: "absolute",
  right: "21px",
  top: "11px",
  padding: "10px",
  "& svg": {
    color: "#44627C",
  },
}));

const StyledDialogTitle = styled(DialogTitle)({
  paddingBottom: "0",
});

const StyledPreTitle = styled("p")({
  color: "#929292",
  fontSize: "13px",
  fontFamily: "Nunito Sans",
  lineHeight: "27px",
  letterSpacing: "0.5px",
  textTransform: "uppercase",
  margin: "0",
});

const StyledTitle = styled("p", {
  shouldForwardProp: (prop) => prop !== "accentColor",
})<{ accentColor: string }>(({ accentColor }) => ({
  color: accentColor,
  fontSize: "35px",
  fontFamily: "Nunito Sans",
  fontWeight: "900",
  lineHeight: "30px",
  margin: "0",
}));

const StyledDialogContent = styled(DialogContent)({
  "--border-bottom-width": "0.5px",
  marginTop: "53px",
  marginBottom: "35px",
  paddingLeft: "37px",
  paddingRight: "37px",
  overflowY: "visible",
});

const StyledEventRow = styled(Grid)({
  padding: "10px 0",
  borderBottom: "var(--border-bottom-width) solid #D7DEE6",
  alignItems: "center",
});

const DotContainer = styled("div")({
  position: "relative",
  width: "100%",
  minHeight: "34px",
  zIndex: 999,
});

const VerticalDot = styled("div", {
  shouldForwardProp: (prop) => prop !== "accentColor",
})<{ accentColor: string }>(({ accentColor }) => ({
  position: "absolute",
  top: "50%",
  left: "0px",
  transform: "translateY(-50%)",
  width: "16px",
  height: "16px",
  borderRadius: "50%",
  background: accentColor,
}));

const TopConnector = styled("div", {
  shouldForwardProp: (prop) => prop !== "accentColor",
})<{ accentColor: string }>(({ accentColor }) => ({
  content: '""',
  position: "absolute",
  left: "5px",
  bottom: "50%",
  width: "6px",
  height: "calc(27px + var(--border-bottom-width) / 2)",
  background: accentColor,
}));

const BottomConnector = styled("div", {
  shouldForwardProp: (prop) => prop !== "accentColor",
})<{ accentColor: string }>(({ accentColor }) => ({
  content: '""',
  position: "absolute",
  left: "5px",
  top: "50%",
  width: "6px",
  height: "calc(27px + var(--border-bottom-width) / 2)",
  background: accentColor,
}));

const HorizontalLine = styled("div", {
  shouldForwardProp: (prop) => prop !== "accentColor",
})<{ accentColor: string }>(({ accentColor }) => ({
  position: "absolute",
  top: "50%",
  left: "0px",
  transform: "translateY(-50%)",
  width: "68px",
  height: "1px",
  background: accentColor,
  "&::after": {
    content: '""',
    position: "absolute",
    top: "50%",
    right: "0px",
    transform: "translateY(-50%)",
    width: "5px",
    height: "5px",
    borderRadius: "50%",
    background: accentColor,
  },
}));

const StyledEventCell = styled("p")({
  color: "#212121",
  fontSize: "13px",
  fontFamily: "Public Sans",
  fontWeight: "400",
  letterSpacing: "0.0025em",
  lineHeight: "1.4",
  margin: "0",
  textAlign: "center",
  whiteSpace: "nowrap",
});

const StyledViewButton = styled(Button, {
  shouldForwardProp: (prop) =>
    prop !== "accentColor" && prop !== "buttonBorderColor" && prop !== "buttonHoverBackground",
})<{ accentColor: string; buttonBorderColor: string; buttonHoverBackground: string }>(
  ({ accentColor, buttonBorderColor, buttonHoverBackground }) => ({
    minWidth: "72px",
    borderRadius: "9px",
    borderColor: buttonBorderColor,
    color: accentColor,
    fontFamily: "Nunito Sans",
    fontSize: "16px",
    fontWeight: "700",
    letterSpacing: "0.32px",
    lineHeight: "1.2",
    textTransform: "none",
    "&:hover": {
      borderColor: buttonBorderColor,
      backgroundColor: buttonHoverBackground,
    },
  })
);

const StyledFooter = styled(DialogActions)({
  justifyContent: "center",
  paddingTop: "8px",
});

const StyledCloseButton = styled(Button)({
  minWidth: "137px",
  padding: "10px",
  fontFamily: "Nunito Sans",
  fontSize: "16px",
  lineHeight: "24px",
  letterSpacing: "0.32px",
  textTransform: "none",
});

type Props<T> = {
  open: boolean;
  status?: ApplicationStatus;
  preTitle: string;
  title?: string;
  events: HistoryBase<T>[];
  onClose: () => void;
  onView: (event: HistoryBase<T>) => void;
};

type ReviewCommentsListColorScheme = {
  color: string;
  buttonBorderColor: string;
  buttonHoverBackground: string;
};

const getColorScheme = (status: ApplicationStatus): ReviewCommentsListColorScheme => {
  switch (status) {
    case "Approved":
      return {
        color: "#0D6E87",
        buttonBorderColor: "#A9D3DD",
        buttonHoverBackground: "#EDF8FB",
      };
    case "Rejected":
      return {
        color: "#E25C22",
        buttonBorderColor: "#E8B9A8",
        buttonHoverBackground: "#FFF7F4",
      };
    default:
      return {
        color: "#0D6E87",
        buttonBorderColor: "#A9D3DD",
        buttonHoverBackground: "#EDF8FB",
      };
  }
};

const ReviewCommentsListDialog = <T,>({
  open,
  status,
  preTitle,
  title = "Review Comments",
  events,
  onClose,
  onView,
}: Props<T>) => {
  const colorScheme = status ? getColorScheme(status) : getColorScheme("Rejected");
  const accentColor = colorScheme.color;

  return (
    <StyledDialog
      open={open}
      onClose={onClose}
      maxWidth={false}
      data-testid="comments-dialog"
      status={status}
      accentColor={accentColor}
    >
      <StyledCloseDialogButton
        onClick={onClose}
        aria-label="Close review comments list"
        data-testid="comments-dialog-close-icon-button"
      >
        <CloseIconSvg />
      </StyledCloseDialogButton>
      <StyledDialogTitle>
        <StyledPreTitle>{preTitle}</StyledPreTitle>
        <StyledTitle accentColor={accentColor}>{title}</StyledTitle>
      </StyledDialogTitle>
      <StyledDialogContent>
        {events.map((event, index) => (
          <StyledEventRow
            container
            columnSpacing={3}
            key={`comment-event-${event.dateTime}`}
            data-testid={`review-comment-${index}`}
          >
            <Grid xs={2}>
              <DotContainer>
                {index !== 0 && <TopConnector accentColor={accentColor} />}
                <VerticalDot accentColor={accentColor} />
                <HorizontalLine accentColor={accentColor} />
                {index !== events.length - 1 && <BottomConnector accentColor={accentColor} />}
              </DotContainer>
            </Grid>
            <Grid xs={3}>
              <StyledEventCell title={event.dateTime} data-testid={`review-comment-${index}-date`}>
                {FormatDate(event.dateTime, "M/D/YYYY", "N/A")}
              </StyledEventCell>
            </Grid>
            <Grid xs={3}>
              <StyledEventCell data-testid={`review-comment-${index}-time`}>
                {FormatDate(event.dateTime, "h:mm A", "N/A")}
              </StyledEventCell>
            </Grid>
            <Grid xs={4} sx={{ display: "flex", justifyContent: "center" }}>
              <StyledViewButton
                variant="outlined"
                color="info"
                accentColor={accentColor}
                buttonBorderColor={colorScheme.buttonBorderColor}
                buttonHoverBackground={colorScheme.buttonHoverBackground}
                onClick={() => onView(event)}
                data-testid={`review-comment-${index}-view`}
              >
                View
              </StyledViewButton>
            </Grid>
          </StyledEventRow>
        ))}
      </StyledDialogContent>
      <StyledFooter>
        <StyledCloseButton
          id="close-review-comments-list-button"
          onClick={onClose}
          variant="contained"
          color="info"
          aria-label="Close dialog"
          data-testid="comments-dialog-close"
        >
          Close
        </StyledCloseButton>
      </StyledFooter>
    </StyledDialog>
  );
};

export default ReviewCommentsListDialog;
