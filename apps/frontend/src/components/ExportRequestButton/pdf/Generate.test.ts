import { jsPDF as JsPDF } from "jspdf";

import { applicantFactory } from "@/factories/application/ApplicantFactory";
import { applicationFactory } from "@/factories/application/ApplicationFactory";

import { writeHeader } from "./Generate";

describe("writeHeader", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should write the header for a Reopened SRF without a submitted date", () => {
    const request = applicationFactory.build({
      status: "Reopened",
      submittedDate: null,
      applicant: applicantFactory.build(),
    });

    const doc = new JsPDF();
    vi.spyOn(doc, "addImage").mockReturnValue(doc);
    vi.spyOn(doc, "setFont").mockReturnValue(doc);
    const textSpy = vi.spyOn(doc, "text");

    expect(() => writeHeader(doc, request)).not.toThrow();
    expect(textSpy).toHaveBeenCalledWith("N/A", expect.any(Number), expect.any(Number));
    expect(textSpy).toHaveBeenCalledWith("Reopened", expect.any(Number), expect.any(Number));
  });
});
