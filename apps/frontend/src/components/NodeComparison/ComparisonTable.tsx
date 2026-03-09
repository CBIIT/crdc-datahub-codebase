import {
  Alert,
  Skeleton,
  styled,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from "@mui/material";
import { isEqual } from "lodash";
import { FC, memo, useMemo } from "react";

import { RetrieveReleasedDataResp } from "../../graphql";
import { coerceToString, safeParse } from "../../utils";
import Repeater from "../Repeater";

const StyledAlert = styled(Alert)({
  marginTop: "12px",
});

const StyledTableContainer = styled(TableContainer)({
  marginTop: "12px",
  paddingBottom: "6px",
  overflowX: "auto",
  width: "100%",
});

const StyledTable = styled(Table)({
  backgroundColor: "#fff",
  borderCollapse: "separate",
  borderRadius: "8px",
  tableLayout: "auto",
  // NOTE: The first element in this thead is a TD, not a TH
  "& thead tr:first-of-type td:first-of-type": {
    borderTopLeftRadius: "8px",
  },
  "& thead tr:first-of-type th:last-child": {
    borderTopRightRadius: "8px",
  },
  "& tbody tr:last-child td:first-of-type": {
    borderBottomLeftRadius: "8px",
  },
  "& tbody tr:last-child td:last-child": {
    borderBottomRightRadius: "8px",
  },
});

const StyledTableHead = styled(TableHead)({
  "& .MuiTableRow-root th": {
    fontWeight: 700,
  },
});

const StyledTableCell = styled(TableCell, {
  shouldForwardProp: (p) => p !== "highlight" && p !== "gray",
})<{
  highlight?: boolean;
  gray?: boolean;
}>(({ highlight, gray }) => ({
  whiteSpace: "nowrap",
  overflow: "hidden",
  border: "0.5px solid #a7a7a7",
  backgroundColor: gray ? "#F2F6FA" : "transparent",
  padding: "8px 15px",
  color: highlight ? "#CA4F1A" : "#083A50",
  fontWeight: highlight ? 700 : 400,
}));

/**
 * The number of placeholder columns to display in the loading state
 */
const PLACEHOLDER_NUM_COLS = 5;

/**
 * The width of the new/existing column
 */
const BLANK_COL_WIDTH = 55;

/**
 * The special symbol used to indicate that the data processing system should delete the property data
 */
const DELETE_DATA_SYMBOL = "<delete>";

export type ComparisonTableProps = {
  /**
   * The new node to be compared
   */
  newNode: RetrieveReleasedDataResp["retrieveReleasedDataByID"][number];
  /**
   * The existing node to be compared
   */
  existingNode: RetrieveReleasedDataResp["retrieveReleasedDataByID"][number];
  /**
   * A boolean indicating whether the data is in a loading state
   */
  loading: boolean;
};

type ParsedNodeProps = Record<string, string | number | boolean>;

/**
 * Builds a dynamic table to compare the dataset between two data records
 * Handles loading state
 *
 * @returns The NodeComparisonTable component
 */
const ComparisonTable: FC<ComparisonTableProps> = ({ newNode, existingNode, loading }) => {
  const newProps = useMemo<ParsedNodeProps>(() => safeParse(newNode?.props), [newNode]);

  const existingProps = useMemo<ParsedNodeProps>(
    () => safeParse(existingNode?.props),
    [existingNode]
  );

  const allPropertyNames = useMemo<string[]>(() => {
    const newKeys = Object.keys(newProps);
    const existingKeys = Object.keys(existingProps);
    return [...new Set([...newKeys, ...existingKeys])];
  }, [newProps, existingProps]);

  const changedPropertyNames = useMemo<string[]>(
    () =>
      allPropertyNames.filter((property) => {
        const [newVal, oldVal] = [newProps?.[property], existingProps?.[property]];

        return (
          (!isEqual(newVal, oldVal) && newVal !== "" && newVal !== null) ||
          newVal === DELETE_DATA_SYMBOL
        );
      }),
    [newProps, existingProps, allPropertyNames]
  );

  if (!loading && !allPropertyNames.length) {
    return (
      <StyledAlert severity="warning" data-testid="node-comparison-error">
        Unable to show comparison of data.
      </StyledAlert>
    );
  }

  return (
    <StyledTableContainer>
      <StyledTable data-testid="node-comparison-table" size="small">
        <StyledTableHead>
          <TableRow>
            <StyledTableCell component="td" width={BLANK_COL_WIDTH} />
            {loading ? (
              <TableHeaderSkeleton />
            ) : (
              allPropertyNames.map((property) => (
                <StyledTableCell key={property}>{property}</StyledTableCell>
              ))
            )}
          </TableRow>
        </StyledTableHead>
        <TableBody>
          {loading ? (
            <TableBodySkeleton />
          ) : (
            <>
              <TableRow data-testid="node-comparison-table-existing">
                <StyledTableCell width={BLANK_COL_WIDTH}>Existing</StyledTableCell>
                {allPropertyNames.map((property) => (
                  <StyledTableCell
                    key={property}
                    data-testid={`node-comparison-table-existing-${property}`}
                    gray={!changedPropertyNames.includes(property)}
                  >
                    {coerceToString(existingProps?.[property])}
                  </StyledTableCell>
                ))}
              </TableRow>
              <TableRow data-testid="node-comparison-table-new">
                <StyledTableCell width={BLANK_COL_WIDTH}>New</StyledTableCell>
                {allPropertyNames.map((property) => (
                  <StyledTableCell
                    key={property}
                    data-testid={`node-comparison-table-new-${property}`}
                    highlight={changedPropertyNames.includes(property)}
                    gray={!changedPropertyNames.includes(property)}
                  >
                    {coerceToString(newProps?.[property])}
                  </StyledTableCell>
                ))}
              </TableRow>
            </>
          )}
        </TableBody>
      </StyledTable>
    </StyledTableContainer>
  );
};

/**
 * A skeleton table header to display while the data is loading
 *
 * @returns The TableHeaderSkeleton component
 */
const TableHeaderSkeleton: FC = () => (
  <Repeater count={PLACEHOLDER_NUM_COLS} keyPrefix="loader-skeleton-header">
    <StyledTableCell component="td" data-testid="node-comparison-table-header-skeleton">
      <Skeleton variant="text" width="100%" height={24} />
    </StyledTableCell>
  </Repeater>
);

/**
 * A skeleton table body to display while the data is loading
 *
 * @returns The TableBodySkeleton component
 */
const TableBodySkeleton: FC = () => (
  <>
    <TableRow>
      <StyledTableCell width={BLANK_COL_WIDTH}>Existing</StyledTableCell>
      <Repeater count={PLACEHOLDER_NUM_COLS} keyPrefix="loader-skeleton-existing">
        <StyledTableCell>
          <Skeleton variant="text" width="100%" height={24} />
        </StyledTableCell>
      </Repeater>
    </TableRow>
    <TableRow>
      <StyledTableCell width={BLANK_COL_WIDTH}>New</StyledTableCell>
      <Repeater count={PLACEHOLDER_NUM_COLS} keyPrefix="loader-skeleton-new">
        <StyledTableCell>
          <Skeleton variant="text" width="100%" height={24} />
        </StyledTableCell>
      </Repeater>
    </TableRow>
  </>
);

export default memo<ComparisonTableProps>(ComparisonTable);
