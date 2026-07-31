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

const StyledDialog = styled(Dialog)({
  "& .MuiDialog-paper": {
    borderRadius: "8px",
    border: "2px solid",
    borderColor: "#13B9DD",
    background: "linear-gradient(0deg, #F2F6FA 0%, #F2F6FA 100%), #2E4D7B",
    boxShadow: "0px 4px 45px 0px rgba(0, 0, 0, 0.40)",
    padding: "22px 24px 24px 24px",
    width: "567px !important",
  },
});

const StyledCloseDialogButton = styled(IconButton)({
  position: "absolute",
  right: "21px",
  top: "11px",
  padding: "10px",
  "& svg": {
    color: "#44627C",
  },
});

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

const StyledTitle = styled("p")({
  color: "#4B5368",
  fontSize: "35px",
  fontFamily: "Nunito Sans",
  fontWeight: "900",
  lineHeight: "30px",
  margin: "0",
});

const StyledDialogContent = styled(DialogContent)({
  "--border-bottom-width": "0.5px",
  marginTop: "53px",
  marginBottom: "35px",
  paddingLeft: "37px",
  paddingRight: "37px",
  overflowY: "visible",
});

const StyledEventRow = styled(Grid)({
  padding: "10px 40px",
  borderBottom: "var(--border-bottom-width) solid #A5AEBB",
  alignItems: "center",
});

const DotContainer = styled("div")({
  position: "relative",
  width: "100%",
  minHeight: "34px",
  zIndex: 999,
});

const VerticalDot = styled("div")({
  position: "absolute",
  top: "50%",
  left: "0px",
  transform: "translateY(-50%)",
  width: "16px",
  height: "16px",
  borderRadius: "50%",
  background: "#7E969C",
});

const TopConnector = styled("div")({
  content: '""',
  position: "absolute",
  left: "5px",
  bottom: "50%",
  width: "6px",
  height: "calc(27px + var(--border-bottom-width) / 2)",
  background: "#7E969C",
});

const BottomConnector = styled("div")({
  content: '""',
  position: "absolute",
  left: "5px",
  top: "50%",
  width: "6px",
  height: "calc(27px + var(--border-bottom-width) / 2)",
  background: "#7E969C",
});

const HorizontalLine = styled("div")({
  position: "absolute",
  top: "50%",
  left: "0px",
  transform: "translateY(-50%)",
  width: "68px",
  height: "1px",
  background: "#7E969C",
  "&::after": {
    content: '""',
    position: "absolute",
    top: "50%",
    right: "0px",
    transform: "translateY(-50%)",
    width: "5px",
    height: "5px",
    borderRadius: "50%",
    background: "#7E969C",
  },
});

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

const StyledViewButton = styled(Button)({
  width: "63px",
  borderRadius: "9px",
  borderColor: "#AEBBC5",
  borderWidth: "2px !important",
  background: "#fff",
  color: "#5A676A",
  fontFamily: "Nunito Sans",
  fontSize: "16px",
  fontWeight: "700",
  letterSpacing: "0.32px",
  lineHeight: "1.2",
  textTransform: "none",
  "&:hover": {
    borderColor: "#AEBBC5",
    backgroundColor: "#E6F0F3",
  },
});

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
  background: "#fff",
});

type Props<T> = {
  open: boolean;
  preTitle: string;
  title?: string;
  events: HistoryBase<T>[];
  onClose: () => void;
  onView: (event: HistoryBase<T>) => void;
};

const ReviewCommentsListDialog = <T,>({
  open,
  preTitle,
  title = "Review Comments",
  events,
  onClose,
  onView,
}: Props<T>) => (
  <StyledDialog
    open={open}
    onClose={onClose}
    maxWidth={false}
    data-testid="comments-dialog"
    TransitionProps={{ timeout: 0 }}
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
      <StyledTitle>{title}</StyledTitle>
    </StyledDialogTitle>
    <StyledDialogContent>
      {events.map((event, index) => (
        <StyledEventRow
          container
          key={`comment-event-${event.dateTime}`}
          data-testid={`comments-item-${index}`}
        >
          <Grid xs={3}>
            <DotContainer>
              {index !== 0 && <TopConnector />}
              <VerticalDot />
              <HorizontalLine />
              {index !== events.length - 1 && <BottomConnector />}
            </DotContainer>
          </Grid>
          <Grid xs={3}>
            <StyledEventCell title={event.dateTime} data-testid={`comments-item-${index}-date`}>
              {FormatDate(event.dateTime, "M/D/YYYY", "N/A")}
            </StyledEventCell>
          </Grid>
          <Grid xs={3}>
            <StyledEventCell data-testid={`comments-item-${index}-time`}>
              {FormatDate(event.dateTime, "h:mm A", "N/A")}
            </StyledEventCell>
          </Grid>
          <Grid xs={3} sx={{ display: "flex", justifyContent: "center" }}>
            <StyledViewButton
              variant="outlined"
              color="info"
              onClick={() => onView(event)}
              data-testid={`comments-item-${index}-view`}
            >
              View
            </StyledViewButton>
          </Grid>
        </StyledEventRow>
      ))}
    </StyledDialogContent>
    <StyledFooter>
      <StyledCloseButton
        id="close-comments-button"
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

export default ReviewCommentsListDialog;
