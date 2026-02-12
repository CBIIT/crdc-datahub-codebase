import { pbacDefaultFactory } from "@/factories/auth/PBACDefaultFactory";
import { userFactory } from "@/factories/auth/UserFactory";

import * as utils from "./profileUtils";

describe("formatIDP cases", () => {
  it("should format NIH IDP", () => {
    expect(utils.formatIDP("nih")).toBe("NIH");
  });

  it("should format Login.gov IDP", () => {
    expect(utils.formatIDP("login.gov")).toBe("Login.gov");
  });

  it("should ignore case", () => {
    expect(utils.formatIDP("LoGiN.gOv" as User["IDP"])).toBe("Login.gov");
  });

  it("should return the unmodified IDP if it is not a known service", () => {
    expect(utils.formatIDP("unknown" as User["IDP"])).toBe("unknown");
  });

  it("should invalid input without crashing", () => {
    expect(utils.formatIDP(undefined as User["IDP"])).toBe("");
    expect(utils.formatIDP(null as User["IDP"])).toBe("");
    expect(utils.formatIDP({} as User["IDP"])).toBe("");
  });
});

describe("userToCollaborator cases", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should convert a full user object to a collaborator with default permission", () => {
    const user: Partial<User> = {
      _id: "user-1",
      firstName: "John",
      lastName: "Doe",
    };

    const collaborator = utils.userToCollaborator(user);

    expect(collaborator).toEqual({
      collaboratorID: "user-1",
      collaboratorName: "Doe, John",
      permission: "Can Edit",
    });
  });

  it("should use provided permission", () => {
    const user: Partial<User> = {
      _id: "user-1",
      firstName: "John",
      lastName: "Doe",
    };

    const collaborator = utils.userToCollaborator(user, "Can Edit");

    expect(collaborator.permission).toBe("Can Edit");
  });

  it("should handle missing firstName", () => {
    const user: Partial<User> = {
      _id: "user-1",
      lastName: "Doe",
    };

    const collaborator = utils.userToCollaborator(user);

    expect(collaborator.collaboratorName).toBe("Doe, ");
  });

  it("should handle missing lastName", () => {
    const user: Partial<User> = {
      _id: "user-1",
      firstName: "John",
    };

    const collaborator = utils.userToCollaborator(user);

    expect(collaborator.collaboratorName).toBe(", John");
  });

  it("should handle missing _id", () => {
    const user: Partial<User> = {
      firstName: "John",
      lastName: "Doe",
    };

    const collaborator = utils.userToCollaborator(user);

    expect(collaborator.collaboratorID).toBeUndefined();
  });

  it("should handle null user", () => {
    const collaborator = utils.userToCollaborator(null);

    expect(collaborator).toEqual({
      collaboratorID: undefined,
      collaboratorName: ", ",
      permission: "Can Edit",
    });
  });

  it("should handle undefined user", () => {
    const collaborator = utils.userToCollaborator(undefined);

    expect(collaborator).toEqual({
      collaboratorID: undefined,
      collaboratorName: ", ",
      permission: "Can Edit",
    });
  });

  it("should handle user with empty properties", () => {
    const user: Partial<User> = {
      _id: "",
      firstName: "",
      lastName: "",
    };

    const collaborator = utils.userToCollaborator(user);

    expect(collaborator).toEqual({
      collaboratorID: "",
      collaboratorName: ", ",
      permission: "Can Edit",
    });
  });

  it("should handle user with additional properties", () => {
    const user: Partial<User> = {
      _id: "user-1",
      firstName: "John",
      lastName: "Doe",
      email: "john.doe@example.com",
      role: "Admin",
    };

    const collaborator = utils.userToCollaborator(user);

    expect(collaborator).toEqual({
      collaboratorID: "user-1",
      collaboratorName: "Doe, John",
      permission: "Can Edit",
    });
  });
});

