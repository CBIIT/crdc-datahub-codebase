import { Alert } from "@mui/material";
import React, { Component } from "react";

type Props = {
  /**
   * The error message to display if an error occurs.
   *
   * @default "Error loading component."
   */
  errorMessage?: string;
  /**
   * The children to render.
   */
  children: React.ReactNode;
};

type State = {
  /**
   * Whether an error has occurred in the children.
   * Displays `errorMessage` if true.
   *
   * @default false
   */
  hasError: boolean;
};

/**
 * A error boundary component that catches errors in its children
 * and displays a fallback UI.
 *
 * @param children Component Children
 * @param [errorMessage] The error message to display.
 * @returns The error boundary component
 */
class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  render() {
    const { children, errorMessage } = this.props;
    const { hasError } = this.state;

    if (hasError) {
      return (
        <Alert sx={{ m: 3, p: 2 }} severity="error" data-testid="error-boundary-alert">
          {errorMessage || "Error loading component."}
        </Alert>
      );
    }

    return children;
  }
}

export default ErrorBoundary;
