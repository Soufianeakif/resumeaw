"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  Download,
  FileCode2,
  FileDown,
  History,
  Image as ImageIcon,
  Loader2,
  PanelLeftClose,
  PanelLeftOpen,
  RefreshCw,
  Settings,
} from "lucide-react";
import type { ClientAsset, DocumentRecord } from "@/lib/types";
import { ThemeToggle } from "@/components/theme-toggle";
import { SettingsDialog } from "@/components/settings-dialog";
import { CodeEditor, type CodeEditorHandle } from "./code-editor";
import { AssetsPanel } from "./assets-panel";
import { PdfPreview, type CompileStatus } from "./pdf-preview";
import { AiBar } from "./ai-bar";
import { HistoryDrawer } from "./history-drawer";

type SaveState = "saved" | "saving" | "dirty" | "error";

function slugify(value: string) {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "document"
  );
}

export function EditorWorkspace({
  document: doc,
  initialAssets,
  hasPdf,
  aiReady,
  model,
}: {
  document: DocumentRecord;
  initialAssets: ClientAsset[];
  hasPdf: boolean;
  aiReady: boolean;
  model: string;
}) {
  const router = useRouter();
  const documentId = doc.id;

  const [latex, setLatex] = useState(doc.latex_code);
  const [title, setTitle] = useState(doc.title);
  const [assets, setAssets] = useState<ClientAsset[]>(initialAssets);
  const [status, setStatus] = useState<CompileStatus>("idle");
  const [compileLog, setCompileLog] = useState("");
  const [showLog, setShowLog] = useState(false);
  const [pdfUrl, setPdfUrl] = useState<string | null>(
    hasPdf ? `/api/files/compiled/${documentId}.pdf` : null
  );
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [assetsOpen, setAssetsOpen] = useState(true);
  const [leftPercent, setLeftPercent] = useState(52);
  const [dark, setDark] = useState(false);
  const [aiExplanation, setAiExplanation] = useState<string | null>(null);
  const [undoEntry, setUndoEntry] = useState<{ latex: string } | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyTotal, setHistoryTotal] = useState(0);

  const editorRef = useRef<CodeEditorHandle | null>(null);
  const latexRef = useRef(latex);
  const splitRef = useRef<HTMLDivElement | null>(null);
  const compileInFlight = useRef(false);
  const queuedCompile = useRef<string | null>(null);
  const skipDebounce = useRef(true);
  const skipNextDebounce = useRef<string | null>(null);

  useEffect(() => {
    latexRef.current = latex;
  }, [latex]);

  useEffect(() => {
    function update() {
      setDark(document.documentElement.classList.contains("dark"));
    }
    update();
    const observer = new MutationObserver(update);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });
    return () => observer.disconnect();
  }, []);

  const refreshHistoryCount = useCallback(async () => {
    try {
      const response = await fetch(
        `/api/documents/${documentId}/history?limit=1`,
        { cache: "no-store" }
      );
      if (!response.ok) return;
      const data = (await response.json()) as { total?: number };
      setHistoryTotal(data.total ?? 0);
    } catch {
      // The badge is best-effort only.
    }
  }, [documentId]);

  useEffect(() => {
    void refreshHistoryCount();
  }, [refreshHistoryCount]);

  const save = useCallback(
    async (code: string, nextTitle?: string) => {
      setSaveState("saving");
      try {
        const payload: { latexCode: string; title?: string } = { latexCode: code };
        if (nextTitle !== undefined) payload.title = nextTitle;
        const response = await fetch(`/api/documents/${documentId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!response.ok) throw new Error("Save failed");
        setSaveState("saved");
      } catch {
        setSaveState("error");
      }
    },
    [documentId]
  );

  const compileNow = useCallback(
    async (code: string) => {
      if (compileInFlight.current) {
        queuedCompile.current = code;
        return;
      }
      compileInFlight.current = true;
      setStatus("compiling");
      try {
        const response = await fetch("/api/compile", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ documentId, latexCode: code }),
        });
        const data = (await response.json()) as {
          success?: boolean;
          pdfUrl?: string;
          log?: string;
          error?: string;
        };

        if (response.ok && data.success && data.pdfUrl) {
          setPdfUrl(data.pdfUrl);
          setStatus("success");
          setCompileLog("");
          setShowLog(false);
        } else {
          setStatus("error");
          setCompileLog(data.log ?? data.error ?? "Unknown compilation error.");
        }
      } catch (error) {
        setStatus("error");
        setCompileLog(
          error instanceof Error ? error.message : "Compile request failed."
        );
      } finally {
        compileInFlight.current = false;
        const queued = queuedCompile.current;
        queuedCompile.current = null;
        if (queued !== null && queued !== code) {
          void compileNow(queued);
        }
      }
    },
    [documentId]
  );

  const saveAndCompile = useCallback(
    (code: string) => {
      void save(code);
      void compileNow(code);
    },
    [save, compileNow]
  );

  // Initial automatic compile so an existing PDF refreshes on open.
  useEffect(() => {
    void compileNow(latexRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Debounced autosave + compile on every change.
  useEffect(() => {
    if (skipDebounce.current) {
      skipDebounce.current = false;
      return;
    }
    if (skipNextDebounce.current === latex) {
      skipNextDebounce.current = null;
      return;
    }
    setSaveState("dirty");
    const timer = setTimeout(() => saveAndCompile(latex), 900);
    return () => clearTimeout(timer);
  }, [latex, saveAndCompile]);

  // Ctrl/Cmd + S compiles immediately.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        saveAndCompile(latexRef.current);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [saveAndCompile]);

  function startDrag(event: React.PointerEvent<HTMLDivElement>) {
    event.preventDefault();
    const container = splitRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();

    function onMove(moveEvent: PointerEvent) {
      const percent = ((moveEvent.clientX - rect.left) / rect.width) * 100;
      setLeftPercent(Math.min(76, Math.max(28, percent)));
    }
    function onUp() {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    }

    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  function insertImage(filename: string) {
    editorRef.current?.insertText(
      `\n\\includegraphics[width=0.3\\textwidth]{${filename}}\n`
    );
  }

  function applyAi(updatedLatex: string, explanation: string) {
    setUndoEntry({ latex: latexRef.current });
    setAiExplanation(explanation);
    setLatex(updatedLatex);
    skipNextDebounce.current = updatedLatex;
    void save(updatedLatex);
    void compileNow(updatedLatex);
    void refreshHistoryCount();
  }

  function undoAi() {
    if (!undoEntry) return;
    const target = undoEntry.latex;
    setUndoEntry(null);
    setAiExplanation(null);
    setLatex(target);
    skipNextDebounce.current = target;
    void save(target);
    void compileNow(target);
  }

  function restoreFromHistory(nextLatex: string, note: string) {
    setUndoEntry({ latex: latexRef.current });
    setAiExplanation(note);
    setLatex(nextLatex);
    skipNextDebounce.current = nextLatex;
    void save(nextLatex);
    void compileNow(nextLatex);
  }

  function dismissAiNotice() {
    setAiExplanation(null);
    setUndoEntry(null);
  }

  function downloadTex() {
    const blob = new Blob([latexRef.current], {
      type: "application/x-tex;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${slugify(title)}.tex`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function downloadPdf() {
    if (!pdfUrl) return;
    const anchor = document.createElement("a");
    anchor.href = pdfUrl;
    anchor.download = `${slugify(title)}.pdf`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  }

  const statusPill =
    status === "compiling"
      ? {
          className: "border-accent/40 bg-accent/10 text-accent",
          icon: <Loader2 className="h-3.5 w-3.5 animate-spin" />,
          label: "Compiling…",
        }
      : status === "success"
        ? {
            className: "border-success/40 bg-success/10 text-success",
            icon: <Check className="h-3.5 w-3.5" />,
            label: "Compiled",
          }
        : status === "error"
          ? {
              className: "border-danger/40 bg-danger/10 text-danger",
              icon: <AlertTriangle className="h-3.5 w-3.5" />,
              label: "LaTeX error",
            }
          : {
              className: "border-border bg-elevated text-muted",
              icon: <FileCode2 className="h-3.5 w-3.5" />,
              label: "Not compiled",
            };

  const saveLabel =
    saveState === "saving"
      ? "Saving…"
      : saveState === "dirty"
        ? "Unsaved changes"
        : saveState === "error"
          ? "Save failed"
          : "Saved";

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <header className="flex h-14 shrink-0 items-center gap-1.5 border-b border-border bg-surface px-2 sm:px-3">
        <Link
          href="/"
          className="btn-ghost h-9 w-9 shrink-0 !px-0"
          title="Back to documents"
          aria-label="Back to documents"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>

        <input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          onBlur={() => {
            const trimmed = title.trim() || "Untitled document";
            setTitle(trimmed);
            if (trimmed !== doc.title) void save(latexRef.current, trimmed);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") event.currentTarget.blur();
          }}
          className="min-w-0 max-w-[360px] flex-1 rounded-md border border-transparent bg-transparent px-2 py-1 text-sm font-semibold hover:border-border focus:border-accent focus:bg-background focus:outline-none"
          aria-label="Document title"
        />

        <button
          type="button"
          onClick={() => setShowLog((value) => !value)}
          className={`badge hidden h-8 cursor-pointer gap-1.5 border px-2.5 text-[11px] sm:inline-flex ${statusPill.className}`}
          title={
            status === "error" ? "Show the pdflatex error log" : "Compile status"
          }
        >
          {statusPill.icon}
          {statusPill.label}
        </button>

        <div className="ml-auto flex items-center gap-1">
          <button
            type="button"
            onClick={() => setHistoryOpen(true)}
            className="btn-ghost h-9 gap-1.5"
            title="AI change history — view and undo changes"
            aria-label="AI change history"
          >
            <History className="h-4 w-4" />
            <span className="hidden text-xs lg:inline">History</span>
            {historyTotal > 0 ? (
              <span className="badge !px-1.5 !py-0 text-[10px]">
                {historyTotal}
              </span>
            ) : null}
          </button>

          <button
            type="button"
            onClick={() => saveAndCompile(latexRef.current)}
            disabled={status === "compiling"}
            className="btn-secondary h-9"
            title="Compile (Ctrl/Cmd + S)"
          >
            <RefreshCw
              className={`h-4 w-4 ${status === "compiling" ? "animate-spin" : ""}`}
            />
            <span className="hidden sm:inline">Compile</span>
          </button>

          <button
            type="button"
            onClick={downloadTex}
            className="btn-ghost h-9"
            title="Download .tex"
          >
            <FileCode2 className="h-4 w-4" />
            <span className="hidden lg:inline">.tex</span>
          </button>

          <button
            type="button"
            onClick={downloadPdf}
            disabled={!pdfUrl}
            className="btn-ghost h-9"
            title="Download .pdf"
          >
            <FileDown className="h-4 w-4" />
            <span className="hidden lg:inline">.pdf</span>
          </button>

          <ThemeToggle />

          <button
            type="button"
            onClick={() => setSettingsOpen(true)}
            className="btn-ghost h-9 w-9 !px-0"
            title="AI settings"
            aria-label="AI settings"
          >
            <Settings className="h-4 w-4" />
          </button>
        </div>
      </header>

      <div ref={splitRef} className="flex min-h-0 flex-1 flex-col md:flex-row">
        <section
          className="flex min-h-0 w-full flex-1 flex-col md:w-[var(--left)] md:flex-none md:shrink-0"
          style={{ "--left": `${leftPercent}%` } as React.CSSProperties}
        >
          <div className="flex h-9 shrink-0 items-center justify-between gap-2 border-b border-border bg-surface px-2">
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setAssetsOpen((value) => !value)}
                className="btn-ghost h-7 gap-1 !px-1.5 text-[11px]"
                title={assetsOpen ? "Hide assets panel" : "Show assets panel"}
              >
                {assetsOpen ? (
                  <PanelLeftClose className="h-3.5 w-3.5" />
                ) : (
                  <PanelLeftOpen className="h-3.5 w-3.5" />
                )}
                <ImageIcon className="h-3.5 w-3.5" />
                Assets
                <span className="badge !px-1.5 !py-0 text-[10px]">
                  {assets.length}
                </span>
              </button>
              <span className="ml-1 font-mono text-[11px] text-muted">main.tex</span>
            </div>
            <span
              className={`text-[11px] ${
                saveState === "error" ? "text-danger" : "text-faint"
              }`}
            >
              {saveLabel}
            </span>
          </div>

          <div className="flex min-h-0 flex-1 flex-col sm:flex-row">
            {assetsOpen ? (
              <div className="w-full shrink-0 border-b border-border sm:w-[210px] sm:border-b-0 sm:border-r md:w-[240px]">
                <AssetsPanel
                  documentId={documentId}
                  assets={assets}
                  onAssetsChange={setAssets}
                  onInsertImage={insertImage}
                />
              </div>
            ) : null}

            <div className="min-h-0 min-w-0 flex-1">
              <CodeEditor
                ref={editorRef}
                value={latex}
                onChange={setLatex}
                dark={dark}
              />
            </div>
          </div>
        </section>

        <div
          role="separator"
          aria-orientation="vertical"
          onPointerDown={startDrag}
          className="hidden w-1.5 shrink-0 cursor-col-resize bg-border/70 transition-colors hover:bg-accent/60 md:block"
          title="Drag to resize"
        />

        <section className="min-h-0 flex-1 border-t border-border md:border-t-0">
          <PdfPreview
            pdfUrl={pdfUrl}
            status={status}
            log={compileLog}
            showLog={showLog}
            onToggleLog={() => setShowLog((value) => !value)}
            onCompile={() => saveAndCompile(latexRef.current)}
          />
        </section>
      </div>

      <AiBar
        documentId={documentId}
        latex={latex}
        compileLog={compileLog}
        compileFailed={status === "error"}
        aiReady={aiReady}
        model={model}
        explanation={aiExplanation}
        undoAvailable={undoEntry !== null}
        onApply={applyAi}
        onUndo={undoAi}
        onDismiss={dismissAiNotice}
        onOpenHistory={() => setHistoryOpen(true)}
        onOpenSettings={() => setSettingsOpen(true)}
      />

      <SettingsDialog
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        onSaved={() => router.refresh()}
      />

      <HistoryDrawer
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        documentId={documentId}
        currentLatex={latex}
        onRestore={(value, note) => {
          restoreFromHistory(value, note);
          setHistoryOpen(false);
        }}
      />
    </div>
  );
}
