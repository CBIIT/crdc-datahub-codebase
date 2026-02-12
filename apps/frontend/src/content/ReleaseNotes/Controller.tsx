import { memo, useEffect, useRef, useState } from "react";

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
  const isFetchingRef = useRef<boolean>(false);

  const fetchNotes = async () => {
    if (isFetchingRef.current) {
      return;
    }

    isFetchingRef.current = true;
    setLoading(true);

    try {
      const result = await fetchReleaseNotes();
      setDocument(result);
      isFetchingRef.current = false;
    } catch (error) {
      Logger.error("ReleaseNotesController: Unable to fetch release notes.", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!document) {
      fetchNotes();
    }
  }, []);

  if (loading) {
    return <SuspenseLoader />;
  }

  return <NotesView md={document} />;
};

export default memo(ReleaseNotesController);
