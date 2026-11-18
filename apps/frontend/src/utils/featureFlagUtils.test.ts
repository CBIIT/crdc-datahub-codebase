import * as utils from "./featureFlagUtils";

vi.mock("@/config/FeatureFlags", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/config/FeatureFlags")>();
  return {
    ...actual,
    FEATURE_FLAGS: {
      ...actual.FEATURE_FLAGS,
      isNetriasEnabled: { ...actual.FEATURE_FLAGS.isNetriasEnabled, defaultValue: true },
    },
  };
});

describe("resolveFeatureFlags cases", () => {
  it("should use the flags provided", () => {
    const flags = utils.resolveFeatureFlags({
      isMaintenanceMode: true,
      isChatBotEnabled: true,
      isNetriasEnabled: false,
    });

    expect(flags).toMatchObject({
      isMaintenanceMode: true,
      isChatBotEnabled: true,
      isNetriasEnabled: false,
    });
  });

  it("should use the default for a flag omitted from the input", () => {
    const flags = utils.resolveFeatureFlags({ isMaintenanceMode: false, isChatBotEnabled: false });

    expect(flags).toMatchObject({ isNetriasEnabled: true });
  });

  it.each<unknown>(["true", 1, null])("should use the default when a flag is %j", (value) => {
    const flags = utils.resolveFeatureFlags({
      isMaintenanceMode: false,
      isChatBotEnabled: false,
      isNetriasEnabled: value,
    });

    expect(flags).toMatchObject({ isNetriasEnabled: true });
  });

  it.each<unknown>([null, undefined])("should use every default when the input is %j", (input) => {
    const flags = utils.resolveFeatureFlags(input);

    expect(flags).toMatchObject({
      isMaintenanceMode: false,
      isChatBotEnabled: false,
      isNetriasEnabled: true,
    });
  });

  it("should ignore flags not registered in the feature flags config", () => {
    const flags = utils.resolveFeatureFlags({
      isMaintenanceMode: false,
      isChatBotEnabled: false,
      isNetriasEnabled: false,
      isRetiredFlag: true,
    });

    expect(flags).not.toHaveProperty("isRetiredFlag");
  });

  it("should return a frozen object", () => {
    const flags = utils.resolveFeatureFlags({
      isMaintenanceMode: false,
      isChatBotEnabled: false,
      isNetriasEnabled: false,
    });

    expect(Object.isFrozen(flags)).toBe(true);
  });
});
