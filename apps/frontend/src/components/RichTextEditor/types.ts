import type { SvgIconProps } from "@mui/material/SvgIcon/SvgIcon";
import type { ElementType } from "react";
import type { BaseEditor } from "slate";
import type { HistoryEditor } from "slate-history";
import type { ReactEditor } from "slate-react";

export type ToolbarIcon = ElementType<SvgIconProps>;

export type MarkFormat = "bold" | "italic" | "underline";

export type MarkDefinition = {
  format: MarkFormat;
  htmlTag: keyof React.ReactHTML;
  markdownSyntax: [prefix: string, suffix: string];
  tooltip: string;
  icon: ToolbarIcon;
};

export type BlockDefinition = {
  format: ListFormat;
  tooltip: string;
  icon: ToolbarIcon;
};

export type TextMarks = Partial<Record<MarkFormat, true>>;

export type ListFormat = "bulleted-list" | "numbered-list";

export type BlockFormat = "paragraph" | ListFormat | "list-item";

export type FormattedText = {
  text: string;
} & TextMarks;

export type CustomText = FormattedText;

export type ParagraphElement = {
  type: "paragraph";
  children: CustomText[];
};

export type ListItemElement = {
  type: "list-item";
  children: CustomText[];
};

export type BulletedListElement = {
  type: "bulleted-list";
  children: ListItemElement[];
};

export type NumberedListElement = {
  type: "numbered-list";
  children: ListItemElement[];
};

export type ListElement = BulletedListElement | NumberedListElement;

export type CustomElement = ParagraphElement | ListElement | ListItemElement;

export type CustomEditor = BaseEditor & ReactEditor & HistoryEditor;

declare module "slate" {
  interface CustomTypes {
    Editor: CustomEditor;
    Element: CustomElement;
    Text: CustomText;
  }
}
