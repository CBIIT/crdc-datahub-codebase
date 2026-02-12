import { DashboardContentOptions } from "amazon-quicksight-embedding-sdk";

import { approvedStudyFactory } from "@/factories/approved-study/ApprovedStudyFactory";
import { userFactory } from "@/factories/auth/UserFactory";

import { addStudiesParameter, addDataCommonsParameter } from "./dashboardUtils";
import { Logger } from "./logger";

vi.mock("./logger", () => ({
  Logger: {
    error: vi.fn(),
  },
}));

describe("addStudiesParameter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return an empty array if user has 'All' as the first study", () => {
    const user = userFactory.build({
      studies: [
        approvedStudyFactory.build({ _id: "All" }),
        approvedStudyFactory.build({ _id: "AnotherStudy" }),
      ],
    });

    const result = addStudiesParameter(user);
    expect(result).toEqual([]);
    expect(Logger.error).not.toHaveBeenCalled();
  });

  it("should return an array with studiesParameter if user has valid studies", () => {
    const user = userFactory.build({
      studies: [
        approvedStudyFactory.build({ _id: "StudyA" }),
        approvedStudyFactory.build({ _id: "StudyB" }),
      ],
    });

    const result = addStudiesParameter(user);
    expect(result).toEqual<DashboardContentOptions["parameters"]>([
      {
        Name: "studiesParameter",
        Values: ["StudyA", "StudyB"],
      },
    ]);
    expect(Logger.error).not.toHaveBeenCalled();
  });

  it("should return NO-CONTENT if user has an empty studies array", () => {
    const user = userFactory.build({
      studies: [],
    });

    const result = addStudiesParameter(user);
    expect(result).toEqual<DashboardContentOptions["parameters"]>([
      {
        Name: "studiesParameter",
        Values: ["NO-CONTENT"],
      },
    ]);
    expect(Logger.error).toHaveBeenCalledTimes(1);
    expect(Logger.error).toHaveBeenCalledWith(
      "Federal Lead requires studies to be set but none or invalid values were found.",
      []
    );
  });

  it("should return NO-CONTENT if user studies is undefined or null", () => {
    const user = userFactory.build({
      studies: null,
    });

    const result = addStudiesParameter(user);
    expect(result).toEqual<DashboardContentOptions["parameters"]>([
      {
        Name: "studiesParameter",
        Values: ["NO-CONTENT"],
      },
    ]);
    expect(Logger.error).toHaveBeenCalledTimes(1);
  });

  it("should handle a null user gracefully", () => {
    const user = null as unknown as User;
    const result = addStudiesParameter(user);
    expect(result).toEqual<DashboardContentOptions["parameters"]>([
      {
        Name: "studiesParameter",
        Values: ["NO-CONTENT"],
      },
    ]);
    expect(Logger.error).toHaveBeenCalledTimes(1);
  });

  it("should handle an undefined user gracefully", () => {
    const user = undefined as unknown as User;
    const result = addStudiesParameter(user);
    expect(result).toEqual<DashboardContentOptions["parameters"]>([
      {
        Name: "studiesParameter",
        Values: ["NO-CONTENT"],
      },
    ]);
    expect(Logger.error).toHaveBeenCalledTimes(1);
  });
});

describe("addDataCommonsParameter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return an array with dataCommonsParameter if user has valid dataCommons", () => {
    const user = userFactory.build({
      dataCommons: ["CommonsA", "CommonsB"],
    });

    const result = addDataCommonsParameter(user);
    expect(result).toEqual<DashboardContentOptions["parameters"]>([
      {
        Name: "dataCommonsParameter",
        Values: ["CommonsA", "CommonsB"],
      },
    ]);
    expect(Logger.error).not.toHaveBeenCalled();
  });

  it("should return NO-CONTENT if user dataCommons is an empty array", () => {
    const user = userFactory.build({
      dataCommons: [],
    });

    const result = addDataCommonsParameter(user);
    expect(result).toEqual<DashboardContentOptions["parameters"]>([
      {
        Name: "dataCommonsParameter",
        Values: ["NO-CONTENT"],
      },
    ]);
    expect(Logger.error).toHaveBeenCalledTimes(1);
    expect(Logger.error).toHaveBeenCalledWith(
      "Data Commons Personnel requires dataCommons to be set but none were found.",
      []
    );
  });

  it("should return NO-CONTENT if user dataCommons is null or undefined", () => {
    const user = userFactory.build({
      dataCommons: null,
    });

    const result = addDataCommonsParameter(user);
    expect(result).toEqual<DashboardContentOptions["parameters"]>([
      {
        Name: "dataCommonsParameter",
        Values: ["NO-CONTENT"],
      },
    ]);
    expect(Logger.error).toHaveBeenCalledTimes(1);
  });

  it("should handle a null user gracefully", () => {
    const user = null as unknown as User;
    const result = addDataCommonsParameter(user);
    expect(result).toEqual<DashboardContentOptions["parameters"]>([
      {
        Name: "dataCommonsParameter",
        Values: ["NO-CONTENT"],
      },
    ]);
    expect(Logger.error).toHaveBeenCalledTimes(1);
  });

  it("should handle an undefined user gracefully", () => {
    const user = undefined as unknown as User;
    const result = addDataCommonsParameter(user);
    expect(result).toEqual<DashboardContentOptions["parameters"]>([
      {
        Name: "dataCommonsParameter",
        Values: ["NO-CONTENT"],
      },
    ]);
    expect(Logger.error).toHaveBeenCalledTimes(1);
  });
});
