import { Suspense, forwardRef, lazy } from "react";

import type { RichTextEditorHandle, Props as RichTextEditorProps } from "./Controller";

const Controller = lazy(() => import("./Controller"));

const RichTextEditor = forwardRef<RichTextEditorHandle, RichTextEditorProps>((props, ref) => (
  <Suspense fallback={null}>
    <Controller {...props} ref={ref} />
  </Suspense>
));

RichTextEditor.displayName = "RichTextEditor";

export type { RichTextEditorHandle, Props as RichTextEditorProps } from "./Controller";

export default RichTextEditor;
