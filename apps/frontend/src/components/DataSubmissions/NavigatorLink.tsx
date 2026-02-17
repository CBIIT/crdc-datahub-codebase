import { FC, memo, useMemo } from "react";
import { Link } from "react-router-dom";

export type NavigatorLinkProps = {
  /**
   * The Data Submission object to generate the link for.
   * At minimum, this object should contain the status, dataCommons, and modelVersion fields.
   */
  submission: Submission | Pick<Submission, "status" | "dataCommonsDisplayName" | "modelVersion">;
};

/**
 * The states that result in the NavigatorLink being disabled.
 */
const DISABLED_STATES: SubmissionStatus[] = ["Canceled", "Deleted"];

/**
 * A React Router Link wrapper that links to the Model Navigator for the given submission.
 *
 * - If the submission is in a disabled state, the link will be disabled.
 * - If the `modelVersion` is not prefixed with a 'v', it will be added.
 *
 * @returns The NavigatorLink component
 */
const NavigatorLink: FC<NavigatorLinkProps> = ({ submission }) => {
  const { status, dataCommonsDisplayName, modelVersion } = submission || {};

  const formattedVersion = useMemo<string>(() => {
    if (!modelVersion || typeof modelVersion !== "string") {
      return "";
    }
    if (modelVersion.charAt(0) === "v") {
      return modelVersion;
    }

    return `v${modelVersion}`;
  }, [modelVersion]);

  if (!status || !dataCommonsDisplayName || !modelVersion || DISABLED_STATES.includes(status)) {
    return <span data-testid="navigator-link-disabled">{formattedVersion}</span>;
  }

  return (
    <Link
      to={`/model-navigator/${dataCommonsDisplayName}/${modelVersion}`}
      target="_blank"
      data-testid="navigator-link"
    >
      {formattedVersion}
    </Link>
  );
};

export default memo<NavigatorLinkProps>(
  NavigatorLink,
  (prev, next) =>
    prev?.submission?.status === next?.submission?.status &&
    prev?.submission?.dataCommonsDisplayName === next?.submission?.dataCommonsDisplayName &&
    prev?.submission?.modelVersion === next?.submission?.modelVersion
);
