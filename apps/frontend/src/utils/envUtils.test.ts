describe("parseReleaseVersion cases", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.resetAllMocks();
  });

  it("should return the correct version when VITE_FE_VERSION is valid", async () => {
    vi.doMock("../env", async () => {
      const actual = await vi.importActual<typeof import("../env")>("../env");
      return {
        default: {
          ...actual.default,
          VITE_FE_VERSION: "3.1.0.472",
        },
      };
    });

    const { parseReleaseVersion } = await import("./envUtils");
    expect(parseReleaseVersion()).toBe("3.1.0");
  });

  it.each<[version: string, expected: string]>([
    // Real tags
    ["3.1.0", "3.1.0.405"],
    ["3.0.0", "3.0.0.402"],
    ["2.1.0", "2.1.0.339"],
    ["2.0.0", "2.0.0.213"],
    ["1.0.1", "1.0.1.180"],
    // Future proofing
    ["10.0.1", "10.0.1.1293"],
    ["24.19.11", "24.19.11.3456"],
    ["9999.0.9999", "9999.0.9999.9999"],
  ])(
    "should correctly parse the release version of %p from the value of %p",
    async (expected, version) => {
      vi.doMock("../env", async () => {
        const actual = await vi.importActual<typeof import("../env")>("../env");
        return {
          default: {
            ...actual.default,
            VITE_FE_VERSION: version,
          },
        };
      });

      const { parseReleaseVersion } = await import("./envUtils");
      expect(parseReleaseVersion()).toBe(expected);
    }
  );

  it("should return N/A when VITE_FE_VERSION is not set", async () => {
    vi.doMock("../env", async () => {
      const actual = await vi.importActual<typeof import("../env")>("../env");
      return {
        default: {
          ...actual.default,
          VITE_FE_VERSION: undefined,
        },
      };
    });

    const { parseReleaseVersion } = await import("./envUtils");

    expect(parseReleaseVersion()).toBe("N/A");
  });

  it("should return N/A when VITE_FE_VERSION is not a string", async () => {
    vi.doMock("../env", async () => {
      const actual = await vi.importActual<typeof import("../env")>("../env");
      return {
        default: {
          ...actual.default,
          VITE_FE_VERSION: 0 as unknown as string, // Mocking invalid type for test
        },
      };
    });
    const { parseReleaseVersion } = await import("./envUtils");

    expect(parseReleaseVersion()).toBe("N/A");
  });

  it("should return N/A when VITE_FE_VERSION is not in the expected format (1/3)", async () => {
    vi.doMock("../env", async () => {
      const actual = await vi.importActual<typeof import("../env")>("../env");
      return {
        default: {
          ...actual.default,
          VITE_FE_VERSION: "invalid",
        },
      };
    });
    const { parseReleaseVersion } = await import("./envUtils");

    expect(parseReleaseVersion()).toBe("N/A");
  });

  it("should return N/A when VITE_FE_VERSION is not in the expected format (2/3)", async () => {
    vi.doMock("../env", async () => {
      const actual = await vi.importActual<typeof import("../env")>("../env");
      return {
        default: {
          ...actual.default,
          VITE_FE_VERSION: "mvp-2.213",
        },
      };
    });
    const { parseReleaseVersion } = await import("./envUtils");

    expect(parseReleaseVersion()).toBe("N/A");
  });

  it("should return N/A when VITE_FE_VERSION is not in the expected format (3/3)", async () => {
    vi.doMock("../env", async () => {
      const actual = await vi.importActual<typeof import("../env")>("../env");
      return {
        default: {
          ...actual.default,
          VITE_FE_VERSION: "test-branch.214",
        },
      };
    });
    const { parseReleaseVersion } = await import("./envUtils");

    expect(parseReleaseVersion()).toBe("N/A");
  });

  it("should return N/A when unable to get release version from build tag", async () => {
    vi.doMock("../env", async () => {
      const actual = await vi.importActual<typeof import("../env")>("../env");
      return {
        default: {
          ...actual.default,
          VITE_FE_VERSION: "0.0.0.000", // This is valid, but we want to force an error below
        },
      };
    });

    // NOTE: Vitest does not allow vi.spyOn combined with vi.doMock
    // so we must override the String.prototype.match method directly
    // eslint-disable-next-line no-extend-native
    String.prototype.match = vi.fn(() => null);

    const { parseReleaseVersion } = await import("./envUtils");

    expect(parseReleaseVersion()).toBe("N/A");
  });
});

