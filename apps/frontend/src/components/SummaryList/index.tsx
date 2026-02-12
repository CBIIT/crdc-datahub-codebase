import { styled, Typography } from "@mui/material";
import { isEqual } from "lodash";
import { memo, ReactNode } from "react";

import StyledTooltip from "../StyledFormComponents/StyledTooltip";

import TooltipList from "./TooltipList";

const StyledContainerTypography = styled(Typography)<{ component: React.ElementType }>({
  wordWrap: "break-word",
  maxWidth: "100%",
  fontSize: "inherit",
});

const StyledTypography = styled(Typography)<{ component: React.ElementType }>(() => ({
  textDecoration: "underline",
  cursor: "pointer",
  color: "#0B6CB1",
}));

export type Props<T> = {
  data: T[];
  emptyText?: string;
  getItemKey: (item: T) => string;
  renderItem: (item: T) => string | ReactNode;
  renderTooltipItem: (item: T) => string | ReactNode;
};

/**
 * A component which handles the display of the first data item
 * and displays the remaining list in a tooltip.
 *
 * @returns The formatted list of items.
 */
const SummaryList = <T,>({
  data,
  emptyText = "None.",
  getItemKey,
  renderItem,
  renderTooltipItem,
}: Props<T>): JSX.Element => {
  if (!data || !Array.isArray(data) || data.length === 0) {
    return <span>{emptyText}</span>;
  }

  return (
    <StyledContainerTypography component="span">
      {renderItem(data[0])}
      {data.length > 1 && (
        <>
          {" and "}
          <StyledTooltip
            title={
              <TooltipList
                data={data}
                getItemKey={getItemKey}
                renderTooltipItem={renderTooltipItem}
              />
            }
            placement="top"
            open={undefined}
            disableHoverListener={false}
            arrow
            dynamic
          >
            <StyledTypography component="span" data-testid="study-list-other-count">
              other {data.length - 1}
            </StyledTypography>
          </StyledTooltip>
        </>
      )}
    </StyledContainerTypography>
  );
};

type SummaryListComponent = <T>(props: Props<T>) => JSX.Element;

export default memo(SummaryList, isEqual) as SummaryListComponent;
