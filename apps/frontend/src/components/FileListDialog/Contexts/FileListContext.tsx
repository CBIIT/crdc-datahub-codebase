import React from "react";

export type FileListContextState = {
  /**
   * Boolean flag to indicate if actions should be disabled.
   */
  disabled?: boolean;
  /**
   * Boolean flag to indicate if actions should be hidden.
   */
  hidden?: boolean;
  /**
   * Callback handler when the Download button is clicked.
   */
  handleDownloadClick?: (fileName: string) => Promise<void>;
};

/**
 * Context for the FileListDialog to provide a callback handler for the Download button.
 * This allows the parent component to define what happens when a file is downloaded.
 */
const FileListContext = React.createContext<FileListContextState>({});

export default FileListContext;