describe("buildReleaseNotesUrl cases", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.resetAllMocks();
  });

  it("should return the correct URL when VITE_FE_VERSION is valid", async () => {
    vi.doMock("../env", async () => {
      const actual = await vi.importActual<typeof import("../env")>("../env");
      return {
        default: {
          ...actual.default,
          VITE_FE_VERSION: "3.1.0.472",
        },
      };
    });

    const { buildReleaseNotesUrl } = await import("./envUtils");

    expect(buildReleaseNotesUrl()).toBe(
      "https://raw.githubusercontent.com/CBIIT/crdc-datahub-ui/refs/tags/3.1.0.472/CHANGELOG.md"
    );
  });

  it("should return the fallback URL when VITE_FE_VERSION is not set", async () => {
    vi.doMock("../env", async () => {
      const actual = await vi.importActual<typeof import("../env")>("../env");
      return {
        default: {
          ...actual.default,
          VITE_FE_VERSION: undefined,
        },
      };
    });

    const { buildReleaseNotesUrl } = await import("./envUtils");

    expect(buildReleaseNotesUrl()).toBe(
      "https://raw.githubusercontent.com/CBIIT/crdc-datahub-ui/refs/heads/main/CHANGELOG.md"
    );
  });

  it("should return the fallback URL when VITE_FE_VERSION is not a string", async () => {
    vi.doMock("../env", async () => {
      const actual = await vi.importActual<typeof import("../env")>("../env");
      return {
        default: {
          ...actual.default,
          VITE_FE_VERSION: 0 as unknown as string, // NOTE: Env variables can officially only be strings
        },
      };
    });

    const { buildReleaseNotesUrl } = await import("./envUtils");

    expect(buildReleaseNotesUrl()).toBe(
      "https://raw.githubusercontent.com/CBIIT/crdc-datahub-ui/refs/heads/main/CHANGELOG.md"
    );
  });

  it("should return the fallback URL when VITE_FE_VERSION is not in the expected format", async () => {
    vi.doMock("../env", async () => {
      const actual = await vi.importActual<typeof import("../env")>("../env");
      return {
        default: {
          ...actual.default,
          VITE_FE_VERSION: "invalid",
        },
      };
    });

    const { buildReleaseNotesUrl } = await import("./envUtils");

    expect(buildReleaseNotesUrl()).toBe(
      "https://raw.githubusercontent.com/CBIIT/crdc-datahub-ui/refs/heads/main/CHANGELOG.md"
    );
  });
});

