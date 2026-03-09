import { jsPDF as JsPDF } from "jspdf";

import Logo from "../../../assets/header/Logo.jpg";
import env from "../../../env";
import { FormatDate, formatFullStudyName } from "../../../utils";

import {
  COLOR_HR,
  COLOR_FIELD_BASE,
  COLOR_EMAIL,
  COLOR_BASE,
  COLOR_HYPERLINK,
  COLOR_DOC_FOOTER,
} from "./Colors";
import fonts from "./Fonts";
import { loadFont } from "./utils";

/**
 * Describes the minimal padding from the edges of the document.
 *
 * @note No content should be placed from the document edge to this margin.
 */
const BASE_MARGIN = 20;

/**
 * Describes the margin around the content of the document.
 *
 * @note The design spec suggests it should be closer to +50p,
 * but this is a compromise to ensure the content fits within the page.
 * @note Any horizontal lines bypass this constraint.
 */
const CONTENT_MARGIN = BASE_MARGIN + 25;

/**
 * Describes the drawing width of horizontal lines.
 */
const HR_WIDTH = 0.8;

/**
 * Writes the PDF header to the document.
 *
 * @param doc The jsPDF instance to add the header to.
 * @param request The submission request to generate the header from.
 * @returns {number} The current Y position after writing the header including padding.
 */
const writeHeader = (doc: JsPDF, request: Application): number => {
  const { applicant, questionnaireData, status, submittedDate } = request;
  const { study } = questionnaireData || {};
  const formattedSubmittedDate =
    status !== "In Progress" ? FormatDate(submittedDate, "YYYY-MM-DD") : "N/A";

  const RIGHT_EDGE = doc.internal.pageSize.width - BASE_MARGIN;
  let y = BASE_MARGIN;

  doc.addImage(Logo, "JPEG", BASE_MARGIN, y, 278, 56);
  y += 63;

  // Submitter name
  doc.setDrawColor(...COLOR_HR);
  doc.setLineWidth(HR_WIDTH);
  doc.line(BASE_MARGIN, (y += 15), RIGHT_EDGE, y);
  doc.setFont("Nunito", "normal", 800);
  doc.setTextColor(...COLOR_FIELD_BASE);
  doc.setFontSize(10);
  doc.text("SUBMITTER'S NAME", CONTENT_MARGIN, (y += 15));
  doc.setFont("Nunito", "normal", 700);
  doc.setFontSize(14);
  doc.setTextColor(...COLOR_EMAIL);
  doc.text(applicant.applicantName, CONTENT_MARGIN + 85, (y += 1));
  doc.line(BASE_MARGIN, (y += 10), RIGHT_EDGE, y);
  y += 24;

  // Study name and abbreviation
  doc.setFont("Nunito", "normal", 600);
  doc.setTextColor(...COLOR_BASE);
  doc.setFontSize(10);
  doc.text("STUDY NAME", CONTENT_MARGIN, y);

  const formattedName = formatFullStudyName(study?.name, study?.abbreviation);
  const maxNameWidth = RIGHT_EDGE - CONTENT_MARGIN - 85;
  doc.setFont("Nunito", "normal", 400);
  doc.setFontSize(12);
  doc.setTextColor(...COLOR_FIELD_BASE);
  doc.text(formattedName, CONTENT_MARGIN + 85, y, {
    // NOTE – Take the full width of the page and subtract the margins/offsets
    maxWidth: maxNameWidth,
  });

  const computedNameLines = doc.splitTextToSize(formattedName, maxNameWidth);
  y += (computedNameLines?.length || 1) * 10 + 8;

  // Submitted Date
  doc.setFont("Nunito", "normal", 600);
  doc.setTextColor(...COLOR_BASE);
  doc.setFontSize(10);
  doc.text("SUBMITTED DATE", CONTENT_MARGIN, y);

  doc.setFont("Nunito", "normal", 400);
  doc.setFontSize(12);
  doc.setTextColor(...COLOR_FIELD_BASE);
  doc.text(formattedSubmittedDate, CONTENT_MARGIN + 85, y);
  y += 18;

  // Status
  doc.setFont("Nunito", "normal", 600);
  doc.setTextColor(...COLOR_BASE);
  doc.setFontSize(10);
  doc.text("STATUS", CONTENT_MARGIN, y);

  doc.setFont("Nunito", "normal", 400);
  doc.setFontSize(12);
  doc.setTextColor(...COLOR_FIELD_BASE);
  doc.text(status, CONTENT_MARGIN + 85, y);
  y += 24;

  // Click to view (text)
  doc.setFont("Nunito", "normal", 400);
  doc.setFontSize(12);
  doc.setTextColor(...COLOR_FIELD_BASE);
  doc.text("Click here to view the Submission Request Form", CONTENT_MARGIN, y, {
    align: "left",
  });

  // Click to view (overlapping link)
  doc.setTextColor(...COLOR_HYPERLINK);
  doc.textWithLink("here", CONTENT_MARGIN + 22, y, {
    url: `${env.VITE_NIH_REDIRECT_URL}/submission-request/${request._id}`,
    align: "left",
  });

  doc.setDrawColor(...COLOR_HYPERLINK);
  doc.setLineWidth(HR_WIDTH);
  doc.line(CONTENT_MARGIN + 22, (y += 2), CONTENT_MARGIN + 40, y);

  doc.setDrawColor(...COLOR_HR);
  doc.line(BASE_MARGIN, (y += 22), RIGHT_EDGE, y);

  return y + 30;
};

