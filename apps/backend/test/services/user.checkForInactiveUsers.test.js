const { USER } = require("../../crdc-datahub-database-drivers/constants/user-constants");
const {
  subtractDaysFromNowTimestamp,
} = require("../../crdc-datahub-database-drivers/utility/time-utility");
const { UserService } = require("../../services/user");

const CUTOFF = new Date("2023-11-01T00:00:00Z").getTime();

// Mock the time-utility module before importing UserService
jest.mock("../../crdc-datahub-database-drivers/utility/time-utility", () => ({
  getCurrentTime: jest.fn(() => new Date("2023-12-01T00:00:00Z")),
  subtractDaysFromNowTimestamp: jest.fn(() => new Date("2023-11-01T00:00:00Z").getTime()),
}));

describe("UserService.checkForInactiveUsers", () => {
  let userService;
  let mockUserDAO;
  let mockLogCollection;

  const user1 = { _id: "user-1", email: "user1@example.com", IDP: "google", firstName: "User" };
  const user2 = { _id: "user-2", email: "user2@example.com", IDP: "microsoft", firstName: "User" };
  const qualifyingEvents = ["Login", "Reactivate_User"];

  const logGroup = (email, idp, latest) => ({ _id: { email, idp }, latest });

  const buildService = (inactiveUserDays) => {
    const service = new UserService(
      mockLogCollection,
      {},
      {},
      {},
      "test@example.com",
      "http://test.com",
      {},
      inactiveUserDays,
      {},
      {},
      {}
    );
    service.userDAO = mockUserDAO;
    return service;
  };

  beforeEach(() => {
    mockUserDAO = {
      aggregate: jest.fn(),
    };
    mockLogCollection = {
      aggregate: jest.fn().mockResolvedValue([]),
    };
    userService = buildService(30);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("active users query", () => {
    it("should match active non-NIH users and project only the required fields", async () => {
      mockUserDAO.aggregate.mockResolvedValue([user1]);

      await userService.checkForInactiveUsers(qualifyingEvents);

      expect(mockUserDAO.aggregate).toHaveBeenCalledTimes(1);
      expect(mockUserDAO.aggregate).toHaveBeenCalledWith([
        {
          $match: {
            userStatus: USER.STATUSES.ACTIVE,
            IDP: { $not: { $regex: "nih", $options: "i" } },
          },
        },
        { $project: { _id: 1, email: 1, IDP: 1, firstName: 1 } },
      ]);
    });

    it.each([[[]], [null], [undefined]])(
      "should return [] without querying logs when there are no active users (%p)",
      async (activeUsers) => {
        mockUserDAO.aggregate.mockResolvedValue(activeUsers);

        const result = await userService.checkForInactiveUsers(qualifyingEvents);

        expect(result).toEqual([]);
        expect(mockLogCollection.aggregate).not.toHaveBeenCalled();
      }
    );
  });

  describe("logs query", () => {
    it("should match qualifying events for the active users emails and group the latest timestamp per email and IDP", async () => {
      mockUserDAO.aggregate.mockResolvedValue([user1, user2]);

      await userService.checkForInactiveUsers(qualifyingEvents);

      expect(mockLogCollection.aggregate).toHaveBeenCalledTimes(1);
      expect(mockLogCollection.aggregate).toHaveBeenCalledWith([
        {
          $match: {
            eventType: { $in: qualifyingEvents },
            userEmail: { $in: [user1.email, user2.email] },
          },
        },
        {
          $group: {
            _id: { email: "$userEmail", idp: "$userIDP" },
            latest: { $max: "$timestamp" },
          },
        },
      ]);
    });

    it("should de-duplicate emails in the $in list", async () => {
      mockUserDAO.aggregate.mockResolvedValue([user1, { ...user2, email: user1.email }]);

      await userService.checkForInactiveUsers(qualifyingEvents);

      const pipeline = mockLogCollection.aggregate.mock.calls[0][0];
      expect(pipeline[0].$match.userEmail.$in).toEqual([user1.email]);
    });
  });

  describe("inactivity detection", () => {
    it("should return users with no qualifying logs", async () => {
      mockUserDAO.aggregate.mockResolvedValue([user1, user2]);
      mockLogCollection.aggregate.mockResolvedValue([]);

      const result = await userService.checkForInactiveUsers(qualifyingEvents);

      expect(result).toEqual([user1, user2]);
    });

    it("should handle a null result from the logs query as no qualifying logs", async () => {
      mockUserDAO.aggregate.mockResolvedValue([user1]);
      mockLogCollection.aggregate.mockResolvedValue(null);

      const result = await userService.checkForInactiveUsers(qualifyingEvents);

      expect(result).toEqual([user1]);
    });

    it.each([
      ["older than the cutoff", CUTOFF - 1, true],
      ["exactly at the cutoff", CUTOFF, false],
      ["newer than the cutoff", CUTOFF + 1, false],
    ])(
      "should treat a latest log %s correctly (inactive: %p)",
      async (_label, latest, expectedInactive) => {
        mockUserDAO.aggregate.mockResolvedValue([user1]);
        mockLogCollection.aggregate.mockResolvedValue([logGroup(user1.email, user1.IDP, latest)]);

        const result = await userService.checkForInactiveUsers(qualifyingEvents);

        expect(result).toEqual(expectedInactive ? [user1] : []);
      }
    );

    it("should still return a user whose only recent log is under a different IDP", async () => {
      mockUserDAO.aggregate.mockResolvedValue([user1]);
      mockLogCollection.aggregate.mockResolvedValue([
        logGroup(user1.email, "microsoft", CUTOFF + 1000),
        logGroup(user1.email, user1.IDP, CUTOFF - 1000),
      ]);

      const result = await userService.checkForInactiveUsers(qualifyingEvents);

      expect(result).toEqual([user1]);
    });

    it("should judge users with different emails on their own logs", async () => {
      mockUserDAO.aggregate.mockResolvedValue([user1, user2]);
      mockLogCollection.aggregate.mockResolvedValue([
        logGroup(user1.email, user1.IDP, CUTOFF + 1000),
        logGroup(user2.email, user2.IDP, CUTOFF - 1000),
      ]);

      const result = await userService.checkForInactiveUsers(qualifyingEvents);

      expect(result).toEqual([user2]);
    });

    it("should match a user with a missing IDP to a log group with a null IDP", async () => {
      const { IDP, ...userWithoutIDP } = user1;
      mockUserDAO.aggregate.mockResolvedValue([userWithoutIDP]);
      mockLogCollection.aggregate.mockResolvedValue([logGroup(user1.email, null, CUTOFF + 1000)]);

      const result = await userService.checkForInactiveUsers(qualifyingEvents);

      expect(result).toEqual([]);
    });

    it("should use the configured inactiveUserDays for the cutoff", async () => {
      mockUserDAO.aggregate.mockResolvedValue([user1]);

      await buildService(60).checkForInactiveUsers(qualifyingEvents);

      expect(subtractDaysFromNowTimestamp).toHaveBeenCalledWith(60);
    });
  });

  describe("error handling", () => {
    it("should not query logs when the users query fails", async () => {
      mockUserDAO.aggregate.mockRejectedValue(new Error("Database connection failed"));

      await expect(userService.checkForInactiveUsers(qualifyingEvents)).rejects.toThrow(
        "Database connection failed"
      );
      expect(mockLogCollection.aggregate).not.toHaveBeenCalled();
    });
  });
});
