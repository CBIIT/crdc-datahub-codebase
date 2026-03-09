import { FC, ReactElement } from "react";
import { Navigate } from "react-router-dom";

import { useAuthContext } from "../Contexts/AuthContext";

export type RequireAuthProps = {
  /**
   * The component to be rendered if the user is authenticated.
   */
  component: ReactElement;
  /**
   * The path that the user should return to once authenticated.
   */
  redirectPath: string;
  /**
   * The name of the page that `redirectPath` refers to.
   */
  redirectName: string;
};

/**
 * Provides a basic authentication wrapper for components
 * that require a user to be logged in.
 *
 * @return React.FC<WithAuthProps>
 */
const RequireAuth: FC<RequireAuthProps> = ({
  component,
  redirectPath,
  redirectName,
}: RequireAuthProps) => {
  const { isLoggedIn } = useAuthContext();

  return isLoggedIn ? (
    component
  ) : (
    <Navigate to="/" state={{ path: redirectPath, name: redirectName }} replace />
  );
};

export default RequireAuth;
