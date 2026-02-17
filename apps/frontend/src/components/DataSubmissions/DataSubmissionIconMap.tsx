import Canceled from "../../assets/history/canceled.svg?url";
import Completed from "../../assets/history/dataSubmission/completed.svg?url";
import Released from "../../assets/history/dataSubmission/released.svg?url";
import Deleted from "../../assets/history/deleted.svg?url";
import InProgress from "../../assets/history/in_progress.svg?url";
import New from "../../assets/history/new.svg?url";
import Rejected from "../../assets/history/rejected.svg?url";
import Submitted from "../../assets/history/submitted.svg?url";
import Withdrawn from "../../assets/history/withdrawn.svg?url";
import { IconType } from "../HistoryDialog";

/**
 * Map of ApplicationStatus to Icon for History Modal
 *
 * @see ApplicationStatus
 */
const HistoryIconMap: IconType<SubmissionStatus> = {
  New,
  "In Progress": InProgress,
  Submitted,
  Released,
  Withdrawn,
  Rejected,
  Completed,
  Canceled,
  Deleted,
} as IconType<SubmissionStatus>;

export default HistoryIconMap;
