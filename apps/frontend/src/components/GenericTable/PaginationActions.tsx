import {
  Pagination,
  PaginationItem,
  PaginationRenderItemParams,
  TablePaginationProps,
  styled,
} from "@mui/material";
import { AriaAttributes, FC } from "react";

const StyledPagination = styled(Pagination)({
  marginLeft: "23px",
  marginRight: "30.59px",
  "& .MuiPagination-ul": {
    flexWrap: "nowrap",
  },
  "& .MuiPaginationItem-root": {
    margin: 0,
    textAlign: "center",
    fontVariantNumeric: "lining-nums tabular-nums",
    fontFamily: "Lato, sans-serif",
    fontSize: "14px",
    fontStyle: "normal",
    lineHeight: "14.913px",
    letterSpacing: "0.14px",
    borderWidth: "1px 0 1px 1px",
    borderStyle: "solid",
    borderColor: "#415B88",
    background: "#FFF",
    borderRadius: 0,
    height: "27px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  "& .MuiPagination-ul li:last-of-type .MuiPaginationItem-root": {
    borderRightWidth: "1px",
    borderLeftWidth: 0,
  },
  "& .MuiPagination-ul li:nth-last-of-type(2) .MuiPaginationItem-page": {
    borderRight: "1px solid #415B88",
  },
});

const StyledPaginationItem = styled(PaginationItem)(({ selected }) => ({
  color: selected ? "#004187" : "#415B88",
  fontWeight: selected ? 700 : 400,
  "&.MuiPaginationItem-root.Mui-selected": {
    background: "#FFFFFF",
  },
}));

export type CustomPaginationActionsProps = {
  /**
   * An optional prop to render additional action components.
   */
  AdditionalActions?: React.ReactNode;
  /**
   * Any additional aria attributes to be passed to the component.
   */
  ariaProps?: AriaAttributes;
} & TablePaginationProps;

const PaginationActions: FC<CustomPaginationActionsProps> = ({
  count,
  page,
  rowsPerPage,
  AdditionalActions,
  onPageChange,
  ariaProps,
}: CustomPaginationActionsProps) => (
  <>
    <StyledPagination
      count={Math.ceil(count / rowsPerPage)}
      page={page + 1}
      onChange={onPageChange}
      variant="outlined"
      shape="rounded"
      renderItem={(params: PaginationRenderItemParams) => <StyledPaginationItem {...params} />}
      {...ariaProps}
    />
    {AdditionalActions}
  </>
);

export default PaginationActions;
