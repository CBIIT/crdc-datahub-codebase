import { useQuery } from "@apollo/client";
import {
  Divider,
  Stack,
  styled,
  Table,
  TableBody,
  TableCell,
  TableRow,
  Typography,
} from "@mui/material";
import { useSnackbar } from "notistack";
import { useEffect } from "react";

import { GET_NODE_DETAIL, GetNodeDetailInput, GetNodeDetailResp } from "../../graphql";
import { capitalizeFirstLetter } from "../../utils";
import SuspenseLoader from "../SuspenseLoader";

import RelatedNodes from "./RelatedNodes";

const StyledSectionDivider = styled(Divider)(() => ({
  "&.MuiDivider-root": {
    display: "flex",
    alignSelf: "flex-start",
    width: "2px",
    height: "103px",
    background: "#6CACDA",
    marginLeft: "33px",
    marginRight: "41.82px",
    marginTop: "2px",
  },
}));

const StyledNodeTypeWrapper = styled(Stack)(() => ({
  maxWidth: "350px",
}));

const StyledLabel = styled(Typography)(() => ({
  color: "#000000",
  fontFamily: "'Nunito', 'Rubik', sans-serif",
  fontSize: "13px",
  fontStyle: "normal",
  fontWeight: 700,
  lineHeight: "19.6px",
  letterSpacing: "0.52px",
  textTransform: "uppercase",
  whiteSpace: "nowrap",
}));

const StyledValue = styled(Typography)(() => ({
  color: "#595959",
  fontFamily: "'Nunito', 'Rubik', sans-serif",
  fontSize: "16px",
  fontStyle: "normal",
  fontWeight: 400,
  lineHeight: "19.6px",
  wordWrap: "break-word",
}));

const StyledNodeTypeLabel = styled(Typography)(() => ({
  width: "100%",
  color: "#929292",
  fontFamily: "'Nunito', 'Rubik', sans-serif",
  fontSize: "13px",
  fontStyle: "normal",
  fontWeight: 600,
  lineHeight: "27px",
  letterSpacing: "0.5px",
  textTransform: "uppercase",
  whiteSpace: "nowrap",
}));

const StyledNodeTypeValue = styled(Typography)(() => ({
  width: "100%",
  minWidth: "120px",
  color: "#0B7F99",
  fontFamily: "'Nunito Sans', 'Rubik', sans-serif",
  fontSize: "35px",
  fontStyle: "normal",
  fontWeight: 900,
  lineHeight: "30px",
  textTransform: "capitalize",
  wordWrap: "break-word",
}));

const StyledTableCell = styled(TableCell)(() => ({
  verticalAlign: "top",
  padding: 0,
  border: 0,
}));

type Props = {
  submissionID: string;
  nodeType: string;
  nodeID: string;
};

const DataViewDetails = ({ submissionID, nodeType, nodeID }: Props) => {
  const { enqueueSnackbar } = useSnackbar();

  const { data, loading, error } = useQuery<GetNodeDetailResp, GetNodeDetailInput>(
    GET_NODE_DETAIL,
    {
      variables: {
        submissionID,
        nodeType,
        nodeID,
      },
      skip: !submissionID || !nodeType || !nodeID,
      context: { clientName: "backend" },
      fetchPolicy: "cache-and-network",
    }
  );

  useEffect(() => {
    if (!error && submissionID && nodeType && nodeID) {
      return;
    }
    enqueueSnackbar("Unable to load node details.", { variant: "error" });
  }, [error]);

  if (loading) {
    return <SuspenseLoader fullscreen={false} />;
  }

  const parents = data?.getNodeDetail?.parents
    ?.map((parent) => capitalizeFirstLetter(parent.nodeType))
    ?.join(", ");
  const children = data?.getNodeDetail?.children
    ?.map((child) => capitalizeFirstLetter(child.nodeType))
    ?.join(", ");

  return (
    <Stack direction="column">
      <Stack direction="row" alignItems="flex-start">
        <StyledNodeTypeWrapper direction="column">
          <StyledNodeTypeLabel variant="h5">Node Type</StyledNodeTypeLabel>
          <StyledNodeTypeValue variant="h6">{nodeType}</StyledNodeTypeValue>
        </StyledNodeTypeWrapper>
        <StyledSectionDivider orientation="vertical" />
        <Table>
          <TableBody>
            <TableRow>
              <StyledTableCell width="1%">
                <StyledLabel pr={4}>{nodeType} ID</StyledLabel>
              </StyledTableCell>
              <StyledTableCell>
                <StyledValue>{nodeID}</StyledValue>
              </StyledTableCell>
            </TableRow>
            <TableRow>
              <StyledTableCell width="1%">
                <StyledLabel pr={4}>Parent(s)</StyledLabel>
              </StyledTableCell>
              <StyledTableCell>
                <StyledValue>{parents}</StyledValue>
              </StyledTableCell>
            </TableRow>
            <TableRow>
              <StyledTableCell width="1%">
                <StyledLabel pr={4}>Child(ren)</StyledLabel>
              </StyledTableCell>
              <StyledTableCell>
                <StyledValue>{children}</StyledValue>
              </StyledTableCell>
            </TableRow>
          </TableBody>
        </Table>
      </Stack>

      <RelatedNodes
        submissionID={submissionID}
        nodeType={nodeType}
        nodeID={nodeID}
        parentNodes={data?.getNodeDetail?.parents || []}
        childNodes={data?.getNodeDetail?.children || []}
      />
    </Stack>
  );
};

export default DataViewDetails;
