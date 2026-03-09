import Canceled from "../../../assets/history/canceled.svg?url";
import Deleted from "../../../assets/history/deleted.svg?url";
import InProgress from "../../../assets/history/in_progress.svg?url";
import New from "../../../assets/history/new.svg?url";
import Rejected from "../../../assets/history/rejected.svg?url";
import Approved from "../../../assets/history/submissionRequest/Approved.svg?url";
import StatusApproved from "../../../assets/history/submissionRequest/StatusApproved.svg?url";
import StatusRejected from "../../../assets/history/submissionRequest/StatusRejected.svg?url";
import UnderReview from "../../../assets/history/submissionRequest/UnderReview.svg?url";
import Submitted from "../../../assets/history/submitted.svg?url";
import { IconType } from "../../HistoryDialog";

/**
 * Map of ApplicationStatus to Icon for History Modal
 *
 * @see ApplicationStatus
 */
export const HistoryIconMap: IconType<ApplicationStatus> = {
  New,
  Submitted,
  Rejected,
  Approved,
  "In Review": UnderReview,
  "In Progress": InProgress,
  Canceled,
  Deleted,
} as IconType<ApplicationStatus>;

/**
 * Map of ApplicationStatus to Icon for Status Bar
 *
 * @see ApplicationStatus
 */
export const StatusIconMap: IconType<ApplicationStatus> = {
  Rejected: StatusRejected,
  Approved: StatusApproved,
} as IconType<ApplicationStatus>;
