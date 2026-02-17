import { ThemeProvider } from "@mui/material";
import { render, RenderOptions } from "@testing-library/react";
import React from "react";

import theme from "../theme/testTheme";

const AllTheProviders = ({ children }) => <ThemeProvider theme={theme}>{children}</ThemeProvider>;

const customRender = (ui: React.ReactElement, options?: RenderOptions) =>
  render(ui, { wrapper: AllTheProviders, ...options });

// re-export everything
export * from "@testing-library/react";

// override render method
export { customRender as render };
