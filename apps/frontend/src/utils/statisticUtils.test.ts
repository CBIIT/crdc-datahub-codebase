import { submissionStatisticFactory } from "@/factories/submission/SubmissionStatisticFactory";

import * as utils from "./statisticUtils";

describe("compareNodeStats cases", () => {
  const node1A = submissionStatisticFactory.build({ total: 1, nodeName: "NodeA" });
  const node1B = submissionStatisticFactory.build({ total: 1, nodeName: "NodeB" });
  const node3A = submissionStatisticFactory.build({ total: 3, nodeName: "AAA Node" });
  const node3B = submissionStatisticFactory.build({ total: 3, nodeName: "Node3" });
  const node5 = submissionStatisticFactory.build({ total: 5, nodeName: "Node5" });

  it("should correctly sort in ascending order by node.total", () => {
    const sortedStats = [node3B, node1A, node5].sort(utils.compareNodeStats);

    expect(sortedStats).toEqual([node1A, node3B, node5]);
  });

  it("should correctly sort in ascending order by node.nodeName when node.total is equal", () => {
    const sortedStats = [node3B, node1A, node3A, node1B].sort(utils.compareNodeStats);

    expect(sortedStats).toEqual([node1A, node1B, node3A, node3B]);
  });
  it("should return >1 when a.total is greater than b.total", () => {
    const a = submissionStatisticFactory.build({ total: 5, nodeName: "Node 1" });
    const b = submissionStatisticFactory.build({ total: 1, nodeName: "Node 2" });

    expect(utils.compareNodeStats(a, b)).toBeGreaterThan(0);
  });

  it("should return >0 when a.nodeName comes after b.nodeName", () => {
    const a = submissionStatisticFactory.build({ total: 1, nodeName: "Node 2" });
    const b = submissionStatisticFactory.build({ total: 1, nodeName: "Node 1" });

    expect(utils.compareNodeStats(a, b)).toBeGreaterThan(0);
  });

  it("should return 0 when both nodes are equal 1/2", () => {
    const a = submissionStatisticFactory.build({ total: 1, nodeName: "Node 1" });
    const b = submissionStatisticFactory.build({ total: 1, nodeName: "Node 1" });

    expect(utils.compareNodeStats(a, b)).toEqual(0);
  });

  it("should return 0 when both nodes are equal 2/2", () => {
    const a = submissionStatisticFactory.build({ total: 0, nodeName: "" });
    const b = submissionStatisticFactory.build({ total: 0, nodeName: "" });

    expect(utils.compareNodeStats(a, b)).toEqual(0);
  });

  it("should return 0 when a.total is less than b.total", () => {
    const a = submissionStatisticFactory.build({ total: 1, nodeName: "Node 1" });
    const b = submissionStatisticFactory.build({ total: 4, nodeName: "Node 2" });

    expect(utils.compareNodeStats(a, b)).toBeLessThan(0);
  });

  it("should return 0 when a.nodeName comes before b.nodeName", () => {
    const a = submissionStatisticFactory.build({ total: 1, nodeName: "Node 1" });
    const b = submissionStatisticFactory.build({ total: 1, nodeName: "Node 2" });

    expect(utils.compareNodeStats(a, b)).toBeLessThan(0);
  });
});

describe("calculateMaxDomain cases", () => {
  it.each([-1, NaN, undefined, 0, Infinity, -Infinity])(
    "should default to 1 when dataMax is invalid (%s)",
    (dataMax) => {
      expect(utils.calculateMaxDomain(dataMax)).toBe(1);
    }
  );

  it("should round up to the nearest 1,000 when dataMax above 1,000", () => {
    expect(utils.calculateMaxDomain(1001)).toBe(2000);
    expect(utils.calculateMaxDomain(2500)).toBe(3000);
    expect(utils.calculateMaxDomain(10000)).toBe(10000);
    expect(utils.calculateMaxDomain(23949)).toBe(24000);
  });

  it("should round up to the nearest 100 when dataMax is between 100 and 1,000", () => {
    expect(utils.calculateMaxDomain(101)).toBe(200);
    expect(utils.calculateMaxDomain(550)).toBe(600);
    expect(utils.calculateMaxDomain(1000)).toBe(1000);
  });

  it("should round up to the nearest 10 when dataMax is between 10 and 100", () => {
    expect(utils.calculateMaxDomain(11)).toBe(20);
    expect(utils.calculateMaxDomain(55)).toBe(60);
    expect(utils.calculateMaxDomain(99)).toBe(100);
    expect(utils.calculateMaxDomain(100)).toBe(100);
  });

  it("should round up to the nearest 10 when dataMax is between 1 and 10", () => {
    expect(utils.calculateMaxDomain(1)).toBe(10);
    expect(utils.calculateMaxDomain(5)).toBe(10);
    expect(utils.calculateMaxDomain(10)).toBe(10);
  });
});

describe("calculateTextWidth cases", () => {
  it("should short-circuit an empty string", () => {
    expect(utils.calculateTextWidth("")).toBe(0);
  });

  it.each([null, undefined, 0, NaN, Infinity, -Infinity])(
    "should handle non-string types (%s) without error",
    (text) => {
      expect(utils.calculateTextWidth(text as unknown as string)).toBe(0);
    }
  );

  it("should safely return 0 when the width could not be calculated", () => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValueOnce(null); // NOTE: This causes an exception
    expect(utils.calculateTextWidth("This should not have a width")).toBe(0);
  });

  it("should return the computed width of the text element", () => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValueOnce({
      font: "",
      measureText: (text) => ({ width: text.length }),
    } as CanvasRenderingContext2D);

    const width = utils.calculateTextWidth("HelloWorld", "Arial", "11px", "normal");
    expect(width).toBe(10);
  });

  it("should fall back to 0 when the width is not valid", () => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValueOnce({
      font: "",
      measureText: (text) => ({ width: text.length * -25 }),
    } as CanvasRenderingContext2D);

    const width = utils.calculateTextWidth("HelloWorld", "Arial", "11px", "normal");
    expect(width).toBe(0);
  });
});
