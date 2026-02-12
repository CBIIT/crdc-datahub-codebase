import { Box, Stack, Typography, styled } from "@mui/material";
import { isEqual } from "lodash";
import { CSSProperties, FC, memo, useMemo } from "react";
import { TooltipProps } from "recharts";

const StyledContainer = styled(Box)({
  backgroundColor: "white",
  borderRadius: "12px",
  border: "1px solid #2B528B",
  boxShadow: "0px 4px 4px 0px #00000026",
  padding: "8px 14px",
});

const StyledTitle = styled(Typography)({
  fontFamily: "Inter",
  fontWeight: 700,
  fontSize: "14px",
  lineHeight: "20px",
  color: "#346798",
  textTransform: "capitalize",
  marginBottom: "5px",
});

const StyledKeyStack = styled(Stack)({
  marginTop: "5px",
});

const StyledColorCode = styled(Box, {
  shouldForwardProp: (p) => p !== "background",
})<{ background: CSSProperties["backgroundColor"] }>(({ background }) => ({
  width: "12px",
  height: "12px",
  backgroundColor: background,
}));

const StyledName = styled(Typography)({
  fontFamily: "Nunito",
  fontWeight: 600,
  fontSize: "10px",
  textTransform: "uppercase",
  color: "#383838",
});

const StyledValue = styled(Box)({
  fontFamily: "Nunito",
  fontWeight: 400,
  fontSize: "15px",
  color: "#595959",
  lineHeight: "18px",
  background: "#EAF1F2",
  padding: "0 4px",
});

type Props = {
  normalized: boolean;
} & TooltipProps<number, SeriesLabel>;

const BarTooltip: FC<Props> = ({ active, payload, label, normalized }: Props) => {
  if (!active || !label || !payload?.length) {
    return null;
  }

  const formatter = new Intl.NumberFormat("en-US", {
    style: normalized ? "percent" : "decimal",
    minimumFractionDigits: normalized ? 2 : 0,
  });
  const total: number = useMemo(
    () => payload.reduce((acc, item) => acc + item.value, 0),
    [payload]
  );
  const normalizedPayload: Props["payload"] = useMemo(
    () =>
      payload.map((item) => ({
        ...item,
        value: normalized && total > 0 ? item.value / total : item.value,
      })),
    [payload, normalized, total]
  );

  return (
    <StyledContainer>
      <StyledTitle>{label.replace(/_/g, " ")}</StyledTitle>
      {normalizedPayload.map((item) => (
        <StyledKeyStack key={item.name} direction="row" alignItems="center" columnGap="6px">
          <StyledColorCode background={item.color} />
          <StyledName>{item.name}</StyledName>
          <StyledValue>{formatter.format(item.value || 0)}</StyledValue>
        </StyledKeyStack>
      ))}
    </StyledContainer>
  );
};

export default memo(BarTooltip, isEqual);
