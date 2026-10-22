import { useCallback, useRef, useState } from "react";
import { Editor, Node, Path, Range, Transforms } from "slate";
import type { Selection } from "slate";
import { ReactEditor } from "slate-react";

import type { CustomEditor } from "../types";
import { isLinkElement } from "../utils/editorGuards";
import { insertLink, removeLink, updateLink } from "../utils/linkEditorUtils";
import { readUrl } from "../utils/linkUrlUtils";

export type LinkPopupMode = "edit" | "view";

export type LinkPopupState = {
  open: boolean;
  mode: LinkPopupMode;
  anchorElement: HTMLElement | null;
  text: string;
  url: string;
  error: string;
  linkPath: Path | null;
};

export type LinkPopupController = {
  state: LinkPopupState;
  openFromToolbar: (anchorElement: HTMLElement) => void;
  openFromLink: (anchorElement: HTMLAnchorElement) => void;
  startEditing: () => void;
  setText: (text: string) => void;
  setUrl: (url: string) => void;
  save: () => void;
  remove: () => void;
  close: () => void;
  resetAfterClose: () => void;
};

const CLOSED_STATE: LinkPopupState = {
  open: false,
  mode: "edit",
  anchorElement: null,
  text: "",
  url: "",
  error: "",
  linkPath: null,
};

/**
 * Owns the link popup state and the insert, update, and remove link workflows
 * for the rich text editor.
 *
 * @param {CustomEditor} editor - The Slate editor instance.
 * @returns {LinkPopupController} The popup state and handlers.
 *
 * @example
 * const linkPopup = useLinkPopup(editor);
 * <Toolbar onInsertLink={linkPopup.openFromToolbar} />
 */
export const useLinkPopup = (editor: CustomEditor): LinkPopupController => {
  const [state, setState] = useState<LinkPopupState>(CLOSED_STATE);
  const savedSelectionRef = useRef<Selection>(null);

  const close = useCallback((): void => {
    setState((current) => ({ ...current, open: false }));
    ReactEditor.focus(editor);
  }, [editor]);

  const resetAfterClose = useCallback((): void => {
    setState((current) => {
      if (current.open) {
        return current;
      }

      return CLOSED_STATE;
    });
  }, []);

  const openFromToolbar = useCallback(
    (anchorElement: HTMLElement): void => {
      const { selection } = editor;
      savedSelectionRef.current = selection;

      let selectedText = "";

      if (selection && Range.isExpanded(selection)) {
        selectedText = Editor.string(editor, selection);
      }

      setState({
        open: true,
        mode: "edit",
        anchorElement,
        text: selectedText.trim(),
        url: "",
        error: "",
        linkPath: null,
      });
    },
    [editor]
  );

  const openFromLink = useCallback(
    (anchorElement: HTMLAnchorElement): void => {
      const linkNode = ReactEditor.toSlateNode(editor, anchorElement);

      if (!isLinkElement(linkNode)) {
        return;
      }

      setState({
        open: true,
        mode: "view",
        anchorElement,
        text: Node.string(linkNode),
        url: linkNode.url,
        error: "",
        linkPath: ReactEditor.findPath(editor, linkNode),
      });
    },
    [editor]
  );

  const startEditing = useCallback((): void => {
    setState((current) => ({ ...current, mode: "edit" }));
  }, []);

  const setText = useCallback((text: string): void => {
    setState((current) => ({ ...current, text }));
  }, []);

  const setUrl = useCallback((url: string): void => {
    setState((current) => ({ ...current, url, error: "" }));
  }, []);

  const save = useCallback((): void => {
    const linkUrl = readUrl(state.url.trim());

    if (!linkUrl) {
      setState((current) => ({ ...current, error: "Please enter a valid URL." }));
      return;
    }

    const linkText = state.text.trim() || linkUrl;

    if (state.linkPath) {
      updateLink(editor, state.linkPath, linkText, linkUrl);
      close();
      return;
    }

    const savedSelection = savedSelectionRef.current ?? Editor.end(editor, []);
    Transforms.select(editor, savedSelection);
    insertLink(editor, linkText, linkUrl);
    close();
  }, [close, editor, state.linkPath, state.text, state.url]);

  const remove = useCallback((): void => {
    if (state.linkPath) {
      removeLink(editor, state.linkPath);
    }

    close();
  }, [close, editor, state.linkPath]);

  return {
    state,
    openFromToolbar,
    openFromLink,
    startEditing,
    setText,
    setUrl,
    save,
    remove,
    close,
    resetAfterClose,
  };
};
