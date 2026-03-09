import { useLocation } from "react-router-dom";

import SuspenseLoader from "../../components/SuspenseLoader";
import env from "../../env";
import usePageTitle from "../../hooks/usePageTitle";

/**
 * Handles the NIH SSO redirect to the login page.
 *
 * @returns The LoginController component
 */
const LoginController = () => {
  usePageTitle("Login");

  const { state } = useLocation();

  const params = new URLSearchParams({
    client_id: env.VITE_NIH_CLIENT_ID,
    redirect_uri: env.VITE_NIH_REDIRECT_URL,
    response_type: "code",
    scope: "openid email profile",
    prompt: "login",
  });

  if (typeof state?.redirectState === "string" && !!state.redirectState) {
    params.append("state", state.redirectState);
  }

  window.location.href = `${env.VITE_NIH_AUTHORIZE_URL}?${params?.toString()}`;

  return <SuspenseLoader data-testid="login-flow-loader" fullscreen />;
};

export default LoginController;
