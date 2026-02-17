import { authCtxStateFactory } from "@/factories/auth/AuthCtxStateFactory";
import { userFactory } from "@/factories/auth/UserFactory";

import * as Auth from "../components/Contexts/AuthContext";
import { renderHook } from "../test-utils";

import useProfileFields, { FieldState } from "./useProfileFields";

describe("Users View", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // NOTE: This is mostly a sanity check to ensure we're ignoring the signed-in user's role
  it.each<UserRole>(["Admin", "Data Commons Personnel", "Submitter", "User"])(
    "should return UNLOCKED for role, status, and PBAC when viewing users with management permission (%s)",
    (role) => {
      const user = userFactory.build({ _id: "User-A", role, permissions: ["user:manage"] });
      const profileOf: Pick<User, "_id" | "role"> = userFactory
        .pick(["_id", "role"])
        .build({ _id: "I-Am-User-B", role: "Submitter" });

      vi.spyOn(Auth, "useAuthContext").mockReturnValue(authCtxStateFactory.build({ user }));

      const { result } = renderHook(() => useProfileFields(profileOf, "users"));

      expect(result.current.role).toBe("UNLOCKED");
      expect(result.current.userStatus).toBe("UNLOCKED");
      expect(result.current.permissions).toBe("UNLOCKED");
      expect(result.current.notifications).toBe("UNLOCKED");
    }
  );

  it("should return READ_ONLY for all standard fields when a Submitter views the page", () => {
    const user = userFactory.build({ _id: "User-A", role: "Submitter" });
    const profileOf: Pick<User, "_id" | "role"> = userFactory
      .pick(["_id", "role"])
      .build({ _id: "I-Am-User-B", role: "Submitter" });

    vi.spyOn(Auth, "useAuthContext").mockReturnValue(authCtxStateFactory.build({ user }));

    const { result } = renderHook(() => useProfileFields(profileOf, "users"));

    expect(result.current.firstName).toBe("READ_ONLY");
    expect(result.current.lastName).toBe("READ_ONLY");
    expect(result.current.role).toBe("READ_ONLY");
    expect(result.current.userStatus).toBe("READ_ONLY");
  });

  it.each<[FieldState, UserRole]>([
    ["HIDDEN", "User"],
    ["HIDDEN", "Data Commons Personnel"],
    ["HIDDEN", "Admin"],
    ["HIDDEN", "fake role" as UserRole],
    // NOTE: All of the following are assigned to studies
    ["UNLOCKED", "Federal Lead"],
    ["UNLOCKED", "Submitter"],
  ])("should return %s for the studies field on the users page for role %s", (state, role) => {
    const user = userFactory.build({ _id: "User-A", role: "Admin", permissions: ["user:manage"] });
    const profileOf: Pick<User, "_id" | "role"> = userFactory
      .pick(["_id", "role"])
      .build({ _id: "I-Am-User-B", role });

    vi.spyOn(Auth, "useAuthContext").mockReturnValue(authCtxStateFactory.build({ user }));

    const { result } = renderHook(() => useProfileFields(profileOf, "users"));

    expect(result.current.studies).toBe(state);
  });

  it.each<[FieldState, UserRole]>([
    ["HIDDEN", "User"],
    ["HIDDEN", "Data Commons Personnel"],
    ["HIDDEN", "Admin"],
    ["HIDDEN", "fake role" as UserRole],
    ["HIDDEN", "Federal Lead"],
    ["UNLOCKED", "Submitter"],
  ])("should return %s for the institution field on the users page for role %s", (state, role) => {
    const user = userFactory.build({ _id: "User-A", role: "Admin", permissions: ["user:manage"] });
    const profileOf: Pick<User, "_id" | "role"> = userFactory
      .pick(["_id", "role"])
      .build({ _id: "I-Am-User-B", role });

    vi.spyOn(Auth, "useAuthContext").mockReturnValue(authCtxStateFactory.build({ user }));

    const { result } = renderHook(() => useProfileFields(profileOf, "users"));

    expect(result.current.institution).toBe(state);
  });

  it.each<[FieldState, UserRole]>([
    ["HIDDEN", "User"],
    ["HIDDEN", "Submitter"],
    ["HIDDEN", "Federal Lead"],
    ["HIDDEN", "Admin"],
    ["HIDDEN", "fake role" as UserRole],
    ["UNLOCKED", "Data Commons Personnel"], // NOTE: accepts Data Commons
  ])("should return %s for the dataCommons field on the users page for role %s", (state, role) => {
    const user = userFactory.build({ _id: "User-A", role: "Admin", permissions: ["user:manage"] });
    const profileOf: Pick<User, "_id" | "role"> = userFactory
      .pick(["_id", "role"])
      .build({ _id: "I-Am-User-B", role });

    vi.spyOn(Auth, "useAuthContext").mockReturnValue(authCtxStateFactory.build({ user }));

    const { result } = renderHook(() => useProfileFields(profileOf, "users"));

    expect(result.current.dataCommons).toBe(state);
  });

  it("should always return READ_ONLY for the firstName and lastName fields on the users page", () => {
    const user = userFactory.build({ _id: "User-A", role: "Admin" });
    const profileOf: Pick<User, "_id" | "role"> = userFactory
      .pick(["_id", "role"])
      .build({ _id: "I-Am-User-B", role: "Submitter" });

    vi.spyOn(Auth, "useAuthContext").mockReturnValue(authCtxStateFactory.build({ user }));

    const { result } = renderHook(() => useProfileFields(profileOf, "users"));

    expect(result.current.firstName).toBe("READ_ONLY");
    expect(result.current.lastName).toBe("READ_ONLY");
  });

  it.each<UserRole>(["Federal Lead"])(
    "should return UNLOCKED for all fields except the role field on the users page for role %s modifying a Federal Lead",
    (role) => {
      const user = userFactory.build({ _id: "User-A", role, permissions: ["user:manage"] });
      const profileOf: Pick<User, "_id" | "role"> = userFactory
        .pick(["_id", "role"])
        .build({ _id: "User-A", role: "Federal Lead" });

      vi.spyOn(Auth, "useAuthContext").mockReturnValue(authCtxStateFactory.build({ user }));

      const { result } = renderHook(() => useProfileFields(profileOf, "users"));

      expect(result.current.role).toBe("DISABLED");
      expect(result.current.userStatus).toBe("UNLOCKED");
      expect(result.current.permissions).toBe("UNLOCKED");
      expect(result.current.notifications).toBe("UNLOCKED");
    }
  );

  it.each<UserRole>(["Admin", "Data Commons Personnel", "Federal Lead", "Submitter", "User"])(
    "should return defaults for all fields on the users page for role %s when they do not have the user:manage permission",
    (role) => {
      const user = userFactory.build({ _id: "User-A", role, permissions: [] });
      const profileOf: Pick<User, "_id" | "role"> = userFactory
        .pick(["_id", "role"])
        .build({ _id: "User-A", role: "Federal Lead" });

      vi.spyOn(Auth, "useAuthContext").mockReturnValue(authCtxStateFactory.build({ user }));

      const { result } = renderHook(() => useProfileFields(profileOf, "users"));

      expect(result.current.firstName).toBe("READ_ONLY");
      expect(result.current.lastName).toBe("READ_ONLY");
      expect(result.current.role).toBe("READ_ONLY");
      expect(result.current.userStatus).toBe("READ_ONLY");
      expect(result.current.dataCommons).toBe("HIDDEN");
      expect(result.current.studies).toBe("HIDDEN");
      expect(result.current.institution).toBe("HIDDEN");
      expect(result.current.permissions).toBe("HIDDEN");
      expect(result.current.notifications).toBe("HIDDEN");
    }
  );
});

