import { axe } from "vitest-axe";

import { submissionCtxStateFactory } from "@/factories/submission/SubmissionContextFactory";
import { submissionFactory } from "@/factories/submission/SubmissionFactory";
import { submissionStatisticFactory } from "@/factories/submission/SubmissionStatisticFactory";

import { render, waitFor } from "../../test-utils";
import * as SubmissionCtx from "../Contexts/SubmissionContext";
import { SubmissionCtxStatus } from "../Contexts/SubmissionContext";

import ValidationStatistics from "./ValidationStatistics";

describe("Accessibility", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("should not have accessibility violations", async () => {
    vi.spyOn(SubmissionCtx, "useSubmissionContext").mockReturnValue(
      submissionCtxStateFactory.build({
        status: SubmissionCtxStatus.LOADED,
        data: {
          getSubmission: submissionFactory.build({ _id: "id-accessibility-base-case" }),
          submissionStats: {
            stats: [
              submissionStatisticFactory.build({
                nodeName: "node1",
                total: 5,
                new: 1,
                passed: 2,
                error: 3,
                warning: 4,
              }),
              submissionStatisticFactory.build({
                nodeName: "node2",
                total: 10,
                new: 3,
                passed: 3,
                warning: 3,
                error: 1,
              }),
              submissionStatisticFactory.build({
                nodeName: "node3",
                total: 33,
                new: 0,
                passed: 11,
                warning: 11,
                error: 11,
              }),
            ],
          },
          getSubmissionAttributes: {
            submissionAttributes: {
              hasOrphanError: false,
              isBatchUploading: false,
            },
          },
        },
        error: null,
      })
    );

    const { container, getByTestId } = render(<ValidationStatistics />);
    expect(await axe(container)).toHaveNoViolations();
    expect(getByTestId("statistics-charts-container")).toBeVisible();
  });

  it("should not have accessibility violations (loading)", async () => {
    vi.spyOn(SubmissionCtx, "useSubmissionContext").mockReturnValue(
      submissionCtxStateFactory.build({
        status: SubmissionCtxStatus.LOADING,
        data: null,
        error: null,
        startPolling: vi.fn(),
        stopPolling: vi.fn(),
      })
    );

    const { container, getByTestId } = render(<ValidationStatistics />);
    expect(await axe(container)).toHaveNoViolations();

    await waitFor(() => {
      expect(getByTestId("statistics-loader-container")).toBeVisible();
    });
  });

  it("should not have accessibility violations (no data)", async () => {
    vi.spyOn(SubmissionCtx, "useSubmissionContext").mockReturnValue(
      submissionCtxStateFactory.build({
        status: SubmissionCtxStatus.LOADED,
        data: {
          getSubmission: submissionFactory.build({ _id: "id-accessibility-no-data" }),
          submissionStats: { stats: [] },
          getSubmissionAttributes: {
            submissionAttributes: {
              hasOrphanError: false,
              isBatchUploading: false,
            },
          },
        },
        error: null,
      })
    );

    const { container, getByTestId } = render(<ValidationStatistics />);
    expect(await axe(container)).toHaveNoViolations();
    expect(getByTestId("statistics-empty-container")).toBeVisible();
  });
});
