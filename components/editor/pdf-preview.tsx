"use client";

import { useState } from "react";
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  FileWarning,
  Loader2,
  Minus,
  Plus,
  X,
} from "lucide-react";

export type CompileStatus = "idle" | "compiling" | "success" | "error";

export function PdfPreview({
  pdfUrl,
  status,
  log,
  showLog,
  onToggleLog,
  onCompile,
}: {
  pdfUrl: string | null;
  status: CompileStatus;
  log: string;
  showLog: boolean;
  onToggleLog: () => void;
  onCompile: () => void;
}) {
  const [zoom, setZoom] = useState(100);
  const [page, setPage] = useState(1);

  const src = pdfUrl
    ? `${pdfUrl}#page=${page}&zoom=${zoom}&toolbar=0&navpanes=0&view=FitH`
    : "";

  return (
    <div className="relative flex h-full min-h-0 flex-col bg-elevated/40">
      <div className="flex h-9 shrink-0 items-center gap-1 border-b border-border bg-surface px-2 text-xs">
        <span className="mr-1 hidden items-center gap-1.5 text-[11px] text-muted sm:flex">
          <span className="font-semibold uppercase tracking-wide">Preview</span>
          {status === "compiling" ? (
            <span className="inline-flex items-center gap-1 text-accent">
              <Loader2 className="h-3 w-3 animate-spin" /> compiling
            </span>
          ) : status === "error" ? (
            <span className="inline-flex items-center gap-1 text-danger">
              <AlertTriangle className="h-3 w-3" /> last successful render
            </span>
          ) : null}
        </span>

        <div className="ml-auto flex items-center gap-0.5">
          <button
            type="button"
            className="btn-ghost h-7 w-7 !px-0"
            onClick={() => setPage((value) => Math.max(1, value - 1))}
            disabled={!pdfUrl || page <= 1}
            title="Previous page"
            aria-label="Previous page"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
          <span className="min-w-[38px] text-center text-[11px] text-muted">
            p.{page}
          </span>
          <button
            type="button"
            className="btn-ghost h-7 w-7 !px-0"
            onClick={() => setPage((value) => value + 1)}
            disabled={!pdfUrl}
            title="Next page"
            aria-label="Next page"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </button>

          <span className="mx-1 h-4 w-px bg-border" />

          <button
            type="button"
            className="btn-ghost h-7 w-7 !px-0"
            onClick={() => setZoom((value) => Math.max(50, value - 10))}
            disabled={!pdfUrl}
            title="Zoom out"
            aria-label="Zoom out"
          >
            <Minus className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setZoom(100)}
            className="min-w-[42px] rounded px-1 text-center text-[11px] text-muted hover:text-foreground"
            title="Reset zoom"
          >
            {zoom}%
          </button>
          <button
            type="button"
            className="btn-ghost h-7 w-7 !px-0"
            onClick={() => setZoom((value) => Math.min(250, value + 10))}
            disabled={!pdfUrl}
            title="Zoom in"
            aria-label="Zoom in"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>

          <span className="mx-1 h-4 w-px bg-border" />

          <a
            href={pdfUrl ?? "#"}
            target="_blank"
            rel="noreferrer"
            className={`btn-ghost h-7 w-7 !px-0 ${
              pdfUrl ? "" : "pointer-events-none opacity-40"
            }`}
            title="Open PDF in a new tab"
            aria-label="Open PDF in a new tab"
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>
      </div>

      <div className="relative min-h-0 flex-1">
        {pdfUrl ? (
          <iframe
            key={`${pdfUrl}|${zoom}|${page}`}
            src={src}
            title="Compiled PDF preview"
            className="h-full w-full border-0 bg-[#525659]"
          />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
            <FileWarning className="h-9 w-9 text-faint" />
            <div>
              <p className="text-sm font-medium">No compiled PDF yet</p>
              <p className="mt-1 max-w-xs text-xs text-muted">
                compile the source to render a preview here. Uploaded images are copied
                into the compilation directory automatically.
              </p>
            </div>
            <button type="button" onClick={onCompile} className="btn-primary">
              Compile now
            </button>
            {status === "error" && log ? (
              <pre className="mt-2 max-h-56 w-full max-w-xl overflow-auto rounded-lg border border-danger/30 bg-danger/5 p-3 text-left font-mono text-[11px] leading-relaxed text-danger">
                {log}
              </pre>
            ) : null}
          </div>
        )}

        {pdfUrl && showLog && status === "error" ? (
          <div className="absolute inset-x-0 bottom-0 max-h-[55%] animate-fade-in overflow-hidden border-t border-danger/40 bg-surface shadow-[0_-8px_24px_rgba(0,0,0,0.25)]">
            <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-1.5">
              <span className="flex items-center gap-1.5 text-[11px] font-semibold text-danger">
                <AlertTriangle className="h-3.5 w-3.5" />
                pdflatex error — showing the last successful render above
              </span>
              <button
                type="button"
                onClick={onToggleLog}
                className="btn-ghost h-6 w-6 !px-0"
                aria-label="Close error log"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            <pre className="max-h-[45vh] overflow-auto p-3 font-mono text-[11px] leading-relaxed text-foreground/90">
              {log || "No compiler output captured."}
            </pre>
          </div>
        ) : null}
      </div>
    </div>
  );
}
