"use client";

import { useRef, useState } from "react";
import { CheckCircle2, FileText, Loader2, UploadCloud } from "lucide-react";
import { Modal } from "./ui/modal";

const ACCEPT =
  ".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const MAX_BYTES = 20 * 1024 * 1024;

function humanSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function ImportDialog({
  open,
  onClose,
  onImported,
}: {
  open: boolean;
  onClose: () => void;
  onImported: (documentId: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [result, setResult] = useState<{ documentId: string; note: string } | null>(
    null
  );

  function reset() {
    setFile(null);
    setTitle("");
    setError(null);
    setBusy(false);
    setResult(null);
    setDragging(false);
  }

  function close() {
    if (busy) return;
    reset();
    onClose();
  }

  function choose(selected: File | null | undefined) {
    if (!selected) return;

    const extension = selected.name.toLowerCase().split(".").pop();
    if (extension !== "pdf" && extension !== "docx") {
      setError("Choose a PDF or Word (.docx) file.");
      return;
    }
    if (selected.size > MAX_BYTES) {
      setError("The file is larger than 20 MB.");
      return;
    }

    setError(null);
    setFile(selected);
    if (!title.trim()) {
      setTitle(
        selected.name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim()
      );
    }
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!file || busy) return;

    setBusy(true);
    setError(null);
    try {
      const body = new FormData();
      body.append("file", file);
      body.append("title", title);

      const response = await fetch("/api/import", { method: "POST", body });
      const data = (await response.json()) as {
        document?: { id: string };
        note?: string | null;
        error?: string;
      };

      if (!response.ok || !data.document) {
        throw new Error(data.error ?? "Could not convert this file.");
      }

      if (data.note) {
        setResult({ documentId: data.document.id, note: data.note });
        return;
      }

      const id = data.document.id;
      reset();
      onImported(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not convert this file.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={close}
      title="Import PDF or Word"
      description="Convert an existing resume into a new LaTeX document."
      size="lg"
      footer={
        result ? (
          <button
            type="button"
            className="btn-primary"
            onClick={() => {
              const id = result.documentId;
              reset();
              onImported(id);
            }}
          >
            Open document
          </button>
        ) : (
          <>
            <button
              type="button"
              className="btn-secondary"
              onClick={close}
              disabled={busy}
            >
              Cancel
            </button>
            <button
              type="submit"
              form="import-form"
              className="btn-primary"
              disabled={!file || busy}
            >
              {busy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <UploadCloud className="h-4 w-4" />
              )}
              {busy ? "Converting…" : "Convert to LaTeX"}
            </button>
          </>
        )
      }
    >
      {result ? (
        <div className="space-y-3">
          <div className="flex items-start gap-2 rounded-lg border border-success/30 bg-success/10 p-3">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />
            <div>
              <p className="text-sm font-medium text-success">Document created</p>
              <p className="mt-1 text-xs text-muted">{result.note}</p>
            </div>
          </div>
          <p className="text-xs text-muted">
            The new document is saved in SQLite. Open it to review the LaTeX and tweak
            the layout.
          </p>
        </div>
      ) : (
        <form id="import-form" onSubmit={submit} className="space-y-4">
          <div
            onDragOver={(event) => {
              event.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(event) => {
              event.preventDefault();
              setDragging(false);
              choose(event.dataTransfer.files?.[0]);
            }}
            onClick={() => inputRef.current?.click()}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                inputRef.current?.click();
              }
            }}
            role="button"
            tabIndex={0}
            className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed px-4 py-6 text-center transition ${
              dragging
                ? "border-accent bg-accent/10"
                : "border-border bg-background/60 hover:border-accent/50"
            }`}
          >
            {file ? (
              <>
                <FileText className="h-6 w-6 text-accent" />
                <p className="mt-2 break-all text-sm font-medium">{file.name}</p>
                <p className="mt-0.5 text-xs text-muted">
                  {humanSize(file.size)} · click to choose another file
                </p>
              </>
            ) : (
              <>
                <UploadCloud className="h-6 w-6 text-muted" />
                <p className="mt-2 text-sm font-medium">
                  Drop a PDF or Word file here
                </p>
                <p className="mt-0.5 text-xs text-muted">
                  or click to browse · .pdf / .docx · up to 20 MB
                </p>
              </>
            )}
            <input
              ref={inputRef}
              type="file"
              accept={ACCEPT}
              className="hidden"
              onChange={(event) => choose(event.target.files?.[0])}
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="import-title" className="text-sm font-medium">
              Document title
            </label>
            <input
              id="import-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Imported resume"
              className="field"
            />
          </div>

          {error ? (
            <p className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
              {error}
            </p>
          ) : null}

          <p className="text-xs leading-relaxed text-muted">
            Text is extracted locally from the file. With an OpenRouter key configured,
            your selected model rebuilds the structure as proper LaTeX; otherwise a
            built-in converter produces a clean, compilable document.
          </p>
        </form>
      )}
    </Modal>
  );
}
