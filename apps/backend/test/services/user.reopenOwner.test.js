const { USER } = require("../../crdc-datahub-database-drivers/constants/user-constants");
const USER_PERMISSION_CONSTANTS = require("../../crdc-datahub-database-drivers/constants/user-permission-constants");
const { UserService } = require("../../services/user");

describe("UserService._buildReopenListUsersMatch", () => {
  it("filters to active User/Submitter with create permission", () => {
    expect(UserService._buildReopenListUsersMatch()).toEqual({
      role: [USER.ROLES.USER, USER.ROLES.SUBMITTER],
      userStatus: USER.STATUSES.ACTIVE,
      permissions: [
        USER_PERMISSION_CONSTANTS.SUBMISSION_REQUEST.CREATE,
        "submission_request:create:all",
        "submission_request:create:own",
      ],
    });
  });
});
