import { Alert, AlertProps, Container, styled } from "@mui/material";
import { memo } from "react";
import { useLocation } from "react-router-dom";

const StyledAlert = styled(Alert)({
  margin: "16px auto 0",
  padding: "16px",
});

type Props = {
  error?: string;
} & AlertProps;

/**
 * Displays an alert with an error message if a location state alert exists or
 * an error prop is provided
 *
 * @returns The MUI alert component or null if no error is present
 */
const FormAlert = ({ error, ...rest }: Props) => {
  const { state } = useLocation();

  if (!state?.alert && !error) {
    return null;
  }

  return (
    <Container maxWidth="xl">
      <StyledAlert severity="error" {...rest}>
        {state?.error || error}
      </StyledAlert>
    </Container>
  );
};

export default memo<Props>(FormAlert);
