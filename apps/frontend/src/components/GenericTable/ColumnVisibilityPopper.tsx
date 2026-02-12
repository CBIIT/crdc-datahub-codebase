import {
  Popper,
  Paper,
  Checkbox,
  FormControlLabel,
  styled,
  Box,
  Stack,
  ClickAwayListener,
  Typography,
  IconButton,
  Button,
} from "@mui/material";
import { isEqual } from "lodash";
import React, { ChangeEvent, InputHTMLAttributes, useMemo } from "react";

import checkboxCheckedIcon from "../../assets/icons/checkbox_checked.svg?url";
import CloseIconSvg from "../../assets/icons/close_icon.svg?react";
import Tooltip from "../Tooltip";

const StyledPopper = styled(Popper)({
  zIndex: 300,
});

const StyledResetButton = styled(Button)(({ theme }) => ({
  color: "#083A50",
  fontSize: "16px",
  fontStyle: "normal",
  fontWeight: 700,
  lineHeight: "19.6px",
  padding: 0,
  "&.Mui-disabled": {
    opacity: theme.palette.action.disabledOpacity,
  },
}));

const StyledCloseDialogButton = styled(IconButton)(() => ({
  position: "absolute !important" as "absolute",
  right: "15px",
  top: "18px",
  padding: "10px",
  "& svg": {
    color: "#44627C",
  },
}));

const UncheckedIcon = styled("div")({
  outline: "3px solid #1D91AB",
  outlineOffset: -3,
  borderRadius: "4px",
  width: "24px",
  height: "24px",
  backgroundColor: "#FFFFFF",
  color: "#083A50",
  cursor: "pointer",
});

const CheckedIcon = styled("div")({
  backgroundImage: `url("${checkboxCheckedIcon}")`,
  backgroundSize: "auto",
  backgroundRepeat: "no-repeat",
  width: "24px",
  height: "24px",
  backgroundColor: "initial",
  color: "#1D91AB",
  borderRadius: "4px",
  cursor: "pointer",
});

const StyledTitle = styled(Typography)({
  fontSize: "16px",
  color: "#083A50 !important",
  fontStyle: "normal",
  fontWeight: 700,
  lineHeight: "19.6px",
});

const StyledCheckbox = styled(Checkbox)({
  padding: 0,
  marginRight: "5px",
});

const StyledPaper = styled(Paper, { shouldForwardProp: (p) => p !== "isGrouped" })<{
  isGrouped: boolean;
}>(({ isGrouped }) => ({
  width: "295px",
  border: "2px solid #5AB8FF",
  borderRadius: "8px",
  backgroundColor: isGrouped ? "#D2DBE4" : "#F2F6FA",
}));

const StyledColumnContainer = styled(Box)({
  display: "flex",
  flexDirection: "column",
  justifyContent: "center",
  alignItems: "flex-start",
  gap: "10px",
  padding: "22px 20px 18px 20px",
  maxWidth: "100%",
});

const StyledColumnList = styled(Stack)({
  maxWidth: "100%",
  display: "flex",
  flexDirection: "column",
  justifyContent: "center",
  alignItems: "flex-start",
  gap: "10px",
});

const StyledGroupContainer = styled(Box)({
  background: "#FFFFFF",
  padding: "15px",
  width: "100%",
  "&:not(:last-of-type)": {
    borderBottom: "0.5px solid #375F9A",
  },
});

const StyledGroupTitleContainer = styled(Stack)({
  flexDirection: "row",
  alignItems: "center",
  marginBottom: "8px",
});

const StyledGroupTitle = styled(Typography)({
  textTransform: "uppercase",
  fontSize: "13px",
  color: "#083A50",
});

const StyledScrollRegion = styled("div")({
  maxHeight: "450px",
  overflowY: "auto",
  width: "100%",
});

const StyledNoColumnsText = styled(Typography)({
  fontSize: "12px",
  color: "#083A50",
});

