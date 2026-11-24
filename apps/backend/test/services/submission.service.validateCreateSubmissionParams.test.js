const ERROR = require("../../constants/error-constants");
const { INTENTION, DATA_TYPE } = require("../../constants/submission-constants");
const { validateCreateSubmissionParams } = require("../../services/submission");

describe("submission.validateCreateSubmissionParams", () => {
  const VALID_INPUTS = {
    params: {
      name: "VALID",
      studyID: "VALID",
      dataCommons: "CDS",
    },
    visibleDataCommons: ["CDS", "ICDC"],
    intention: INTENTION.UPDATE,
    dataType: DATA_TYPE.METADATA_ONLY,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("golden path", () => {
    describe("data commons validation passes", () => {
      const testCases = [
        {
          name: "should pass for a data commons in the visible list",
          params: VALID_INPUTS.params,
          expectedDataCommons: VALID_INPUTS.params.dataCommons,
        },
        {
          name: "should trim the data commons and normalize params.dataCommons in place",
          params: { ...VALID_INPUTS.params, dataCommons: "  CDS  " },
          expectedDataCommons: VALID_INPUTS.params.dataCommons,
        },
      ];

      it.each(testCases)("$name", ({ params, expectedDataCommons }) => {
        expect(() =>
          validateCreateSubmissionParams(
            params,
            VALID_INPUTS.visibleDataCommons,
            VALID_INPUTS.intention,
            VALID_INPUTS.dataType
          )
        ).not.toThrow();
        expect(params.dataCommons).toBe(expectedDataCommons);
      });
    });

    describe("data commons validation throws error", () => {
      const testCases = [
        {
          name: "should throw an error if data commons is not in the visible list",
          params: { ...VALID_INPUTS.params, dataCommons: "INVALID" },
          visibleDataCommons: VALID_INPUTS.visibleDataCommons,
          expectedError:
            "The provided dataCommons value 'INVALID' is not allowed. Allowed data commons are: CDS, ICDC.",
        },
        {
          name: "should throw an error if the visible list is empty",
          params: VALID_INPUTS.params,
          visibleDataCommons: [],
          expectedError:
            "The provided dataCommons value 'CDS' is not allowed. Allowed data commons are: (none available).",
        },
        {
          name: "should throw an error if the data commons is null",
          params: { ...VALID_INPUTS.params, dataCommons: null },
          visibleDataCommons: VALID_INPUTS.visibleDataCommons,
          expectedError: ERROR.CREATE_SUBMISSION_INVALID_PARAMS,
        },
        {
          name: "should throw an error if the data commons is undefined",
          params: { ...VALID_INPUTS.params, dataCommons: undefined },
          visibleDataCommons: VALID_INPUTS.visibleDataCommons,
          expectedError: ERROR.CREATE_SUBMISSION_INVALID_PARAMS,
        },
        {
          name: "should throw an error if the data commons is not a string",
          params: { ...VALID_INPUTS.params, dataCommons: 123 },
          visibleDataCommons: VALID_INPUTS.visibleDataCommons,
          expectedError:
            "The provided dataCommons value '123' is not allowed. Allowed data commons are: CDS, ICDC.",
        },
        {
          name: "should throw an error if the data commons is an empty string",
          params: { ...VALID_INPUTS.params, dataCommons: "" },
          visibleDataCommons: VALID_INPUTS.visibleDataCommons,
          expectedError: ERROR.CREATE_SUBMISSION_INVALID_PARAMS,
        },
      ];

      it.each(testCases)("$name", ({ params, visibleDataCommons, expectedError }) => {
        expect(() =>
          validateCreateSubmissionParams(
            params,
            visibleDataCommons,
            VALID_INPUTS.intention,
            VALID_INPUTS.dataType
          )
        ).toThrow(expectedError);
      });
    });
  });
});
