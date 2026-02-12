import React from "react";
import { Navigate, useParams } from "react-router-dom";

import { Status, useAuthContext } from "../../components/Contexts/AuthContext";
import SuspenseLoader from "../../components/SuspenseLoader";
import { hasPermission } from "../../config/AuthPermissions";

import ListView from "./ListView";
import ProfileView from "./ProfileView";

type Props = {
  type: "users" | "profile";
};

/**
 * Renders the correct view based on the URL and permissions-tier
 *
 * Implementation details:
 *
 * There are two types `ProfileView` "views": `users` and `profile`,
 * and based on the view type, the authenticated user will see slightly different content.
 *
 *   - `users` aka Edit User view:
 *     - allows editing `Role`, `Status`, and `Organization` for Admins,
 *       but allows Org Owners to only see that profile.
 *   - `profile` aka User Profile view:
 *     - is only shown to the authenticated user, and allows editing
 *       of `First Name` and `Last Name` only
 *
 * Most of the underlying logic is the same, hence the combination of
 * these two views into a single component. There's also a `ListView`
 * which is shown to Admins and Org Owners, and allows them to see
 * the list of users.
 *
 * @param type The type of view to render
 * @returns The UserController component
 */
const UserController = ({ type }: Props) => {
  const { userId } = useParams();
  const { user, status: authStatus } = useAuthContext();
  const { _id } = user || {};

  if (authStatus === Status.LOADING) {
    return <SuspenseLoader data-testid="users-suspense-loader" />;
  }

  // Accounts can only view their own "profile", redirect to it
  if (
    (type === "profile" && userId !== _id) ||
    (type === "users" && !hasPermission(user, "user", "manage"))
  ) {
    return <Navigate to={`/profile/${_id}`} />;
  }

  return userId ? <ProfileView _id={userId} viewType={type} /> : <ListView />;
};

export default UserController;
