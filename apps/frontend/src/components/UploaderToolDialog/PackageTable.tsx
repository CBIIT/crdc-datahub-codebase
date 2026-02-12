import {
  IconButton,
  Stack,
  styled,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from "@mui/material";
import { Link } from "react-router-dom";

import DownloadIcon from "../../assets/icons/download_icon.svg?react";
import packageConfig from "../../config/PackageTableConfig";

const StyledTableContainer = styled(TableContainer)({
  borderRadius: "8px",
  border: "1px solid #6B7294",
  position: "relative",
  overflow: "hidden",
  background: "#FFF",
  "& .MuiTableHead-root .MuiTableCell-root, .MuiTableBody-root .MuiTableRow-root:not(:last-of-type) .MuiTableCell-root":
    {
      borderBottom: "1px solid #6B7294",
    },
  "& .MuiTableCell-root:not(:last-of-type)": {
    borderRight: "1px solid #6B7294",
  },
});

const StyledTableHead = styled(TableHead)({
  "&.MuiTableHead-root .MuiTableCell-head": {
    fontFamily: "'Nunito', 'Rubik', sans-serif",
    fontWeight: 700,
    fontSize: "16px",
    lineHeight: "19.6px",
    color: "#083A50",
    padding: "11px 15px",
  },
});

const StyledTableBody = styled(TableBody)({
  "&.MuiTableBody-root .MuiTableCell-body": {
    fontFamily: "'Nunito', 'Rubik', sans-serif",
    fontWeight: 400,
    fontSize: "16px",
    lineHeight: "24px",
    color: "#083A50",
    padding: "8px 16px",
    "& .MuiIconButton-root": {
      padding: 0,
    },
  },
});

const StyledDownload = styled(Link)({
  fontFamily: "'Nunito', 'Rubik', sans-serif",
  fontWeight: 700,
  fontSize: "16px",
  lineHeight: "19.6px",
  color: "#365F71",
  textDecoration: "underline",
  marginRight: "8px",
});

const StyledDownloadIcon = styled(DownloadIcon)({
  color: "#365F71",
});

const PackageTable = () => (
  <StyledTableContainer data-testid="package-table-container">
    <Table>
      <StyledTableHead>
        <TableRow>
          <TableCell>Package Type</TableCell>
          <TableCell>Platform</TableCell>
          <TableCell>Download</TableCell>
        </TableRow>
      </StyledTableHead>
      <StyledTableBody>
        {packageConfig.map((pkg, idx) => (
          // eslint-disable-next-line react/no-array-index-key
          <TableRow key={`package_${idx}_${pkg.fileName}`}>
            <TableCell data-testid={`package-type-${pkg.fileName}`}>{pkg.packageType}</TableCell>
            <TableCell data-testid={`package-platform-${pkg.fileName}`}>{pkg.platform}</TableCell>
            <TableCell>
              {pkg.downloadURL && (
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <StyledDownload
                    to={pkg.downloadURL}
                    target="_self"
                    download={pkg.fileName}
                    aria-label={pkg.fileName}
                    data-testid={`package-table-text-download-${pkg.fileName}`}
                  >
                    {pkg.fileName}
                  </StyledDownload>
                  <IconButton
                    href={pkg.downloadURL}
                    target="_self"
                    download={pkg.fileName}
                    aria-label={pkg.fileName}
                    data-testid={`package-table-icon-download-${pkg.fileName}`}
                  >
                    <StyledDownloadIcon />
                  </IconButton>
                </Stack>
              )}
            </TableCell>
          </TableRow>
        ))}
      </StyledTableBody>
    </Table>
  </StyledTableContainer>
);

export default PackageTable;