const StyledFormControlLabel = styled(FormControlLabel)(({ theme }) => ({
  width: "100%",
  marginRight: 0,
  marginLeft: 0,
  "& .MuiFormControlLabel-label": {
    overflowWrap: "anywhere",
    width: "100%",
    fontSize: "16px",
    color: "#083A50 !important",
    fontStyle: "normal",
    fontWeight: 700,
    lineHeight: "19.6px",
  },
  "& .Mui-disabled": {
    opacity: theme.palette.action.disabledOpacity,
  },
}));

const StyledFooter = styled(Stack)({
  flexDirection: "row",
  justifyContent: "space-between",
  alignItems: "center",
  padding: "16px 8px 20px 13px",
  borderTop: "1px solid #375F9A",
  marginLeft: "12px",
  marginRight: "12px",
});

type ColumnToggleProps = {
  /**
   * Whether to disable the checkbox.
   */
  disabled: boolean;
  /**
   * The unique key or identifier for the column.
   */
  colKey: string;
  /**
   * The display label for the column.
   */
  colLabel: string;
  /**
   * Whether the checkbox is checked or unchecked
   */
  checked: boolean;
  /**
   * The onChange curried handler
   */
  onChange: (
    key: string,
    isHideable: boolean
  ) => (event: React.ChangeEvent<HTMLInputElement>, checked: boolean) => void;
};

/**
 * Renders a checkbox for toggling the visibility of a single column.
 * Disables the checkbox and label for non-hideable columns.
 */
const ColumnToggle = React.memo<ColumnToggleProps>(
  ({ colKey, colLabel, checked, disabled, onChange }: ColumnToggleProps): JSX.Element => (
    <StyledFormControlLabel
      control={
        <StyledCheckbox
          checked={checked}
          onChange={onChange(colKey, !disabled)}
          icon={<UncheckedIcon />}
          checkedIcon={<CheckedIcon />}
          disabled={disabled}
          inputProps={
            {
              "data-testid": `checkbox-${colKey}`,
            } as InputHTMLAttributes<HTMLInputElement>
          }
        />
      }
      label={colLabel}
      disabled={disabled}
    />
  ),
  isEqual
);

export type ExtendedColumn = {
  /**
   * Indicates if the column can be hidden by the user.
   * If false, the column will always be visible and its checkbox will be disabled.
   */
  hideable?: boolean;
  /**
   * Indicates if the column is hidden by default.
   * If true, the column will be hidden when the default visibility model is applied.
   */
  defaultHidden?: boolean;
};

export type ColumnVisibilityPopperGroup = {
  /**
   * The name of the group.
   * This should match the `groupName` property of the columns to be grouped.
   */
  name: string;
  /**
   * (Optional) A description for the group.
   * This can be used to provide additional context or information about the group.
   */
  description?: string;
};

export type ColumnVisibilityPopperProps<C extends ExtendedColumn> = {
  /**
   * The element to which the popper is anchored.
   */
  anchorEl: HTMLElement | null;
  /**
   * If true, the popper is visible.
   */
  open: boolean;
  /**
   * An array of column objects representing the columns in the table.
   */
  columns: C[];
  /**
   * (Optional) An array of group objects to categorize columns.
   *
   * @note Must include every `groupName` used in the `columns` prop if grouping is desired.
   */
  groups?: ColumnVisibilityPopperGroup[];
  /**
   * The current visibility model for the columns.
   */
  columnVisibilityModel: ColumnVisibilityModel;
  /**
   * If true, columns will be sorted alphabetically by their labels.
   * Default is true.
   */
  sortAlphabetically?: boolean;
  /**
   * Callback fired when the column visibility model changes.
   *
   * @param model The updated column visibility model.
   */
  onColumnVisibilityModelChange: (model: ColumnVisibilityModel) => void;
  /**
   * Callback fired when the popper is requested to be closed.
   */
  onClose: () => void;
  /**
   * Gets the unique key or identifier for a column.
   *
   * @param column The column object.
   * @returns The unique key for the column.
   */
  getColumnKey: (column: C) => string;
  /**
   * Gets the display label for a column.
   *
   * @param column The column object.
   * @returns The display label for the column.
   */
  getColumnLabel: (column: C) => string;
  /**
   * Gets the group name for a column.
   * Should return a string that matches one of the `name` values in the `groups` prop.
   *
   * @note You must also provide `groups` prop to the {@link ColumnVisibilityPopper} component for grouping to work. See {@link ColumnVisibilityPopperGroup}.
   */
  getColumnGroup?: (column: C) => string;
};