describe("columnizePBACGroups cases", () => {
  it("should return empty array for invalid input", () => {
    expect(utils.columnizePBACGroups([])).toEqual([]);
    expect(utils.columnizePBACGroups(null)).toEqual([]);
    expect(utils.columnizePBACGroups(undefined)).toEqual([]);
  });

  it("should group PBACDefaults into columns using the default colCount", () => {
    const groups = ["A", "A", "B", "B", "C", "C"];
    const pbacDefaults: PBACDefault[] = pbacDefaultFactory.build(groups.length, (index) => ({
      name: `${index + 1}`,
      group: groups[index],
    }));

    const columnized = utils.columnizePBACGroups(pbacDefaults);

    expect(columnized).toHaveLength(3);
    expect(columnized[0]).toHaveLength(1);
    expect(columnized[1]).toHaveLength(1);
    expect(columnized[2]).toHaveLength(1);

    expect(columnized[0][0].data).toEqual([
      pbacDefaultFactory.build({ name: "1", group: "A" }),
      pbacDefaultFactory.build({ name: "2", group: "A" }),
    ]);

    expect(columnized[1][0].data).toEqual([
      pbacDefaultFactory.build({ name: "3", group: "B" }),
      pbacDefaultFactory.build({ name: "4", group: "B" }),
    ]);

    expect(columnized[2][0].data).toEqual([
      pbacDefaultFactory.build({ name: "5", group: "C" }),
      pbacDefaultFactory.build({ name: "6", group: "C" }),
    ]);
  });

  it("should group PBACDefaults into columns using a custom colCount", () => {
    const groups = ["A", "B", "C", "D", "E", "F"];
    const pbacDefaults: PBACDefault[] = pbacDefaultFactory.build(groups.length, (index) => ({
      name: `${index + 1}`,
      group: groups[index],
    }));

    const columnized = utils.columnizePBACGroups(pbacDefaults, 2);

    expect(columnized).toHaveLength(2);
    expect(columnized[0]).toHaveLength(1);
    expect(columnized[1]).toHaveLength(5);
  });

  it("should handle a higher colCount than the number of groups", () => {
    const groups = ["A", "B", "C"];
    const pbacDefaults: PBACDefault[] = pbacDefaultFactory.build(groups.length, (index) => ({
      name: `${index + 1}`,
      group: groups[index],
    }));

    const columnized = utils.columnizePBACGroups(pbacDefaults, 10);

    expect(columnized).toHaveLength(3);
    expect(columnized[0]).toHaveLength(1);
    expect(columnized[1]).toHaveLength(1);
    expect(columnized[2]).toHaveLength(1);
  });

  it("should handle PBACDefaults with no group", () => {
    const groups = ["A", "B", ""];
    const pbacDefaults: PBACDefault[] = pbacDefaultFactory.build(groups.length, (index) => ({
      name: `${index + 1}`,
      group: groups[index],
    }));

    const columnized = utils.columnizePBACGroups(pbacDefaults);

    expect(columnized).toHaveLength(3);
    expect(columnized[0]).toHaveLength(1);
    expect(columnized[1]).toHaveLength(1);
    expect(columnized[2]).toHaveLength(1);

    expect(columnized[2][0].data).toEqual([pbacDefaultFactory.build({ name: "3", group: "" })]);
  });

  it("should fallback to an empty group name if the PBACDefault has an invalid group name", () => {
    const groups = [
      "valid",
      undefined,
      null,
      3 as unknown as string,
      { Obj: "yes" } as unknown as string,
    ];
    const pbacDefaults: PBACDefault[] = pbacDefaultFactory.build(groups.length, (index) => ({
      name: `${index + 1}`,
      group: groups[index],
    }));

    const columnized = utils.columnizePBACGroups(pbacDefaults, 10); // Set to 10 to ensure all groups COULD go to their own column

    expect(columnized).toHaveLength(2);
    expect(columnized[0]).toHaveLength(1);
    expect(columnized[1]).toHaveLength(1); // 1 Group for all invalid

    expect(columnized[0][0].data).toEqual([
      pbacDefaultFactory.build({ name: "1", group: "valid" }),
    ]);
    expect(columnized[1][0].name).toBe("");
    expect(columnized[1][0].data).toHaveLength(4); // All invalid groups are together
    expect(columnized[1][0].data).toEqual([
      pbacDefaults[1],
      pbacDefaults[2],
      pbacDefaults[3],
      pbacDefaults[4],
    ]);
  });

  it("should sort the groups in the order: Submission Request, Data Submission, Admin, Miscellaneous", () => {
    const pbacDefaults: PBACDefault[] = [
      pbacDefaultFactory.build({ name: "6", group: "Random Group 1" }), // 5
      pbacDefaultFactory.build({ name: "1", group: "Data Submission" }), // 2
      pbacDefaultFactory.build({ name: "3", group: "Miscellaneous" }), // 4
      pbacDefaultFactory.build({ name: "2", group: "Admin" }), // 3
      pbacDefaultFactory.build({ name: "4", group: "Submission Request" }), // 1
    ];

    const columnized = utils.columnizePBACGroups(pbacDefaults, 4);

    expect(columnized).toHaveLength(4);
    expect(columnized[0]).toHaveLength(1);
    expect(columnized[1]).toHaveLength(1);
    expect(columnized[2]).toHaveLength(1);
    expect(columnized[3]).toHaveLength(2);

    expect(columnized[0][0].data).toEqual([
      pbacDefaultFactory.build({ name: "4", group: "Submission Request" }),
    ]);
    expect(columnized[1][0].data).toEqual([
      pbacDefaultFactory.build({ name: "1", group: "Data Submission" }),
    ]);
    expect(columnized[2][0].data).toEqual([
      pbacDefaultFactory.build({ name: "2", group: "Admin" }),
    ]);
    expect(columnized[3][0].data).toEqual([
      pbacDefaultFactory.build({ name: "3", group: "Miscellaneous" }),
    ]);
    expect(columnized[3][1].data).toEqual([
      pbacDefaultFactory.build({ name: "6", group: "Random Group 1" }),
    ]);
  });

  it("should sort the options within each group by their order", () => {
    const pbacDefaults: PBACDefault[] = [
      pbacDefaultFactory.build({ name: "entry 1", group: "Group01", order: 5 }),
      pbacDefaultFactory.build({ name: "entry 2", group: "Group01", order: 1 }),
      pbacDefaultFactory.build({ name: "entry 3", group: "Group01", order: 3 }),
      pbacDefaultFactory.build({ name: "entry 4", group: "Group01", order: 2 }),
      pbacDefaultFactory.build({ name: "entry 5", group: "Group01", order: 4 }),
    ];

    const columnized = utils.columnizePBACGroups(pbacDefaults);
    expect(columnized[0][0].data).toEqual([
      pbacDefaultFactory.build({ name: "entry 2", group: "Group01", order: 1 }),
      pbacDefaultFactory.build({ name: "entry 4", group: "Group01", order: 2 }),
      pbacDefaultFactory.build({ name: "entry 3", group: "Group01", order: 3 }),
      pbacDefaultFactory.build({ name: "entry 5", group: "Group01", order: 4 }),
      pbacDefaultFactory.build({ name: "entry 1", group: "Group01", order: 5 }),
    ]);
  });

  it("should leave the order unchanged if 'order' is null", () => {
    const pbacDefaults: PBACDefault[] = [
      pbacDefaultFactory.build({ name: "entry 1", group: "Group01", order: null }),
      pbacDefaultFactory.build({ name: "entry 2", group: "Group01", order: null }),
      pbacDefaultFactory.build({ name: "entry 3", group: "Group01", order: null }),
    ];

    const columnized = utils.columnizePBACGroups(pbacDefaults);
    expect(columnized[0][0].data).toEqual([
      pbacDefaultFactory.build({ name: "entry 1", group: "Group01", order: null }),
      pbacDefaultFactory.build({ name: "entry 2", group: "Group01", order: null }),
      pbacDefaultFactory.build({ name: "entry 3", group: "Group01", order: null }),
    ]);
  });
});

