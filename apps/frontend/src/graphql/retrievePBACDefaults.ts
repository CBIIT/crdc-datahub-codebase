import gql from "graphql-tag";

export const query = gql`
  query retrievePBACDefaults($roles: [String!]!) {
    retrievePBACDefaults(roles: $roles) {
      role
      permissions {
        _id
        group
        name
        inherited
        order
        checked
        disabled
      }
      notifications {
        _id
        group
        name
        inherited @client
        order
        checked
        disabled
      }
    }
  }
`;

export type Input = {
  roles: Array<UserRole | "All">;
};

export type Response = {
  retrievePBACDefaults: Array<{
    /**
     * The role that the defaults apply to.
     */
    role: UserRole;
    /**
     * The default permissions for the role.
     */
    permissions: PBACDefault<AuthPermissions>[];
    /**
     * The default notifications for the role.
     */
    notifications: PBACDefault<AuthNotifications>[];
  }>;
};
