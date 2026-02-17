import { DataCommons } from "./DataCommons";

describe("Data Commons Display Order", () => {
  // Sorted alphabetically with two exceptions:
  // GC (CDS) should always be first, and Test MDF Model should always be last
  // Per requirements from CRDCDH-1235 superseded by CRDCDH-2609
  it("should be sorted as GC, CCDI, CTDC, ICDC, PSDC, Test MDF Model, Hidden Model", () => {
    expect(DataCommons.map((dc) => dc.displayName)).toEqual([
      "GC",
      "CCDI",
      "CTDC",
      "ICDC",
      "PSDC",
      "Test MDF",
      "Hidden Model",
    ]);
  });
});