/**
 * A function to write a footer across all pages in the PDF document.
 *
 * @param doc The jsPDF instance to add the footer to.
 * @returns {void}
 */
const writeFooters = (doc: JsPDF): void => {
  const pdfRightEdge = doc.internal.pageSize.width - BASE_MARGIN;
  const bottomMargin = doc.internal.pageSize.height - BASE_MARGIN;
  const pageCount: number = doc.internal.pages.filter((p) => p !== null).length;

  for (let pageNum = 0; pageNum < pageCount; pageNum += 1) {
    doc.setPage(pageNum + 1);

    // Draw the horizontal line 20px from the bottom
    doc.setDrawColor(...COLOR_HR);
    doc.setLineWidth(HR_WIDTH);
    doc.line(
      BASE_MARGIN,
      bottomMargin - 20,
      doc.internal.pageSize.width - BASE_MARGIN,
      bottomMargin - 20
    );

    // Write the page number
    doc.setFontSize(10);
    doc.setTextColor(...COLOR_DOC_FOOTER);
    doc.setFont("Nunito", "normal", 600);
    doc.text(`Page ${pageNum + 1} of ${pageCount}`, pdfRightEdge, bottomMargin, {
      align: "right",
    });
  }
};

/**
 * A function to generate a PDF document from a submission request.
 *
 * @note This function temporarily modifies the width of the print region to ensure the
 *  content fits within the page.
 * @param request The submission request to generate a PDF from.
 * @param printRegion The region to print to the PDF.
 * @returns {Promise<URL>} A promise that resolves when the PDF is generated.
 * @throws {Error} If the submission request is invalid.
 */
export const GenerateDocument = async (
  request: Application,
  printRegion: HTMLElement
): Promise<Blob> => {
  if (!request || !request?._id) {
    throw new Error("Invalid submission request provided.");
  }
  if (!printRegion || !(printRegion instanceof Element)) {
    throw new Error("Invalid print region provided.");
  }

  const doc = new JsPDF({
    orientation: "portrait",
    unit: "px",
    format: "letter",
  });

  doc.setProperties({
    title: `Submission Request ${request._id}`,
    subject: `PDF Export of Submission Request ${request._id}`,
    keywords: "CRDC, submission request, PDF export",
    author: "CRDC Submission Portal",
    creator: "crdc-datahub-ui",
  });

  await Promise.allSettled(fonts.map((font) => loadFont(doc, font)));

  return new Promise((resolve) => {
    const y = writeHeader(doc, request);

    // NOTE: This fixes the width of the form to prevent the form from being too wide in the PDF
    // html2canvas width/windowWidth props do not work as expected
    printRegion.style.width = "794px";

    doc.html(printRegion, {
      callback: (doc) => {
        printRegion.style.width = "";

        writeFooters(doc);
        resolve(doc.output("blob"));
      },
      html2canvas: {
        scale: 0.5,
        ignoreElements: (element: HTMLElement) => {
          if (element?.getAttribute("data-print") === "false") {
            return true;
          }

          return false;
        },
        logging: false,
      },
      autoPaging: "text",
      x: 0,
      y: y - 25,
      margin: [BASE_MARGIN, BASE_MARGIN + 10, 50, BASE_MARGIN + 10],
    });
  });
};
