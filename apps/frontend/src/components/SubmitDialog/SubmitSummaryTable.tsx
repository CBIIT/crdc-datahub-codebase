import {
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  styled,
} from "@mui/material";
import { visuallyHidden } from "@mui/utils";
import { memo } from "react";

const StyledTableContainer = styled(TableContainer)({
  borderRadius: "8px",
  border: "1px solid #6CACDA",
  marginBottom: "25px",
  position: "relative",
  overflow: "hidden",
  "& .MuiTableBody-root .MuiTableRow-root:nth-of-type(odd)": {
    background: "#FFF",
  },
  "& .MuiTableBody-root .MuiTableRow-root:nth-of-type(even)": {
    background: "#E3EEF9",
  },
  "& .MuiTableCell-root:first-of-type": {
    paddingLeft: "24px",
  },
  "& .MuiTableCell-root:last-of-type": {
    paddingRight: "24px",
  },
});

const StyledTableWrapper = styled("div")({
  overflowX: "auto",
  width: "100%",
});

const StyledTableHead = styled(TableHead)({
  background: "#5C8FA7",
});

const StyledHeaderCell = styled(TableCell)({
  fontWeight: 700,
  fontSize: "16px",
  lineHeight: "19.6px",
  color: "#fff !important",
  padding: "16px 25px 15px",
  verticalAlign: "top",
  whiteSpace: "nowrap",
  "&.MuiTableCell-root:first-of-type": {
    padding: "16px 25px 15px",
    color: "#fff !important",
  },
  "& .MuiSvgIcon-root, & .MuiButtonBase-root": {
    color: "#fff !important",
  },
});

const StyledTableCell = styled(TableCell)({
  fontSize: "16px",
  color: "#083A50 !important",
  fontWeight: 400,
  lineHeight: "19.6px",
  borderBottom: 0,
  "&.MuiTableCell-root": {
    padding: "6px 25px 7px",
  },
});

/**
 * Skeleton row count for the loading state.
 */
const SKELETON_ROW_COUNT = 3 as const;

type TableRowsLoaderProps = {
  /**
   * Number of rows to display in the loader.
   */
  rowsNum: number;
  /**
   * Whether the submission intention is 'New/Update'
   */
  isNewUpdate: boolean;
  /**
   * Type of the table rows (header or body).
   */
  type: "header" | "body";
};

/**
 * TableRowsLoader component for displaying skeleton rows in the table.
 *
 * @param param Props for the loader component.
 * @returns JSX.Element
 */
const TableRowsLoader = ({ rowsNum, isNewUpdate, type }: TableRowsLoaderProps) => {
  const CellComponent = type === "header" ? StyledHeaderCell : StyledTableCell;

  return [...Array(rowsNum)].map((_, index) => (
    // eslint-disable-next-line react/no-array-index-key
    <TableRow key={`submit-summary-skeleton-${index}`} data-testid="submit-summary-skeleton">
      <CellComponent component="th" scope="row" aria-label="loading-cell">
        <span style={visuallyHidden}>Loading...</span>
        <Skeleton animation="wave" variant="text" />
      </CellComponent>
      <CellComponent component="th" scope="row" aria-label="loading-cell">
        <span style={visuallyHidden}>Loading...</span>
        <Skeleton animation="wave" variant="text" />
      </CellComponent>
      {isNewUpdate ? (
        <CellComponent component="th" scope="row" aria-label="loading-cell">
          <span style={visuallyHidden}>Loading...</span>
          <Skeleton animation="wave" variant="text" />
        </CellComponent>
      ) : null}
    </TableRow>
  ));
};

type Props = {
  /**
   * The Submission intention
   */
  intention?: string;
  /**
   * The data for the submission summary table.
   */
  data: NodeTypeSummary[];
  /**
   * Indicates whether the table is loading.
   */
  loading?: boolean;
};

/**
 * SubmitSummaryTable component for displaying the summary of the submission in a table.
 *
 * @param param Props for the table component.
 * @returns JSX.Element
 */
const SubmitSummaryTable = ({ intention, data = [], loading }: Props) => {
  const isNewUpdate = intention === "New/Update";

  return (
    <StyledTableContainer aria-busy={!!loading} aria-live="polite">
      <StyledTableWrapper>
        <Table>
          <StyledTableHead>
            {!intention ? (
              <TableRowsLoader type="header" rowsNum={1} isNewUpdate={isNewUpdate} />
            ) : (
              <TableRow>
                <StyledHeaderCell>Node Type</StyledHeaderCell>
                {isNewUpdate ? (
                  <>
                    <StyledHeaderCell>New Nodes</StyledHeaderCell>
                    <StyledHeaderCell>Updated Nodes</StyledHeaderCell>
                  </>
                ) : (
                  <StyledHeaderCell>Deleted Nodes</StyledHeaderCell>
                )}
              </TableRow>
            )}
          </StyledTableHead>

          <TableBody data-testid="submit-summary-table-body">
            {loading || !data?.length ? (
              <TableRowsLoader type="body" rowsNum={SKELETON_ROW_COUNT} isNewUpdate={isNewUpdate} />
            ) : (
              data?.map((item) => (
                <TableRow key={item.nodeType}>
                  <StyledTableCell>{item.nodeType}</StyledTableCell>
                  {isNewUpdate ? (
                    <>
                      <StyledTableCell data-testid="submit-summary-new">
                        {Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(
                          item?.new || 0
                        )}
                      </StyledTableCell>
                      <StyledTableCell data-testid="submit-summary-updated">
                        {Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(
                          item?.updated || 0
                        )}
                      </StyledTableCell>
                    </>
                  ) : (
                    <StyledTableCell data-testid="submit-summary-deleted">
                      {Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(
                        item?.deleted || 0
                      )}
                    </StyledTableCell>
                  )}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </StyledTableWrapper>
    </StyledTableContainer>
  );
};

export default memo(SubmitSummaryTable);
