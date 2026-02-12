import jsPDF from "jspdf";

import { fontResourceFactory } from "@/factories/application/FontResource";

import { FontResource } from "./Fonts";
import * as utils from "./utils";

const mockAddFileToVFS = vi.fn();
const mockAddFont = vi.fn();
const MockJsPDF = {
  addFileToVFS: (...p) => mockAddFileToVFS(...p),
  addFont: (...p) => mockAddFont(...p),
};

const baseFont: FontResource = fontResourceFactory.build({
  src: "",
  family: "mock-family",
  style: "normal",
  fontWeight: 500,
});

describe("loadFont", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.resetAllMocks();
  });

  it("should add the font to the jsPDF instance if the fetch is successful", async () => {
    vi.spyOn(window, "fetch").mockResolvedValue({
      ok: true,
      arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(1)),
    } as unknown as Response);

    await utils.loadFont(MockJsPDF as unknown as jsPDF, {
      ...baseFont,
      src: "http://example.com/font.ttf",
      family: "test-mock-family",
      fontWeight: 900,
    });

    expect(window.fetch).toHaveBeenCalledWith("http://example.com/font.ttf", {
      cache: "force-cache",
    });
    expect(mockAddFileToVFS).toHaveBeenCalledWith("test-mock-family", "AA==");
    expect(mockAddFont).toHaveBeenCalledWith("test-mock-family", "test-mock-family", "normal", 900);
  });

  it("should enforce heavy caching to avoid unnecessary network requests", async () => {
    vi.spyOn(window, "fetch").mockResolvedValue(new Response(null));

    await utils.loadFont(MockJsPDF as unknown as jsPDF, {
      ...baseFont,
      src: "https://example-fonts.com/font-abc.ttf",
    });

    expect(window.fetch).toHaveBeenCalledWith("https://example-fonts.com/font-abc.ttf", {
      cache: "force-cache",
    });
  });

  it("should not add the font to the jsPDF instance if an invalid font resource is provided (src)", async () => {
    vi.spyOn(window, "fetch").mockResolvedValue(new Response(null));

    await utils.loadFont(MockJsPDF as unknown as jsPDF, {
      ...baseFont,
      src: "",
    });

    expect(window.fetch).not.toHaveBeenCalled();
    expect(mockAddFileToVFS).not.toHaveBeenCalled();
    expect(mockAddFont).not.toHaveBeenCalled();
  });

  it("should not add the font to the jsPDF instance if an invalid font resource is provided (family)", async () => {
    vi.spyOn(window, "fetch").mockResolvedValue(new Response(null));

    await utils.loadFont(MockJsPDF as unknown as jsPDF, {
      ...baseFont,
      family: "",
    });

    expect(window.fetch).not.toHaveBeenCalled();
    expect(mockAddFileToVFS).not.toHaveBeenCalled();
    expect(mockAddFont).not.toHaveBeenCalled();
  });

  it("should not add the font to the jsPDF instance if an invalid font resource is provided (style)", async () => {
    vi.spyOn(window, "fetch").mockResolvedValue(new Response(null));

    await utils.loadFont(MockJsPDF as unknown as jsPDF, {
      ...baseFont,
      style: "",
    });

    expect(window.fetch).not.toHaveBeenCalled();
    expect(mockAddFileToVFS).not.toHaveBeenCalled();
    expect(mockAddFont).not.toHaveBeenCalled();
  });

  it("should not add the font to the jsPDF instance if an invalid font resource is provided (fontWeight)", async () => {
    vi.spyOn(window, "fetch").mockResolvedValue(new Response(null));

    await utils.loadFont(MockJsPDF as unknown as jsPDF, {
      ...baseFont,
      fontWeight: 0,
    });

    expect(window.fetch).not.toHaveBeenCalled();
    expect(mockAddFileToVFS).not.toHaveBeenCalled();
    expect(mockAddFont).not.toHaveBeenCalled();
  });

  it("should not add the font to the jsPDF instance if the fetch fails", async () => {
    vi.spyOn(window, "fetch").mockResolvedValue(new Response(null, { status: 404 }));

    await utils.loadFont(MockJsPDF as unknown as jsPDF, {
      ...baseFont,
      src: "http://example.com/font.ttf",
    });

    expect(window.fetch).toHaveBeenCalledWith("http://example.com/font.ttf", expect.any(Object));

    expect(mockAddFileToVFS).not.toHaveBeenCalled();
    expect(mockAddFont).not.toHaveBeenCalled();
  });

  it("should not add the font to the jsPDF instance if the fetch throws an exception", async () => {
    vi.spyOn(window, "fetch").mockRejectedValue(new Error("Mock fetch error"));

    await utils.loadFont(MockJsPDF as unknown as jsPDF, {
      ...baseFont,
      src: "http://example.com/font.ttf",
    });

    expect(window.fetch).toHaveBeenCalledWith("http://example.com/font.ttf", expect.any(Object));

    expect(mockAddFileToVFS).not.toHaveBeenCalled();
    expect(mockAddFont).not.toHaveBeenCalled();
  });

  it("should not add the font to the jsPDF instance if the arrayBuffer fails", async () => {
    vi.spyOn(window, "fetch").mockResolvedValue({
      ok: true,
      arrayBuffer: vi.fn().mockRejectedValue(new Error("Mock arrayBuffer error")),
    } as unknown as Response);

    await utils.loadFont(MockJsPDF as unknown as jsPDF, {
      ...baseFont,
      src: "http://example.com/font.ttf",
    });

    expect(window.fetch).toHaveBeenCalledWith("http://example.com/font.ttf", expect.any(Object));

    expect(mockAddFileToVFS).not.toHaveBeenCalled();
    expect(mockAddFont).not.toHaveBeenCalled();
  });
});

describe("arrayBufferToBase64", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should return a base64 string if the buffer is valid", () => {
    const buffer = new ArrayBuffer(1);
    const view = new Uint8Array(buffer);
    view[0] = 1;
    expect(utils.arrayBufferToBase64(buffer)).toBe("AQ==");
  });

  it("should return an empty string if the buffer argument is invalid", () => {
    const buffer = new ArrayBuffer(0);
    expect(utils.arrayBufferToBase64(buffer)).toBe("");
  });

  it.each(["", null, undefined, {}])(
    "should return an empty string if the buffer argument is not an ArrayBuffer",
    (arg) => {
      expect(utils.arrayBufferToBase64(arg as unknown as ArrayBuffer)).toBe("");
    }
  );

  it("should return an empty string if btoa fails", () => {
    vi.spyOn(window, "btoa").mockImplementation(() => {
      throw new Error("Mock btoa error");
    });

    const buffer = new ArrayBuffer(1);
    const view = new Uint8Array(buffer);
    view[0] = 1;
    expect(utils.arrayBufferToBase64(buffer)).toBe("");
  });
});
