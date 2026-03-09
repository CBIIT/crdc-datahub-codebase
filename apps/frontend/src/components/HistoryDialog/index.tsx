import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogProps,
  DialogTitle,
  Typography,
  styled,
} from "@mui/material";
import Grid from "@mui/material/Unstable_Grid2";
import React, { CSSProperties, memo, useCallback, useMemo } from "react";

import { FormatDate, SortHistory } from "../../utils";
import TruncatedText from "../TruncatedText";

const StyledDialog = styled(Dialog)({
  "& .MuiDialog-paper": {
    borderRadius: "8px",
    boxShadow: "0px 4px 45px 0px rgba(0, 0, 0, 0.40)",
    padding: "22px 24px 54px 24px",
    width: "567px !important",
    border: "2px solid #388DEE",
    background: "#264370",
  },
});

const StyledDialogTitle = styled(DialogTitle)({
  paddingBottom: "0",
});

const StyledPreTitle = styled("p")({
  color: "#D5DAE7",
  fontSize: "13px",
  lineHeight: "27px",
  letterSpacing: "0.5px",
  textTransform: "uppercase",
  margin: "0",
});

const StyledTitle = styled("p")({
  color: "#FFF",
  fontSize: "35px",
  fontFamily: "Nunito Sans",
  fontWeight: "900",
  lineHeight: "30px",
  margin: "0",
});

const StyledDialogContent = styled(DialogContent, { shouldForwardProp: (p) => p !== "headerRow" })<{
  headerRow: boolean;
}>(({ headerRow }) => ({
  "--border-bottom-width": "0.5px",
  marginTop: headerRow ? "53px" : "74px",
  marginBottom: "35px",
  paddingLeft: "37px",
  paddingRight: "37px",
  overflowY: "visible",
}));

const StyledIcon = styled("div")({
  position: "absolute",
  top: "50%",
  transform: "translateY(-50%)",
  lineHeight: "0",
  "& img": {
    WebkitUserDrag: "none",
  },
});

const StyledCloseButton = styled(Button)({
  minWidth: "137px",
  fontSize: "16px",
  fontWeight: "700",
  borderRadius: "8px",
  textTransform: "none",
  color: "#fff",
  borderColor: "#fff",
  margin: "0 auto",
  "&:hover": {
    borderColor: "#fff",
  },
});

const StyledHeaderRow = styled(Grid)({
  borderBottom: "var(--border-bottom-width) solid #375F9A",
  paddingBottom: "8px",
  marginBottom: "4px",
});

const StyledHeaderItem = styled(Typography)<React.CSSProperties>((styles) => ({
  fontFamily: "Public Sans",
  fontWeight: "300",
  fontSize: "8px",
  textAlign: "center",
  textTransform: "uppercase",
  color: "#9FB3D1",
  userSelect: "none",
  ...styles,
}));

const StyledEventRow = styled(Grid)({
  padding: "17px 0",
  borderBottom: "var(--border-bottom-width) solid #375F9A",
  alignItems: "center",
});

const BaseItemTypographyStyles: React.CSSProperties = {
  fontFamily: "Public Sans",
  fontWeight: "400",
  fontSize: "13px",
  letterSpacing: "0.0025em",
  userSelect: "none",
  whiteSpace: "nowrap",
};

const StyledEventItem = styled(Typography)<React.CSSProperties>(
  ({ textAlign = "center", color = "inherit" }) => ({
    ...BaseItemTypographyStyles,
    textAlign,
    color,
  })
);

const DotContainer = styled("div")({
  position: "relative",
  width: "100%",
  height: "100%",
  zIndex: 999,
});

const VerticalDot = styled("div")({
  position: "absolute",
  top: "50%",
  left: "0px",
  transform: "translateY(-50%)",
  content: '""',
  width: "16px",
  height: "16px",
  borderRadius: "50%",
  background: "white",
});

const TopConnector = styled("div")({
  content: '""',
  position: "absolute",
  left: "5px",
  bottom: "0",
  width: "6px",
  height: "calc(27px + var(--border-bottom-width) / 2)",
  background: "white",
});

const BottomConnector = styled("div")({
  content: '""',
  position: "absolute",
  left: "5px",
  top: "0",
  width: "6px",
  height: "calc(27px + var(--border-bottom-width) / 2)",
  background: "white",
});

const HorizontalLine = styled("div")({
  // Primary horizontal line
  position: "absolute",
  top: "50%",
  left: "0px",
  transform: "translateY(-50%)",
  content: '""',
  width: "68px",
  height: "1px",
  background: "white",
  // End dot adornment
  "&::after": {
    content: '""',
    position: "absolute",
    top: "50%",
    right: "0px",
    transform: "translateY(-50%)",
    width: "5px",
    height: "5px",
    borderRadius: "50%",
    background: "white",
  },
});

type EventItem = {
  color: string;
  icon: string | null;
  status: string;
  StatusWrapper: React.FC<{ children: React.ReactNode }>;
  date: string;
  nameColor: string;
  name: string | null;
};

export type IconType<T extends string> = Record<T, string>;

type Props<T extends string> = {
  /**
   * The prefix to show before the dialog title
   */
  preTitle: string;
  /**
   * The title of the dialog
   */
  title: string;
  /**
   * The history items to display
   *
   * @see {@link HistoryBase}
   */
  history: HistoryBase<T>[];
  /**
   * A map of icons to display for each status
   *
   * @note If iconMap[status] is undefined, no icon will be displayed
   */
  iconMap: IconType<T>;
  /**
   * Boolean indicator of whether to render the headers of each column
   */
  showHeaders?: boolean;
  /**
   * A function to determine the text color of the status
   */
  getTextColor: (status: T) => CSSProperties["color"];
  /**
   * A function to determine if (and what) should wrap around the status display
   */
  getStatusWrapper?: (status: T) => React.FC<{ children: React.ReactNode }>;
  /**
   * A function to call when the dialog is requested to close by an event,
   * e.g. Close button click, backdrop click, or escape key press
   */
  onClose: () => void;
} & DialogProps;

