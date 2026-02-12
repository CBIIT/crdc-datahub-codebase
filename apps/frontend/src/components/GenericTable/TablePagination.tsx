import {
  TablePagination as MuiTablePagination,
  Stack,
  TablePaginationProps,
  styled,
} from "@mui/material";
import { CSSProperties, ElementType } from "react";

import PaginationActions from "./PaginationActions";

const StyledPaginationWrapper = styled(Stack, {
  shouldForwardProp: (prop) => prop !== "verticalPlacement",
})<{ verticalPlacement: "top" | "bottom" }>(({ verticalPlacement }) => ({
  display: "flex",
  flexDirection: "row",
  justifyContent: "space-between",
  alignItems: "center",
  width: "100%",
  borderTop: verticalPlacement === "bottom" ? "2px solid #083A50" : "none",
  paddingLeft: "24px",
  paddingRight: "2px",
}));

const StyledTablePagination = styled(MuiTablePagination, {
  shouldForwardProp: (prop) => prop !== "placement",
})<
  TablePaginationProps & {
    component: ElementType;
    placement: CSSProperties["justifyContent"];
  }
>(({ placement }) => ({
  "&.MuiTablePagination-root": {
    width: "100%",
  },
  "& .MuiTablePagination-displayedRows, & .MuiTablePagination-selectLabel, & .MuiTablePagination-select":
    {
      height: "27px",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      color: "#1D355F",
      textAlign: "center",
      fontVariantNumeric: "lining-nums tabular-nums",
      fontFamily: "Lato, sans-serif",
      fontSize: "14px",
      fontStyle: "normal",
      fontWeight: 400,
      lineHeight: "14.913px",
      letterSpacing: "0.14px",
    },
  "& .MuiToolbar-root .MuiInputBase-root": {
    height: "27px",
    marginLeft: 0,
    marginRight: "16px",
  },
  "& .MuiToolbar-root p": {
    marginTop: 0,
    marginBottom: 0,
  },
  "& .MuiToolbar-root": {
    minHeight: "43px",
    height: "fit-content",
    paddingTop: "7px",
    paddingBottom: "6px",
    background: "#FFFFFF",
    ...(placement && {
      justifyContent: placement,
      "& .MuiTablePagination-spacer": {
        display: "none",
      },
    }),
  },
}));

type Props = {
  disabled: boolean;
  total: number;
  perPage: number;
  page: number;
  verticalPlacement: VerticalPlacement;
  placement?: CSSProperties["justifyContent"];
  AdditionalActions?: AdditionalActionsConfig;
} & Partial<TablePaginationProps>;

const TablePagination = ({
  disabled,
  total,
  perPage,
  page,
  verticalPlacement,
  AdditionalActions,
  placement,
  rowsPerPageOptions = [5, 10, 20, 50],
  onPageChange,
  onRowsPerPageChange,
  ...rest
}: Props) => {
  const actions = AdditionalActions?.[verticalPlacement];

  return (
    <StyledPaginationWrapper verticalPlacement={verticalPlacement}>
      {actions?.before}
      <StyledTablePagination
        rowsPerPageOptions={rowsPerPageOptions}
        component="div"
        count={total || 0}
        rowsPerPage={perPage}
        page={page}
        onPageChange={onPageChange}
        onRowsPerPageChange={onRowsPerPageChange}
        placement={placement}
        nextIconButtonProps={{
          disabled: disabled || !total || total <= (page + 1) * perPage,
        }}
        SelectProps={{
          inputProps: {
            "aria-label": "rows per page",
            "data-testid": `generic-table-rows-per-page-${verticalPlacement}`,
          },
          native: true,
        }}
        backIconButtonProps={{ disabled: disabled || page <= 0 }}
        // eslint-disable-next-line react/no-unstable-nested-components
        ActionsComponent={(props) => (
          <PaginationActions
            AdditionalActions={actions?.after}
            ariaProps={{ "aria-label": `${verticalPlacement} pagination actions` }}
            {...props}
          />
        )}
        {...rest}
      />
    </StyledPaginationWrapper>
  );
};

export default TablePagination;