describe("cleanPermissionKeys", () => {
  it("removes extra segments and deduplicates permission keys", () => {
    const raw = [
      "study:manage",
      "study:create",
      "study:create:scope:value",
      "user:view:role:admin",
      "study:manage",
    ];
    const result = utils.cleanPermissionKeys(raw);
    expect(result).toEqual(["study:manage", "study:create", "user:view"]);
  });

  it("filters out malformed permission strings", () => {
    const raw = ["bad", "", "foo:", ":bar", "entity:action", "entity:action:extra"];
    const result = utils.cleanPermissionKeys(raw);
    expect(result).toEqual(["entity:action"]);
  });

  it("returns an empty array if input is empty or undefined", () => {
    expect(utils.cleanPermissionKeys([])).toEqual([]);
    expect(utils.cleanPermissionKeys(undefined)).toEqual([]);
  });
});

describe("getUserPermissionKey", () => {
  it("returns the full raw permission string when it matches the base key", () => {
    const user = {
      permissions: [
        "submission_request:submit:role:submitter+admin",
        "submission_request:submit:own",
        "data_submission:create",
      ],
    } as User;

    expect(utils.getUserPermissionKey(user, "submission_request:submit")).toBe(
      "submission_request:submit:role:submitter+admin"
    );
  });

  it("returns the first matching permission if there are multiples", () => {
    const user = {
      permissions: [
        "data_submission:create:scope:X" as AuthPermissions,
        "data_submission:create:scope:Y" as AuthPermissions,
      ],
    } as User;

    expect(utils.getUserPermissionKey(user, "data_submission:create")).toBe(
      "data_submission:create:scope:X"
    );
  });

  it("returns undefined when nothing matches", () => {
    const user = {
      permissions: ["foo:bar" as AuthPermissions, "baz:qux" as AuthPermissions],
    } as User;

    expect(utils.getUserPermissionKey(user, "data_submission:create")).toBeUndefined();
  });

  it("returns undefined when permissions is empty or missing", () => {
    expect(utils.getUserPermissionKey({ permissions: [] } as User, "a:b")).toBeUndefined();
    expect(utils.getUserPermissionKey({} as User, "a:b")).toBeUndefined();
  });
});

