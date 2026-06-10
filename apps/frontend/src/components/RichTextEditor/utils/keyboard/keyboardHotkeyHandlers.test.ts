import type { KeyboardEvent } from "react";
import { HistoryEditor } from "slate-history";

import { MARK_DEFINITIONS } from "@/config/EditorConfig";

import type { CustomEditor } from "../../types";
import { toggleMark } from "../editorTransforms";

import * as utils from "./keyboardHotkeyHandlers";

vi.mock("slate-history", () => ({
  HistoryEditor: {
    undo: vi.fn(),
    redo: vi.fn(),
  },
}));

vi.mock("../editorTransforms", () => ({
  toggleMark: vi.fn(),
}));

const createKeyboardEvent = (overrides: Partial<KeyboardEvent> = {}): KeyboardEvent =>
  ({
    key: "",
    ctrlKey: false,
    metaKey: false,
    shiftKey: false,
    preventDefault: vi.fn(),
    ...overrides,
  }) as unknown as KeyboardEvent;

const editor = {} as CustomEditor;

beforeEach(() => {
  vi.clearAllMocks();
});

describe("handleModifierHotkeys", () => {
  it("should return false when no modifier key is held", () => {
    const event = createKeyboardEvent({ key: "b" });

    expect(utils.handleModifierHotkeys(event, editor)).toBe(false);
    expect(event.preventDefault).not.toHaveBeenCalled();
  });

  it("should undo on Ctrl+Z", () => {
    const event = createKeyboardEvent({ key: "z", ctrlKey: true });

    expect(utils.handleModifierHotkeys(event, editor)).toBe(true);
    expect(event.preventDefault).toHaveBeenCalled();
    expect(HistoryEditor.undo).toHaveBeenCalledWith(editor);
  });

  it("should undo on Cmd+Z", () => {
    const event = createKeyboardEvent({ key: "z", metaKey: true });

    expect(utils.handleModifierHotkeys(event, editor)).toBe(true);
    expect(HistoryEditor.undo).toHaveBeenCalledWith(editor);
  });

  it("should redo on Ctrl+Y", () => {
    const event = createKeyboardEvent({ key: "y", ctrlKey: true });

    expect(utils.handleModifierHotkeys(event, editor)).toBe(true);
    expect(event.preventDefault).toHaveBeenCalled();
    expect(HistoryEditor.redo).toHaveBeenCalledWith(editor);
  });

  it("should redo on Ctrl+Shift+Z", () => {
    const event = createKeyboardEvent({ key: "z", ctrlKey: true, shiftKey: true });

    expect(utils.handleModifierHotkeys(event, editor)).toBe(true);
    expect(event.preventDefault).toHaveBeenCalled();
    expect(HistoryEditor.redo).toHaveBeenCalledWith(editor);
  });

  it("should not call undo when Shift is also held", () => {
    const event = createKeyboardEvent({ key: "z", ctrlKey: true, shiftKey: true });

    utils.handleModifierHotkeys(event, editor);

    expect(HistoryEditor.undo).not.toHaveBeenCalled();
  });

  it.each(MARK_DEFINITIONS.filter((m) => m.hotkey).map((m) => [m.format, m.hotkey]))(
    "should toggle %s mark for Ctrl+%s",
    (format, hotkey) => {
      const event = createKeyboardEvent({ key: hotkey, ctrlKey: true });

      expect(utils.handleModifierHotkeys(event, editor)).toBe(true);
      expect(event.preventDefault).toHaveBeenCalled();
      expect(toggleMark).toHaveBeenCalledWith(editor, format);
    }
  );

  it("should return false for an unrecognized key", () => {
    const event = createKeyboardEvent({ key: "x", ctrlKey: true });

    expect(utils.handleModifierHotkeys(event, editor)).toBe(false);
    expect(toggleMark).not.toHaveBeenCalled();
  });
});
