"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Clock,
  History,
  Loader2,
  RotateCcw,
  Undo2,
  X,
} from "lucide-react";
import { formatDateTime, formatRelativeTime } from "@/lib/format";

export type HistoryEntry = {
  id: string;
  prompt: string;
  explanation: string | null;
  model: string | null;
  created_at: string;
  latex_before: string;
  latex_after: string;
};

export function HistoryDrawer({
  open,
  onClose,
  documentId,
  currentLatex,
  onRestore,
}: {
  open: boolean;
  onClose: () => void;
  documentId: string;
  currentLatex: string;
  onRestore: (latex: string, note: string) => void;
}) {
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/documents/${documentId}/history?limit=50`,
        { cache: "no-store" }
      );
      const data = (await response.json()) as {
        entries?: HistoryEntry[];
        total?: number;
        error?: string;
      };
      if (!response.ok) {
        throw new Error(data.error ?? "Could not load the change history.");
      }
      setEntries(data.entries ?? []);
      setTotal(data.total ?? 0);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not load the change history."
      );
    } finally {
      setLoading(false);
    }
  }, [documentId]);

  useEffect(() => {
    if (open) void load();
  }, [open, load]);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const trimmedCurrent = currentLatex.trim();

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-[1px]">
      <div className="absolute inset-0" onClick={onClose} aria-hidden="true" />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="AI change history"
        className="relative z-10 flex h-full w-full max-w-lg animate-fade-in flex-col border-l border-border bg-surface shadow-2xl"
      >
        <div className="flex items-start justify-between gap-3 border-b border-border px-4 py-3">
          <div className="flex items-center gap-2">
            <History className="h-4 w-4 text-accent" />
            <div>
              <h2 className="text-sm font-semibold">AI change history</h2>
              <p className="text-xs text-muted">
                {total} change{total === 1 ? "" : "s"} saved for this document
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="btn-ghost h-8 w-8 !px-0"
            aria-label="Close history"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading history…
            </div>
          ) : error ? (
            <div className="space-y-3 py-4">
              <p className="text-sm text-danger">{error}</p>
              <button type="button" onClick={() => void load()} className="btn-secondary">
                Retry
              </button>
            </div>
          ) : entries.length === 0 ? (
            <div className="px-2 py-10 text-center">
              <History className="mx-auto h-8 w-8 text-faint" />
              <p className="mt-3 text-sm font-medium">No AI changes yet</p>
              <p className="mx-auto mt-1 max-w-xs text-xs text-muted">
                Every prompt you send from the bottom bar is recorded here with a
                snapshot before and after, so you can undo it later.
              </p>
            </div>
          ) : (
            <ul className="space-y-2.5">
              {entries.map((entry) => {
                const isCurrent = entry.latex_after?.trim() === trimmedCurrent;
                return (
                  <li
                    key={entry.id}
                    className="rounded-xl border border-border bg-background/60 p-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p
                          className="flex items-center gap-1 text-[11px] text-faint"
                          title={formatDateTime(entry.created_at)}
                        >
                          <Clock className="h-3 w-3" />
                          {formatRelativeTime(entry.created_at)}
                        </p>
                        <p className="mt-1 break-words text-sm font-medium">
                          “{entry.prompt}”
                        </p>
                      </div>
                      {isCurrent ? (
                        <span className="badge shrink-0 border-success/30 text-success">
                          Current
                        </span>
                      ) : null}
                    </div>

                    {entry.explanation ? (
                      <p className="mt-2 whitespace-pre-line break-words text-xs leading-relaxed text-muted">
                        {entry.explanation}
                      </p>
                    ) : null}

                    <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2">
                      <span
                        className="max-w-[55%] truncate font-mono text-[10px] text-faint"
                        title={entry.model ?? undefined}
                      >
                        {entry.model ?? ""}
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        <button
                          type="button"
                          onClick={() =>
                            onRestore(
                              entry.latex_before,
                              `Undid the change from ${formatRelativeTime(
                                entry.created_at
                              )}.`
                            )
                          }
                          className="btn-secondary !px-2 !py-1 text-[11px]"
                          title="Restore the source from before this change"
                        >
                          <Undo2 className="h-3.5 w-3.5" /> Undo change
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            onRestore(
                              entry.latex_after,
                              `Restored the result of the change from ${formatRelativeTime(
                                entry.created_at
                              )}.`
                            )
                          }
                          disabled={isCurrent}
                          className="btn-ghost !px-2 !py-1 text-[11px]"
                          title="Restore the source produced by this change"
                        >
                          <RotateCcw className="h-3.5 w-3.5" /> Restore result
                        </button>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="border-t border-border px-4 py-2 text-[11px] leading-relaxed text-faint">
          Restoring replaces the current source and recompiles. The version you had
          before the restore stays available through the Undo button.
        </div>
      </aside>
    </div>
  );
}
