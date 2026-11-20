"use client";

import { forwardRef, useImperativeHandle, useMemo, useRef } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { StreamLanguage } from "@codemirror/language";
import { stex } from "@codemirror/legacy-modes/mode/stex";
import { EditorView } from "@codemirror/view";
import { oneDark } from "@codemirror/theme-one-dark";

export type CodeEditorHandle = {
  insertText: (text: string) => void;
  focus: () => void;
};

export const CodeEditor = forwardRef<
  CodeEditorHandle,
  {
    value: string;
    onChange: (value: string) => void;
    dark: boolean;
  }
>(function CodeEditor({ value, onChange, dark }, ref) {
  const viewRef = useRef<EditorView | null>(null);

  useImperativeHandle(ref, () => ({
    insertText(text: string) {
      const view = viewRef.current;
      if (!view) return;
      const { from, to } = view.state.selection.main;
      view.dispatch({
        changes: { from, to, insert: text },
        selection: { anchor: from + text.length },
        scrollIntoView: true,
      });
      view.focus();
    },
    focus() {
      viewRef.current?.focus();
    },
  }));

  const extensions = useMemo(
    () => [StreamLanguage.define(stex), EditorView.lineWrapping],
    []
  );

  return (
    <CodeMirror
      value={value}
      onChange={onChange}
      height="100%"
      style={{ height: "100%" }}
      theme={dark ? oneDark : "light"}
      extensions={extensions}
      basicSetup={{
        lineNumbers: true,
        foldGutter: false,
        highlightActiveLine: true,
        autocompletion: false,
      }}
      onCreateEditor={(view) => {
        viewRef.current = view;
      }}
    />
  );
});