describe("getUserPermissionExtensions", () => {
  it("splits extensions into groups of values", () => {
    const permission = "entity:action:scope:alpha+beta:region:us+eu" as AuthPermissions;
    const groups = utils.getUserPermissionExtensions(permission);

    expect(groups).toEqual([["scope"], ["alpha", "beta"], ["region"], ["us", "eu"]]);
  });

  it("honors custom `startAt` parameter", () => {
    const permission = "e:a:one:two+three:four" as AuthPermissions;
    const groups = utils.getUserPermissionExtensions(permission, 3);

    expect(groups).toEqual([["two", "three"], ["four"]]);
  });

  it("returns an empty array when the 'startAt' is greater than or equal to than extension length", () => {
    const permission = "entity:action:one:two" as AuthPermissions;

    expect(utils.getUserPermissionExtensions(permission, 10)).toEqual([]);
  });

  it("returns an empty array when there are no extensions", () => {
    const permission = "entity:action" as AuthPermissions;

    expect(utils.getUserPermissionExtensions(permission)).toEqual([]);
  });

  it("should handle negative 'startAt' parameters", () => {
    const permission = "entity:action:one:two:three:four:five" as AuthPermissions;

    expect(utils.getUserPermissionExtensions(permission, -2)).toEqual([["four"], ["five"]]);
  });
});

describe("isUserMatch cases", () => {
  const baseUser = userFactory.build({
    firstName: "Jane",
    lastName: "Smith",
    email: "jane.smith@example.com",
  });

  it("should return false when user is null or undefined", () => {
    expect(utils.isUserMatch(null, "john")).toBe(false);
    expect(utils.isUserMatch(undefined, "john")).toBe(false);
  });

  it("should return true when filter is null, undefined, empty or whitespace", () => {
    expect(utils.isUserMatch(baseUser, null)).toBe(true);
    expect(utils.isUserMatch(baseUser, undefined)).toBe(true);
    expect(utils.isUserMatch(baseUser, "")).toBe(true);
    expect(utils.isUserMatch(baseUser, "   ")).toBe(true);
  });

  it("should match by first name (partial, case-insensitive)", () => {
    expect(utils.isUserMatch(baseUser, "jan")).toBe(true);
  });

  it("should match by last name (partial, case-insensitive)", () => {
    expect(utils.isUserMatch(baseUser, "smi")).toBe(true);
  });

  it("should match by email  (partial, case-insensitive)", () => {
    expect(utils.isUserMatch(baseUser, "smith@exa")).toBe(true);
  });

  it("should match by 'last, first' format (partial, case-insensitive)", () => {
    expect(utils.isUserMatch(baseUser, "smith, j")).toBe(true);
    expect(utils.isUserMatch(baseUser, "smith, jane")).toBe(true);
  });

  it("should not match by ',' when first name and last name are missing or empty space", () => {
    expect(utils.isUserMatch(userFactory.build({ firstName: "", lastName: "" }), ",")).toBe(false);
    expect(utils.isUserMatch(userFactory.build({ firstName: "   ", lastName: "   " }), ",")).toBe(
      false
    );
    expect(utils.isUserMatch(userFactory.build({ firstName: null, lastName: null }), ",")).toBe(
      false
    );
    expect(
      utils.isUserMatch(userFactory.build({ firstName: undefined, lastName: undefined }), ",")
    ).toBe(false);
  });

  it("should match by 'first last' format (partial, case-insensitive)", () => {
    expect(utils.isUserMatch(baseUser, "jane s")).toBe(true);
    expect(utils.isUserMatch(baseUser, "jane smith")).toBe(true);
  });

  it("should match by 'last first' format (partial, case-insensitive)", () => {
    expect(utils.isUserMatch(baseUser, "smith j")).toBe(true);
    expect(utils.isUserMatch(baseUser, "smith jane")).toBe(true);
  });

  it("should return false when query does not match any user field", () => {
    expect(utils.isUserMatch(baseUser, "nonexistent")).toBe(false);
    expect(utils.isUserMatch(baseUser, "john smith")).toBe(false);
    expect(utils.isUserMatch(baseUser, "smith john")).toBe(false);
    expect(utils.isUserMatch(baseUser, "smith, john")).toBe(false);
  });
});
