import { Stack, Typography, styled } from "@mui/material";
import { FC } from "react";

import LegendItem from "./LegendItem";

export type Props = {
  filters: LegendFilter[];
  onClick?: (filter: LegendFilter) => void;
};

const StyledContainer = styled(Stack)({
  borderRadius: "8px",
  background: "#F5F8F9",
  border: "1px solid #939393",
  width: "569px",
  padding: "13px 32px 12.79px",
  marginTop: "20px",
  gap: "2.21px",
});

const StyledLegendHeader = styled(Typography)({
  fontFamily: "'Nunito Sans', 'Rubik', sans-serif",
  fontWeight: 600,
  fontSize: "13px",
  lineHeight: "17.73px",
  letterSpacing: "-0.25px",
  color: "#525252",
});

const StyledLegendTitle = styled(Typography)({
  fontFamily: "'Nunito Sans', 'Rubik', sans-serif",
  fontWeight: 600,
  fontSize: "13px",
  lineHeight: "17.73px",
  letterSpacing: "-0.25px",
  color: "#156071",
});

/**
 * A color code legend for the Data Submissions statistics chart(s)
 *
 * @returns {React.FC}
 */
const StatisticLegend: FC<Props> = ({ filters, onClick }) => (
  <StyledContainer direction="column" justifyContent="center" alignItems="center">
    <StyledLegendHeader variant="h6">
      Click a Validation Status to Filter the Node Displays above
    </StyledLegendHeader>
    <Stack direction="row" justifyContent="center" alignItems="center" gap="35px">
      <StyledLegendTitle>Validation Status</StyledLegendTitle>
      {filters.map((filter) => (
        <LegendItem
          key={filter.label}
          color={filter.color}
          label={filter.label}
          disabled={filter.disabled}
          onClick={() => onClick?.(filter)}
        />
      ))}
    </Stack>
  </StyledContainer>
);

export default StatisticLegend;