/**
 * A generic history dialog component that displays a list of history transitions.
 *
 * @returns {JSX.Element} The history dialog component
 */
const HistoryDialog = <T extends string>({
  preTitle,
  title,
  history,
  iconMap,
  open,
  showHeaders = true,
  getTextColor,
  getStatusWrapper,
  onClose,
  ...rest
}: Props<T>): JSX.Element => {
  const getColor = useCallback(
    (status: T) => {
      if (typeof getTextColor === "function") {
        return getTextColor(status);
      }

      return "#FFF";
    },
    [getTextColor]
  );

  const getWrapper = useCallback(
    (status: T): React.FC<{ children: React.ReactNode }> => {
      if (typeof getStatusWrapper === "function") {
        return getStatusWrapper(status);
      }

      return ({ children }) => <span>{children}</span>;
    },
    [getStatusWrapper]
  );

  const events = useMemo<EventItem[]>(() => {
    const result: EventItem[] = [];
    const sorted = SortHistory(history);

    sorted.forEach((item, index) => {
      const { status, dateTime, ...others } = item;

      result.push({
        color: getColor(status),
        icon: index === 0 && iconMap[status] ? iconMap[status] : null,
        status: status || "",
        StatusWrapper: getWrapper(status),
        date: dateTime,
        name: "userName" in others ? others.userName : null,
        nameColor: index === 0 ? getColor(status) : "#97B5CE",
      });
    });

    return result;
  }, [history, iconMap, getColor, getWrapper]);

  const eventHasNames: boolean = useMemo<boolean>(
    () => events.some((event) => event.name !== null),
    [events]
  );

  return (
    <StyledDialog
      open={open}
      onClose={onClose}
      scroll="body"
      data-testid="history-dialog"
      {...rest}
    >
      <StyledDialogTitle>
        <StyledPreTitle>{preTitle}</StyledPreTitle>
        <StyledTitle>{title}</StyledTitle>
      </StyledDialogTitle>
      <StyledDialogContent headerRow={showHeaders}>
        {showHeaders && (
          <StyledHeaderRow container columnSpacing={3} data-testid="history-dialog-header-row">
            {/* Spacing for the DotContainer */}
            <Grid xs={2} />
            <Grid xs={3}>
              <StyledHeaderItem textAlign="left" paddingLeft="12px">
                Status
              </StyledHeaderItem>
            </Grid>
            <Grid xs={3}>
              <StyledHeaderItem>Date</StyledHeaderItem>
            </Grid>
            {eventHasNames && (
              <Grid xs={3}>
                <StyledHeaderItem>User</StyledHeaderItem>
              </Grid>
            )}
            <Grid xs={1} />
          </StyledHeaderRow>
        )}
        {events?.map(({ status, StatusWrapper, date, color, name, nameColor, icon }, index) => (
          <StyledEventRow
            container
            key={`history-event-${date}`}
            data-testid={`history-item-${index}`}
            columnSpacing={3}
          >
            {!eventHasNames && <Grid xs={1.5} />}
            <Grid xs={2}>
              <DotContainer>
                {index !== 0 && <TopConnector />}
                <VerticalDot />
                <HorizontalLine />
                {index !== events.length - 1 && <BottomConnector />}
              </DotContainer>
            </Grid>
            <Grid xs={3}>
              <div style={{ width: "fit-content" }}>
                <StatusWrapper>
                  <StyledEventItem
                    color={color}
                    textAlign="left"
                    data-testid={`history-item-${index}-status`}
                  >
                    {status?.toUpperCase()}
                  </StyledEventItem>
                </StatusWrapper>
              </div>
            </Grid>
            <Grid xs={3}>
              <StyledEventItem
                color={color}
                title={date}
                data-testid={`history-item-${index}-date`}
              >
                {FormatDate(date, "M/D/YYYY", "N/A")}
              </StyledEventItem>
            </Grid>
            {eventHasNames && (
              <Grid xs={3} data-testid={`history-item-${index}-name`}>
                <StyledEventItem>
                  <TruncatedText
                    text={name}
                    maxCharacters={14}
                    wrapperSx={{
                      ...BaseItemTypographyStyles,
                      margin: "0 auto",
                      color: nameColor,
                    }}
                  />
                </StyledEventItem>
              </Grid>
            )}
            <Grid
              xs={1}
              sx={{
                position: "relative",
                marginLeft: eventHasNames ? "0" : "auto",
                marginRight: eventHasNames ? "0" : "24px",
              }}
            >
              {icon && (
                <StyledIcon>
                  <img
                    src={icon}
                    alt={`${status} icon`}
                    data-testid={`history-item-${index}-icon`}
                  />
                </StyledIcon>
              )}
            </Grid>
          </StyledEventRow>
        ))}
      </StyledDialogContent>
      <DialogActions>
        <StyledCloseButton
          onClick={onClose}
          variant="outlined"
          size="large"
          color="info"
          data-testid="history-dialog-close"
        >
          Close
        </StyledCloseButton>
      </DialogActions>
    </StyledDialog>
  );
};

export default memo(HistoryDialog) as typeof HistoryDialog;