/**
 * A popper component that allows users to toggle the visibility of table columns.
 * Supports non-hideable columns by disabling their checkboxes and labels.
 *
 * @template C - The type of the column objects
 * @param {ColumnVisibilityPopperProps} props
 * @returns {JSX.Element}
 */
const ColumnVisibilityPopper = <C extends ExtendedColumn>({
  anchorEl,
  open,
  columns,
  groups,
  columnVisibilityModel,
  sortAlphabetically = true,
  onColumnVisibilityModelChange,
  onClose,
  getColumnKey,
  getColumnLabel,
  getColumnGroup,
}: ColumnVisibilityPopperProps<C>): JSX.Element => {
  /**
   * The defined default column visibility.
   */
  const defaultVisibilityModel = useMemo<ColumnVisibilityModel>(
    () =>
      columns.reduce<ColumnVisibilityModel>((model, column) => {
        const key = getColumnKey(column);
        model[key] = !column.defaultHidden;
        return model;
      }, {}),
    [columns, getColumnKey]
  );

  /**
   * Indicates whether the current columns match the default model.
   */
  const isShowingDefaultVisibleColumns = useMemo<boolean>(
    () => isEqual(columnVisibilityModel, defaultVisibilityModel),
    [columnVisibilityModel, defaultVisibilityModel]
  );

  /**
   * Handles the change event for individual column checkboxes.
   * Ensures non-hideable columns remain checked.
   *
   * @param key - The unique key of the column
   * @param isHideable - Indicates if the column is hideable
   */
  const handleCheckboxChange =
    (key: string, isHideable: boolean) =>
    (event: ChangeEvent<HTMLInputElement>): void => {
      if (!isHideable) {
        return; // Prevent changing non-hideable columns
      }
      const updatedModel = {
        ...columnVisibilityModel,
        [key]: event.target.checked,
      };
      onColumnVisibilityModelChange(updatedModel);
    };

  /**
   * Handles the "Show/Hide All" checkbox change event.
   * Toggles visibility of all hideable columns.
   *
   * @param event - The change event from the checkbox
   */
  const handleToggleAll = (event: ChangeEvent<HTMLInputElement>): void => {
    const isChecked = event.target.checked;
    const updatedModel = columns.reduce<ColumnVisibilityModel>((model, column) => {
      const key = getColumnKey(column);
      const isHideable = column.hideable !== false;
      if (isHideable) {
        model[key] = isChecked;
      } else {
        model[key] = true; // Non-hideable columns remain visible
      }
      return model;
    }, {});
    onColumnVisibilityModelChange(updatedModel);
  };

  /**
   * Resets all columns to the default visibility model.
   * Non-hideable columns remain visible.
   */
  const handleReset = (): void => {
    onColumnVisibilityModelChange({ ...defaultVisibilityModel });
  };

  const sortedColumns = useMemo<C[]>(() => {
    if (!sortAlphabetically) {
      return columns;
    }

    return [...columns].sort((a, b) => {
      const labelA = getColumnLabel(a)?.toLowerCase();
      const labelB = getColumnLabel(b)?.toLowerCase();
      return labelA?.localeCompare(labelB);
    });
  }, [columns, getColumnLabel, sortAlphabetically]);

  const groupedColumns = useMemo<Array<ColumnVisibilityPopperGroup & { columns: C[] }>>(() => {
    if (!Array.isArray(groups) || groups.length === 0 || typeof getColumnGroup !== "function") {
      return [];
    }

    const grouped = [...groups].map((group) => ({
      ...group,
      columns: sortedColumns.filter((column) => getColumnGroup(column) === group.name),
    }));

    return grouped;
  }, [groups, sortedColumns, getColumnGroup]);

  const hideableColumns = useMemo<C[]>(
    () => columns.filter((column) => column.hideable !== false),
    [columns]
  );

  const allHideableChecked = useMemo<boolean>(
    () =>
      hideableColumns.every((column) => {
        const key = getColumnKey(column);
        return columnVisibilityModel[key];
      }),
    [hideableColumns, columnVisibilityModel, getColumnKey]
  );

  return (
    <StyledPopper
      open={open}
      anchorEl={anchorEl}
      placement="bottom-end"
      modifiers={[
        {
          name: "flip",
          enabled: false,
          options: {
            fallbackPlacements: [],
          },
        },
      ]}
      data-testid="column-visibility-popper"
    >
      <ClickAwayListener onClickAway={onClose}>
        <StyledPaper elevation={8} role="presentation" isGrouped={groups?.length > 0}>
          <StyledCloseDialogButton
            aria-label="close"
            data-testid="column-visibility-popper-close-button"
            onClick={onClose}
          >
            <CloseIconSvg />
          </StyledCloseDialogButton>

          <StyledColumnContainer data-testid="column-list">
            <StyledTitle>Visible Columns</StyledTitle>
            <StyledScrollRegion>
              {groupedColumns.length > 0 ? (
                groupedColumns.map(({ name, description, columns }) => (
                  <StyledGroupContainer key={name} data-testid={`column-group-${name}`}>
                    <StyledGroupTitleContainer>
                      <StyledGroupTitle>{name}</StyledGroupTitle>
                      {description && (
                        <Tooltip title={description} data-testid="column-group-tooltip" arrow />
                      )}
                    </StyledGroupTitleContainer>
                    <StyledColumnList>
                      {columns.map((column) => {
                        const colKey = getColumnKey(column);
                        return (
                          <ColumnToggle
                            key={colKey}
                            colKey={colKey}
                            colLabel={getColumnLabel(column)}
                            disabled={column.hideable === false}
                            checked={columnVisibilityModel[colKey]}
                            onChange={handleCheckboxChange}
                          />
                        );
                      })}
                      {columns.length === 0 && <StyledNoColumnsText>N/A</StyledNoColumnsText>}
                    </StyledColumnList>
                  </StyledGroupContainer>
                ))
              ) : (
                <StyledColumnList>
                  {sortedColumns.map((column) => {
                    const colKey = getColumnKey(column);
                    return (
                      <ColumnToggle
                        key={colKey}
                        colKey={colKey}
                        colLabel={getColumnLabel(column)}
                        disabled={column.hideable === false}
                        checked={columnVisibilityModel[colKey]}
                        onChange={handleCheckboxChange}
                      />
                    );
                  })}
                </StyledColumnList>
              )}
            </StyledScrollRegion>
          </StyledColumnContainer>

          <StyledFooter>
            <StyledFormControlLabel
              control={
                <StyledCheckbox
                  indeterminate={false}
                  checked={allHideableChecked}
                  onChange={handleToggleAll}
                  icon={<UncheckedIcon />}
                  checkedIcon={<CheckedIcon />}
                  inputProps={
                    {
                      "data-testid": "toggle-all-checkbox",
                    } as InputHTMLAttributes<HTMLInputElement>
                  }
                />
              }
              label="Show All"
            />
            <StyledResetButton
              variant="text"
              onClick={handleReset}
              disabled={isShowingDefaultVisibleColumns}
              data-testid="reset-button"
            >
              RESET
            </StyledResetButton>
          </StyledFooter>
        </StyledPaper>
      </ClickAwayListener>
    </StyledPopper>
  );
};

export default ColumnVisibilityPopper;