describe("getFilteredDataCommons cases", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.resetAllMocks();
  });

  it("should return an empty array when VITE_HIDDEN_MODELS is not set", async () => {
    vi.doMock("../env", async () => {
      const actual = await vi.importActual<typeof import("../env")>("../env");
      return {
        default: {
          ...actual.default,
          VITE_HIDDEN_MODELS: undefined,
        },
      };
    });

    const { getFilteredDataCommons } = await import("./envUtils");
    expect(getFilteredDataCommons()).toEqual([]);
  });

  it("should return an empty array when VITE_HIDDEN_MODELS is not a string", async () => {
    vi.doMock("../env", async () => {
      const actual = await vi.importActual<typeof import("../env")>("../env");
      return {
        default: {
          ...actual.default,
          VITE_HIDDEN_MODELS: 0 as unknown as string, // NOTE: Officially only be strings
        },
      };
    });

    const { getFilteredDataCommons } = await import("./envUtils");
    expect(getFilteredDataCommons()).toEqual([]);
  });

  it("should return an empty array when VITE_HIDDEN_MODELS is an empty string", async () => {
    vi.doMock("../env", async () => {
      const actual = await vi.importActual<typeof import("../env")>("../env");
      return {
        default: {
          ...actual.default,
          VITE_HIDDEN_MODELS: "",
        },
      };
    });

    const { getFilteredDataCommons } = await import("./envUtils");
    expect(getFilteredDataCommons()).toEqual([]);
  });

  it("should return an empty array when VITE_HIDDEN_MODELS is an CSV of nothing", async () => {
    vi.doMock("../env", async () => {
      const actual = await vi.importActual<typeof import("../env")>("../env");
      return {
        default: {
          ...actual.default,
          VITE_HIDDEN_MODELS: ",,,",
        },
      };
    });

    const { getFilteredDataCommons } = await import("./envUtils");
    expect(getFilteredDataCommons()).toEqual([]);
  });

  it("should return an array of hidden Data Commons when VITE_HIDDEN_MODELS is set", async () => {
    vi.doMock("../env", async () => {
      const actual = await vi.importActual<typeof import("../env")>("../env");
      return {
        default: {
          ...actual.default,
          VITE_HIDDEN_MODELS: "dc1,dc2,dc3",
        },
      };
    });

    const { getFilteredDataCommons } = await import("./envUtils");
    expect(getFilteredDataCommons()).toEqual(["dc1", "dc2", "dc3"]);
  });

  it("should return an array of 1 when VITE_HIDDEN_MODELS is set to a single Data Commons", async () => {
    vi.doMock("../env", async () => {
      const actual = await vi.importActual<typeof import("../env")>("../env");
      return {
        default: {
          ...actual.default,
          VITE_HIDDEN_MODELS: "dc1",
        },
      };
    });

    const { getFilteredDataCommons } = await import("./envUtils");
    expect(getFilteredDataCommons()).toEqual(["dc1"]);
  });

  it("should filter out empty Data Commons from the list", async () => {
    vi.doMock("../env", async () => {
      const actual = await vi.importActual<typeof import("../env")>("../env");
      return {
        default: {
          ...actual.default,
          VITE_HIDDEN_MODELS: "dc1,,dc3",
        },
      };
    });

    const { getFilteredDataCommons } = await import("./envUtils");
    expect(getFilteredDataCommons()).toEqual(["dc1", "dc3"]);
  });
});

describe("getCRDCBaseUrl cases", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.resetAllMocks();
  });

  it.each<[envValue: string | undefined, expectedUrl: string]>([
    // LOWER
    ["dev", "https://datacommons-dev.cancer.gov/"],
    ["dev2", "https://datacommons-dev.cancer.gov/"],
    ["qa", "https://datacommons-dev.cancer.gov/"],
    ["qa2", "https://datacommons-dev.cancer.gov/"],
    ["DEV", "https://datacommons-dev.cancer.gov/"],
    ["QA", "https://datacommons-dev.cancer.gov/"],
    // PROD
    ["stage", "https://datacommons.cancer.gov/"],
    ["prod", "https://datacommons.cancer.gov/"],
    [undefined, "https://datacommons.cancer.gov/"],
    ["", "https://datacommons.cancer.gov/"],
    ["invalid", "https://datacommons.cancer.gov/"],
  ])("should return the correct base URL for the tier '%s'", async (envValue, expectedUrl) => {
    vi.doMock("../env", async () => {
      const actual = await vi.importActual<typeof import("../env")>("../env");
      return {
        default: {
          ...actual.default,
          VITE_DEV_TIER: envValue,
        },
      };
    });

    const { getCRDCBaseUrl } = await import("./envUtils");
    expect(getCRDCBaseUrl()).toBe(expectedUrl);
  });
});
