import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import { IconButton, Stack, styled } from "@mui/material";
import React, { ReactNode, useState } from "react";

import TableColumnsIcon from "../../assets/icons/table_columns_icon.svg?react";
import Tooltip from "../Tooltip";

import ColumnVisibilityPopper, {
  ColumnVisibilityPopperProps,
  ExtendedColumn,
} from "./ColumnVisibilityPopper";

const StyledIconButton = styled(IconButton)({
  padding: 0,
  paddingLeft: "3px",
});

const StyledExpandMoreIcon = styled(ExpandMoreIcon)({
  color: "#000",
  fontSize: "18px",
  alignSelf: "flex-end",
});

const StyledTableColumnsIcon = styled(TableColumnsIcon)({
  color: "#346798",
});

type Props<C extends ExtendedColumn> = {
  icon?: ReactNode;
} & Pick<
  ColumnVisibilityPopperProps<C>,
  | "columns"
  | "groups"
  | "columnVisibilityModel"
  | "getColumnKey"
  | "getColumnLabel"
  | "getColumnGroup"
  | "onColumnVisibilityModelChange"
  | "sortAlphabetically"
>;

/**
 * A component that renders a button to toggle the ColumnVisibilityPopper.
 * It receives the columnVisibilityModel from the parent component.
 *
 * @template C - The type of the column objects
 * @param {Props} props
 * @returns {JSX.Element}
 */
const ColumnVisibilityButton = <C extends ExtendedColumn>({
  icon,
  ...popperProps
}: Props<C>): JSX.Element => {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);

  const handleOpenPopper = (event: React.MouseEvent<HTMLElement>): void => {
    setAnchorEl(event.currentTarget);
  };

  const handleClosePopper = (): void => {
    setAnchorEl(null);
  };

  return (
    <>
      <Tooltip
        open={undefined}
        title="Customize visible columns"
        placement="top"
        disableHoverListener={false}
      >
        <StyledIconButton
          onClick={handleOpenPopper}
          aria-label="Manage columns button"
          data-testid="column-visibility-button"
          disableTouchRipple
          disableRipple
          disableFocusRipple
        >
          {icon ?? (
            <Stack direction="row">
              <StyledTableColumnsIcon />
              <StyledExpandMoreIcon />
            </Stack>
          )}
        </StyledIconButton>
      </Tooltip>
      <ColumnVisibilityPopper
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleClosePopper}
        {...popperProps}
      />
    </>
  );
};

export default ColumnVisibilityButton;
