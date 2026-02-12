import { Box, Typography, styled } from "@mui/material";
import { isEqual } from "lodash";
import { FC, memo } from "react";
import { TooltipProps } from "recharts";

const StyledContainer = styled(Box)({
  backgroundColor: "white",
  borderRadius: "12px",
  border: "1px solid #2B528B",
  boxShadow: "0px 4px 4px 0px #00000026",
  padding: "8px 14px",
  minWidth: "100px",
});

const StyledTitle = styled(Typography)({
  fontFamily: "Inter",
  fontWeight: 700,
  fontSize: "14px",
  lineHeight: "20px",
  color: "#346798",
  textTransform: "capitalize",
  marginBottom: "5px",
  textAlign: "center",
});

type Props = Pick<TooltipProps<number, SeriesLabel>, "active" | "label">;

const LabelTooltip: FC<Props> = ({ active, label }: Props) => {
  if (!active || !label) {
    return null;
  }

  return (
    <StyledContainer>
      <StyledTitle>{label.replace(/_/g, " ")}</StyledTitle>
    </StyledContainer>
  );
};

export default memo(LabelTooltip, isEqual);
