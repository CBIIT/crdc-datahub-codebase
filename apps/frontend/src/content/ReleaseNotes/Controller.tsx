import { memo, useEffect, useState } from "react";

import SuspenseLoader from "../../components/SuspenseLoader";
import usePageTitle from "../../hooks/usePageTitle";
import { Logger, fetchReleaseNotes } from "../../utils";

import NotesView from "./NotesView";

/**
 * Controller component for the Release Notes page.
 *
 * @returns {React.ReactNode} The Release Notes page.
 */
const ReleaseNotesController = (): React.ReactNode => {
  usePageTitle("Release Notes");

  const [document, setDocument] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const controller = new AbortController();

    const fetchNotes = async () => {
      try {
        const result = await fetchReleaseNotes(controller.signal);
        if (!controller.signal.aborted) {
          setDocument(result);
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          Logger.error("ReleaseNotesController: Unable to fetch release notes.", error);
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    };

    fetchNotes();
    return () => controller.abort();
  }, []);

  if (loading) {
    return <SuspenseLoader />;
  }

  return <NotesView md={document} />;
};

export default memo(ReleaseNotesController);
