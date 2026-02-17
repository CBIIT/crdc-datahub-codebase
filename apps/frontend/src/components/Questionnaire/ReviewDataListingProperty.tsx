import { Grid, Stack, styled } from "@mui/material";
import { CSSProperties, FC, useMemo, useState } from "react";

export const StyledLabel = styled("span")(() => ({
  color: "#000000",
  fontSize: "13px",
  fontFamily: "'Nunito', 'Rubik', sans-serif",
  fontWeight: 700,
  lineHeight: "19.6px",
  letterSpacing: "0.52px",
  textTransform: "uppercase",
}));

export const StyledValue = styled("span")(() => ({
  color: "#595959",
  fontSize: "16px",
  fontFamily: "'Nunito', 'Rubik', sans-serif",
  fontWeight: 400,
  lineHeight: "19.6px",
  overflowWrap: "anywhere",
  wordBreak: "break-word",
}));

const StyledLabelWrapper = styled(Stack)(() => ({
  display: "inline-flex",
  marginRight: "22px",
  minWidth: "fit-content",
}));

const StyledGrid = styled(Grid)(() => ({
  marginBottom: "16px",
}));

type GridWidth = 2 | 4 | 6 | 8 | 10 | 12;

type Props = {
  idPrefix: string;
  label?: string | JSX.Element;
  value: string | JSX.Element | string[];
  valuePlacement?: "right" | "bottom";
  isList?: boolean;
  gridWidth?: GridWidth;
  hideLabel?: boolean;
  textTransform?: CSSProperties["textTransform"];
  delimiter?: string;
};

const ReviewDataListingProperty: FC<Props> = ({
  idPrefix,
  label,
  value,
  valuePlacement = "right",
  isList,
  gridWidth,
  textTransform = "uppercase",
  hideLabel = false,
  delimiter = ",",
}) => {
  const [isMultiple, setIsMultiple] = useState(false);

  const displayValues: string[] = useMemo(() => {
    if (!isList || (typeof value !== "string" && !Array.isArray(value))) {
      return [];
    }
    if (typeof value === "string") {
      const split = value
        .split(delimiter)
        .map((item) => item.trim())
        .filter((item) => item.length);
      if (split.length > 1) {
        setIsMultiple(true);
      }
      return split;
    }
    setIsMultiple(true);
    return value?.map((item) => item.trim()).filter((item) => item.length);
  }, [value, isList, delimiter]);

  return (
    <StyledGrid md={gridWidth || 6} xs={12} item>
      <Stack
        direction={valuePlacement === "bottom" ? "column" : "row"}
        alignItems="start"
        justifyContent="start"
      >
        {label && (
          <StyledLabelWrapper
            direction="row"
            alignItems="center"
            sx={{ marginBottom: valuePlacement === "bottom" ? "3px" : 0 }}
          >
            <StyledLabel id={idPrefix.concat(`-property-label`)} sx={{ textTransform }}>
              {!hideLabel && label}
            </StyledLabel>
          </StyledLabelWrapper>
        )}
        <Stack
          display={valuePlacement === "right" ? "inline-flex" : "flex"}
          direction={isMultiple ? "column" : "row"}
          alignItems={isMultiple ? "flex-start" : "center"}
          spacing={1}
        >
          {isList ? (
            displayValues?.map((val, idx) => (
              <StyledValue
                // eslint-disable-next-line react/no-array-index-key
                key={`${val}_${idx}_${new Date().getTime()}`}
                id={idPrefix.concat(`-property-value-${idx}`)}
              >
                {" "}
                {val}
              </StyledValue>
            ))
          ) : (
            <StyledValue id={idPrefix.concat(`-property-value`)}>{value}</StyledValue>
          )}
        </Stack>
      </Stack>
    </StyledGrid>
  );
};

export default ReviewDataListingProperty;
