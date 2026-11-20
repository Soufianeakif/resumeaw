"use client";

import { useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  History,
  Loader2,
  Send,
  Sparkles,
  Undo2,
  X,
} from "lucide-react";

export function AiBar({
  documentId,
  latex,
  compileLog,
  compileFailed,
  aiReady,
  model,
  explanation,
  undoAvailable,
  onApply,
  onUndo,
  onDismiss,
  onOpenHistory,
  onOpenSettings,
}: {
  documentId: string;
  latex: string;
  compileLog: string;
  compileFailed: boolean;
  aiReady: boolean;
  model: string;
  explanation: string | null;
  undoAvailable: boolean;
  onApply: (updatedLatex: string, explanation: string) => void;
  onUndo: () => void;
  onDismiss: () => void;
  onOpenHistory: () => void;
  onOpenSettings: () => void;
}) {
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    const text = prompt.trim();
    if (!text || busy) return;

    if (!aiReady) {
      onOpenSettings();
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/ai/modify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          documentId,
          prompt: text,
          latexCode: latex,
          compileLog: compileFailed ? compileLog : "",
        }),
      });
      const data = (await response.json()) as {
        updatedLatex?: string;
        explanation?: string;
        error?: string;
      };

      if (!response.ok || !data.updatedLatex) {
        throw new Error(data.error ?? "The assistant could not modify the document.");
      }

      onApply(data.updatedLatex, data.explanation ?? "Updated the document.");
      setPrompt("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "AI request failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="shrink-0 border-t border-border bg-surface">
      {explanation || error ? (
        <div className="flex flex-wrap items-start gap-2 border-b border-border px-3 py-2 text-xs">
          {error ? (
            <p className="flex min-w-0 flex-1 items-start gap-1.5 text-danger">
              <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span className="break-words">{error}</span>
            </p>
          ) : (
            <div className="flex min-w-0 flex-1 items-start gap-1.5">
              <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success" />
              <div className="min-w-0">
                <span className="font-medium text-success">Applied changes</span>
                <p className="mt-0.5 whitespace-pre-line break-words text-muted">
                  {explanation}
                </p>
              </div>
            </div>
          )}
          <div className="flex shrink-0 items-center gap-1">
            {explanation ? (
              <button
                type="button"
                onClick={onOpenHistory}
                className="btn-ghost !py-1 text-xs"
                title="Open the AI change history"
              >
                <History className="h-3.5 w-3.5" /> History
              </button>
            ) : null}
            {undoAvailable ? (
              <button
                type="button"
                onClick={onUndo}
                className="btn-secondary !py-1 text-xs"
                title="Restore the previous version"
              >
                <Undo2 className="h-3.5 w-3.5" /> Undo
              </button>
            ) : null}
            <button
              type="button"
              onClick={onDismiss}
              className="btn-ghost h-7 w-7 !px-0"
              aria-label="Dismiss message"
              title="Dismiss"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      ) : null}

      <div className="flex items-end gap-2 px-3 py-2.5">
        <div className="mb-1 hidden shrink-0 items-center gap-1.5 text-[11px] text-muted sm:flex">
          <Sparkles className="h-4 w-4 text-accent" />
          <span className="font-semibold">AI</span>
        </div>

        <textarea
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          onKeyDown={(event) => {
            if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
              event.preventDefault();
              void submit();
            }
          }}
          rows={1}
          placeholder={
            aiReady
              ? "Ask for a change — e.g. “Make the header more compact so everything fits on 1 page”"
              : "Add your OpenRouter key in Settings to use the AI assistant"
          }
          className="field max-h-32 min-h-[40px] flex-1 resize-y py-2.5"
          aria-label="AI modification prompt"
        />

        <button
          type="button"
          onClick={() => void submit()}
          disabled={busy || !prompt.trim()}
          className="btn-primary h-10 shrink-0"
          title="Send (Ctrl/Cmd + Enter)"
        >
          {busy ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="hidden sm:inline">Working…</span>
            </>
          ) : (
            <>
              <Send className="h-4 w-4" />
              <span className="hidden sm:inline">Send</span>
            </>
          )}
        </button>
      </div>

      <div className="flex items-center justify-between gap-2 px-3 pb-2 text-[10px] text-faint">
        <span className="truncate">
          {aiReady ? (
            <>
              Sends your LaTeX, the rendered PDF and uploaded references to{" "}
              <span className="font-mono">{model}</span>
            </>
          ) : (
            <button
              type="button"
              onClick={onOpenSettings}
              className="text-accent underline underline-offset-2"
            >
              Configure OpenRouter
            </button>
          )}
        </span>
        <span className="hidden shrink-0 sm:inline">
          Ctrl/⌘ + Enter to send · Ctrl/⌘ + S to compile
        </span>
      </div>
    </div>
  );
}