describe("Profile View", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return UNLOCKED for firstName and lastName when viewing own profile", () => {
    const user = userFactory.build({ _id: "User-A", role: "User" });
    const profileOf: Pick<User, "_id" | "role"> = userFactory
      .pick(["_id", "role"])
      .build({ _id: "User-A", role: "User" });

    vi.spyOn(Auth, "useAuthContext").mockReturnValue(authCtxStateFactory.build({ user }));

    const { result } = renderHook(() => useProfileFields(profileOf, "profile"));

    expect(result.current.firstName).toBe("UNLOCKED");
    expect(result.current.lastName).toBe("UNLOCKED");
  });

  it("should return READ_ONLY for all other normal fields when viewing own profile", () => {
    const user = userFactory.build({ _id: "User-A", role: "User" });
    const profileOf: Pick<User, "_id" | "role"> = userFactory
      .pick(["_id", "role"])
      .build({ _id: "User-A", role: "User" });

    vi.spyOn(Auth, "useAuthContext").mockReturnValue(authCtxStateFactory.build({ user }));

    const { result } = renderHook(() => useProfileFields(profileOf, "profile"));

    expect(result.current.role).toBe("READ_ONLY");
    expect(result.current.userStatus).toBe("READ_ONLY");
  });

  it.each<UserRole>(["User", "Data Commons Personnel", "Admin", "fake role" as UserRole])(
    "should return HIDDEN for the studies field on the profile page for role %s",
    (role) => {
      const user = userFactory.build({ _id: "User-A", role });
      const profileOf: Pick<User, "_id" | "role"> = userFactory
        .pick(["_id", "role"])
        .build({ _id: "User-A", role });

      vi.spyOn(Auth, "useAuthContext").mockReturnValue(authCtxStateFactory.build({ user }));

      const { result } = renderHook(() => useProfileFields(profileOf, "profile"));

      expect(result.current.studies).toBe("HIDDEN");
    }
  );

  it.each<UserRole>(["Federal Lead"])(
    "should return READ_ONLY for the role field on the profile page for role %s",
    (role) => {
      const user = userFactory.build({ _id: "User-A", role, permissions: ["user:manage"] });
      const profileOf: Pick<User, "_id" | "role"> = userFactory
        .pick(["_id", "role"])
        .build({ _id: "User-A", role: "Federal Lead" });

      vi.spyOn(Auth, "useAuthContext").mockReturnValue(authCtxStateFactory.build({ user }));

      const { result } = renderHook(() => useProfileFields(profileOf, "profile"));

      expect(result.current.role).toBe("READ_ONLY");
    }
  );

  it.each<UserRole>(["Federal Lead"])(
    "should return UNLOCKED for all fields except role on the profile page for role %s modifying a Federal Lead",
    (role) => {
      const user = userFactory.build({ _id: "User-A", role, permissions: ["user:manage"] });
      const profileOf: Pick<User, "_id" | "role"> = userFactory
        .pick(["_id", "role"])
        .build({ _id: "User-A", role: "Federal Lead" });

      vi.spyOn(Auth, "useAuthContext").mockReturnValue(authCtxStateFactory.build({ user }));

      const { result } = renderHook(() => useProfileFields(profileOf, "users"));

      expect(result.current.role).toBe("DISABLED");
      expect(result.current.userStatus).toBe("UNLOCKED");
      expect(result.current.permissions).toBe("UNLOCKED");
      expect(result.current.notifications).toBe("UNLOCKED");
    }
  );

  it.each<UserRole>(["Submitter"])(
    "should return READ_ONLY for the studies field on the profile page for role %s",
    (role) => {
      const user = userFactory.build({ _id: "User-A", role });
      const profileOf: Pick<User, "_id" | "role"> = userFactory
        .pick(["_id", "role"])
        .build({ _id: "User-A", role });

      vi.spyOn(Auth, "useAuthContext").mockReturnValue(authCtxStateFactory.build({ user }));

      const { result } = renderHook(() => useProfileFields(profileOf, "profile"));

      expect(result.current.studies).toBe("READ_ONLY");
    }
  );

  it.each<UserRole>(["Submitter"])(
    "should return READ_ONLY for the studies field on the profile page for role %s",
    (role) => {
      const user = userFactory.build({ _id: "User-A", role });
      const profileOf: Pick<User, "_id" | "role"> = userFactory
        .pick(["_id", "role"])
        .build({ _id: "User-A", role });

      vi.spyOn(Auth, "useAuthContext").mockReturnValue(authCtxStateFactory.build({ user }));

      const { result } = renderHook(() => useProfileFields(profileOf, "profile"));

      expect(result.current.institution).toBe("READ_ONLY");
    }
  );

  it.each<UserRole>(["Admin", "Data Commons Personnel", "Federal Lead", "User"])(
    "should return HIDDEN for the institution field on the profile page for role %s",
    (role) => {
      const user = userFactory.build({ _id: "User-A", role });
      const profileOf: Pick<User, "_id" | "role"> = userFactory
        .pick(["_id", "role"])
        .build({ _id: "User-A", role });

      vi.spyOn(Auth, "useAuthContext").mockReturnValue(authCtxStateFactory.build({ user }));

      const { result } = renderHook(() => useProfileFields(profileOf, "profile"));

      expect(result.current.institution).toBe("HIDDEN");
    }
  );

  it.each<UserRole>(["Admin", "Federal Lead", "Data Commons Personnel", "fake role" as UserRole])(
    "should return DISABLED for the permissions and notifications panel on the profile page for role %s",
    (role) => {
      const user = userFactory.build({ _id: "User-A", role });
      const profileOf: Pick<User, "_id" | "role"> = userFactory
        .pick(["_id", "role"])
        .build({ _id: "User-A", role });

      vi.spyOn(Auth, "useAuthContext").mockReturnValue(authCtxStateFactory.build({ user }));

      const { result } = renderHook(() => useProfileFields(profileOf, "profile"));

      expect(result.current.permissions).toBe("DISABLED");
      expect(result.current.notifications).toBe("DISABLED");
    }
  );

  it.each<UserRole>(["User", "Submitter"])(
    "should return HIDDEN for the permissions and notifications field on the profile page for role %s",
    (role) => {
      const user = userFactory.build({ _id: "User-A", role });
      const profileOf: Pick<User, "_id" | "role"> = userFactory
        .pick(["_id", "role"])
        .build({ _id: "User-A", role });

      vi.spyOn(Auth, "useAuthContext").mockReturnValue(authCtxStateFactory.build({ user }));

      const { result } = renderHook(() => useProfileFields(profileOf, "profile"));

      expect(result.current.permissions).toBe("HIDDEN");
      expect(result.current.notifications).toBe("HIDDEN");
    }
  );

  it.each<[state: FieldState, role: UserRole]>([
    ["HIDDEN", "User"],
    ["HIDDEN", "Submitter"],
    ["HIDDEN", "Federal Lead"],
    ["READ_ONLY", "Data Commons Personnel"], // NOTE: Data Commons visible but read-only
    ["HIDDEN", "Admin"],
    ["HIDDEN", "fake role" as UserRole],
  ])("should return %s for the dataCommons field for the role %s", (state, role) => {
    const user = userFactory.build({ _id: "User-A", role });
    const profileOf: Pick<User, "_id" | "role"> = userFactory
      .pick(["_id", "role"])
      .build({ _id: "User-A", role });

    vi.spyOn(Auth, "useAuthContext").mockReturnValue(authCtxStateFactory.build({ user }));

    const { result } = renderHook(() => useProfileFields(profileOf, "profile"));

    expect(result.current.dataCommons).toBe(state);
  });

  // NOTE: This is a fallback case that should never be reached in the current implementation
  it.each<UserRole>([
    "Admin",
    "Data Commons Personnel",
    "Federal Lead",
    "Submitter",
    "User",
    "fake role" as UserRole,
  ])(
    "should return READ_ONLY for all fields when viewing another user's profile for all roles",
    (role) => {
      const user = userFactory.build({ _id: "User-A", role });
      const profileOf: Pick<User, "_id" | "role"> = userFactory
        .pick(["_id", "role"])
        .build({ _id: "Not-User-B", role: "Submitter" });

      vi.spyOn(Auth, "useAuthContext").mockReturnValue(authCtxStateFactory.build({ user }));

      const { result } = renderHook(() => useProfileFields(profileOf, "profile"));

      expect(result.current.firstName).toBe("READ_ONLY");
      expect(result.current.lastName).toBe("READ_ONLY");
      expect(result.current.role).toBe("READ_ONLY");
      expect(result.current.userStatus).toBe("READ_ONLY");
      expect(result.current.dataCommons).toBe("HIDDEN");
      expect(result.current.studies).toBe("HIDDEN");
      expect(result.current.institution).toBe("HIDDEN");
      expect(result.current.permissions).toBe("HIDDEN");
      expect(result.current.notifications).toBe("HIDDEN");
    }
  );

  // NOTE: This scenario is obscure to reproduce, but if a Data Commons POC is changed
  // to an Admin and refreshes their profile page, this field would appear unlocked
  it("should return READ_ONLY for an Admin viewing a Data Commons POC profile", () => {
    const user = userFactory.build({ _id: "User-A", role: "Admin" });
    const profileOf: Pick<User, "_id" | "role"> = userFactory
      .pick(["_id", "role"])
      .build({ _id: "Not-User-B", role: "Data Commons Personnel" });

    vi.spyOn(Auth, "useAuthContext").mockReturnValue(authCtxStateFactory.build({ user }));

    const { result } = renderHook(() => useProfileFields(profileOf, "profile"));

    expect(result.current.dataCommons).toBe("READ_ONLY");
  });
});
