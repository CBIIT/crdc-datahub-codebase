import { FC, useEffect } from "react";
import { useLocation } from "react-router-dom";

import reportWebVitals from "../../reportWebVitals";
import { useAnalytics } from "../Contexts/AnalyticsContext";

/**
 * A HOC to wrap a component with Google Analytics page change tracking
 *
 * Recommended usage:
 * - Layouts
 *
 * @param Component The component to wrap
 * @returns Original component with Google Analytics tracking
 */
const withAnalytics = (Component: FC) => (props) => {
  const { ReactGA } = useAnalytics();
  const location = useLocation();

  useEffect(() => {
    ReactGA.send({
      hitType: "pageview",
      page: location.pathname + location.search,
      title: document.title,
    });

    reportWebVitals(({ id, name, value }) => {
      ReactGA.event({
        category: "Web Vitals",
        label: id,
        action: name,
        value,
        nonInteraction: true,
      });
    });
  }, [document.title]);

  return <Component {...props} />;
};

export default withAnalytics;
