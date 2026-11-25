const { format_dot_notation: formatDotNotation } = require("../../utility/dot-notation");

describe("format _DOT_ notation before returning it", () => {
  it("should replace only _DOT_ with .", () => {
    const testObject = {
      // only this first key should be replaced
      parent_DOT_child: "test",
      // these should remain the same
      parent_dot_child: "test",
      parentdotchild: "test",
      parentDOTchild: "test",
      parent_dotchild: "test",
      parent_DOTchild: "test",
      parentdot_child: "test",
    };
    const expectedObject = {
      // only this first key should be replaced
      "parent.child": "test",
      // these should remain the same
      parent_dot_child: "test",
      parentdotchild: "test",
      parentDOTchild: "test",
      parent_dotchild: "test",
      parent_DOTchild: "test",
      parentdot_child: "test",
    };

    const formattedObject = formatDotNotation(testObject);

    expect(formattedObject).toEqual(expectedObject);
  });

  it("should return the input if it is not an object", () => {
    const testDate = new Date();
    const testCases = ["test", 0, false, null, undefined, [0, 1], testDate];
    for (const testCase of testCases) {
      const formattedObject = formatDotNotation(testCase);
      expect(formattedObject).toEqual(testCase);
    }
  });
});
