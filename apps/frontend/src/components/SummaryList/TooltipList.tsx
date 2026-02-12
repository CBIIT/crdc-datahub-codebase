import { styled } from "@mui/material";
import { isEqual } from "lodash";
import { memo, ReactNode } from "react";

const StyledList = styled("ul")({
  paddingInlineStart: 16,
  marginBlockStart: 6,
  marginBlockEnd: 6,
});

const StyledListItem = styled("li")({
  "&:not(:last-child)": {
    marginBottom: 8,
  },
  fontSize: 14,
});

export type Props<T> = {
  data: T[];
  getItemKey?: (item: T) => string;
  renderTooltipItem?: (item: T) => string | ReactNode;
};

/**
 * TooltipList is a generic component that renders a styled list of items,
 * typically used for displaying a list within a tooltip.
 *
 * @template T - Type of data items.
 * @param {Props} props
 * @returns {JSX.Element} JSX.Element or null if data is empty.
 */
const TooltipList = <T,>({ data, getItemKey, renderTooltipItem }: Props<T>): JSX.Element => {
  if (!Array.isArray(data) || !data?.length) {
    return null;
  }

  return (
    <StyledList>
      {data?.map((item: T) => {
        const itemKey = getItemKey?.(item) ?? String(item);

        return (
          <StyledListItem key={itemKey} data-testid={itemKey}>
            {renderTooltipItem?.(item) ?? String(item)}
          </StyledListItem>
        );
      })}
    </StyledList>
  );
};

export default memo(TooltipList, isEqual) as <T>(props: Props<T>) => JSX.Element;
