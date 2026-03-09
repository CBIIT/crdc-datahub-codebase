import { ApolloProvider } from "@apollo/client";
import React from "react";
import ReactDOM from "react-dom/client";

import App from "./App";
import client from "./client";
import { AnalyticsProvider } from "./components/Contexts/AnalyticsContext";
import { AuthProvider } from "./components/Contexts/AuthContext";
import env from "./env";

if (env.VITE_DEV_TIER === "dev" || env.VITE_DEV_TIER === "dev2") {
  import("@axe-core/react").then(({ default: axe }) => axe(React, ReactDOM, 1500));
}

const root = ReactDOM.createRoot(document.getElementById("root") as HTMLElement);

root.render(
  <React.StrictMode>
    <ApolloProvider client={client}>
      <AuthProvider>
        <AnalyticsProvider GA_MEASUREMENT_ID={env.VITE_GA_TRACKING_ID}>
          <App />
        </AnalyticsProvider>
      </AuthProvider>
    </ApolloProvider>
  </React.StrictMode>
);
