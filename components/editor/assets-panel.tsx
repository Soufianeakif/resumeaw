"use client";

import { useRef, useState } from "react";
import {
  FileText,
  Image as ImageIcon,
  Loader2,
  Plus,
  Trash2,
  Upload,
} from "lucide-react";
import type { ClientAsset } from "@/lib/types";

const ACCEPT = ".png,.jpg,.jpeg,.pdf,.txt,.docx";

export function AssetsPanel({
  documentId,
  assets,
  onAssetsChange,
  onInsertImage,
}: {
  documentId: string;
  assets: ClientAsset[];
  onAssetsChange: (assets: ClientAsset[]) => void;
  onInsertImage: (filename: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function upload(files: FileList | File[]) {
    const list = Array.from(files);
    if (list.length === 0) return;

    setUploading(true);
    setError(null);
    try {
      const form = new FormData();
      for (const file of list) form.append("files", file);

      const response = await fetch(`/api/documents/${documentId}/assets`, {
        method: "POST",
        body: form,
      });
      const data = (await response.json()) as {
        assets?: ClientAsset[];
        errors?: string[];
        error?: string;
      };

      if (!response.ok) {
        throw new Error(data.error ?? "Upload failed.");
      }

      if (data.assets?.length) {
        onAssetsChange([...assets, ...data.assets]);
      }
      if (data.errors?.length) {
        setError(data.errors.join(" "));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function remove(asset: ClientAsset) {
    setDeletingId(asset.id);
    setError(null);
    try {
      const response = await fetch(
        `/api/documents/${documentId}/assets?assetId=${encodeURIComponent(asset.id)}`,
        { method: "DELETE" }
      );
      if (!response.ok) throw new Error("Could not delete the file.");
      onAssetsChange(assets.filter((item) => item.id !== asset.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete the file.");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-surface/60">
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted">
            Assets
          </span>
          <span className="badge">{assets.length}</span>
        </div>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="btn-secondary !px-2 !py-1 text-xs"
          title="Upload files"
        >
          {uploading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Plus className="h-3.5 w-3.5" />
          )}
          Upload
        </button>
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          multiple
          className="hidden"
          onChange={(event) => {
            if (event.target.files) void upload(event.target.files);
          }}
        />
      </div>

      <div
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          if (event.dataTransfer.files.length > 0) {
            void upload(event.dataTransfer.files);
          }
        }}
        className={`m-2 flex flex-col items-center justify-center rounded-lg border border-dashed px-2 py-3 text-center text-[11px] transition ${
          dragging
            ? "border-accent bg-accent/10 text-foreground"
            : "border-border text-faint"
        }`}
      >
        <Upload className="mb-1 h-3.5 w-3.5" />
        Drop images or reference docs
        <span className="mt-0.5 text-[10px]">png · jpg · pdf · txt · docx</span>
      </div>

      {error ? (
        <p className="mx-2 mb-2 rounded border border-danger/30 bg-danger/10 px-2 py-1 text-[11px] text-danger">
          {error}
        </p>
      ) : null}

      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
        {assets.length === 0 ? (
          <p className="px-1 py-4 text-center text-[11px] leading-relaxed text-faint">
            No files yet. Upload a headshot to insert it, or an old resume PDF so the
            AI can read it.
          </p>
        ) : (
          <ul className="space-y-1.5">
            {assets.map((asset) => (
              <li
                key={asset.id}
                className="rounded-lg border border-border bg-background/70 p-1.5"
              >
                <div className="flex items-center gap-2">
                  {asset.is_image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={asset.url}
                      alt={asset.original_name}
                      className="h-9 w-9 shrink-0 rounded border border-border object-cover"
                    />
                  ) : (
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded border border-border bg-elevated">
                      <FileText className="h-4 w-4 text-muted" />
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <p
                      className="truncate font-mono text-[11px]"
                      title={asset.original_name}
                    >
                      {asset.filename}
                    </p>
                    <p className="truncate text-[10px] text-faint">
                      {asset.is_reference ? "Reference doc" : "Image"}
                      {asset.extracted_text
                        ? ` · ${asset.extracted_text.length.toLocaleString()} chars extracted`
                        : asset.is_reference
                          ? " · no text extracted"
                          : ""}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void remove(asset)}
                    disabled={deletingId === asset.id}
                    className="btn-ghost h-6 w-6 !px-0 hover:text-danger"
                    aria-label={`Delete ${asset.filename}`}
                    title="Delete file"
                  >
                    {deletingId === asset.id ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Trash2 className="h-3 w-3" />
                    )}
                  </button>
                </div>

                <div className="mt-1.5">
                  {asset.is_image ? (
                    <button
                      type="button"
                      onClick={() => onInsertImage(asset.filename)}
                      className="flex w-full items-center justify-center gap-1 rounded border border-border bg-surface py-1 text-[10px] font-medium transition hover:border-accent/50 hover:text-accent"
                      title={`Insert \\includegraphics for ${asset.filename}`}
                    >
                      <ImageIcon className="h-3 w-3" />
                      Insert \includegraphics
                    </button>
                  ) : (
                    <span className="flex items-center justify-center gap-1 rounded border border-border bg-elevated py-1 text-[10px] text-muted">
                      <FileText className="h-3 w-3" />
                      Reference in AI
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
