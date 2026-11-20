import fs from "node:fs/promises";
import fsSync from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";

export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;
export const IMAGE_EXTENSIONS = [".png", ".jpg", ".jpeg"];
export const DOCUMENT_EXTENSIONS = [".pdf", ".txt", ".docx"];

const SAFE_ID = /^[a-zA-Z0-9_-]{1,80}$/;

export function isSafeDocumentId(id: string) {
  return SAFE_ID.test(id);
}

export function publicDirectory() {
  return path.join(process.cwd(), "public");
}

/**
 * Runtime files live under data/ (next to sqlite.db) rather than public/.
 * Next's dev server watches public/, so writing PDFs there triggered a page
 * reload that discarded editor state (undo stack, AI changelog, compile log).
 */
export function storageRoot() {
  return process.env.RESUMEAW_DATA_DIR
    ? path.resolve(process.env.RESUMEAW_DATA_DIR)
    : path.join(process.cwd(), "data");
}

export function uploadsRoot() {
  return path.join(storageRoot(), "uploads");
}

export function documentUploadDirectory(documentId: string) {
  if (!isSafeDocumentId(documentId)) {
    throw new Error("Invalid document id");
  }
  return path.join(uploadsRoot(), documentId);
}

export function compiledDirectory() {
  return path.join(storageRoot(), "compiled");
}

export function compiledPdfPath(documentId: string) {
  if (!isSafeDocumentId(documentId)) {
    throw new Error("Invalid document id");
  }
  return path.join(compiledDirectory(), `${documentId}.pdf`);
}

/* Legacy locations used before files moved out of public/. Kept readable so
   documents created with an older build keep working. */

function legacyUploadsRoot() {
  return path.join(publicDirectory(), "uploads");
}

function legacyCompiledPdfPath(documentId: string) {
  return path.join(publicDirectory(), "compiled", `${documentId}.pdf`);
}

export function compiledPdfCandidates(documentId: string) {
  return [compiledPdfPath(documentId), legacyCompiledPdfPath(documentId)];
}

export function hasCompiledPdf(documentId: string) {
  return compiledPdfCandidates(documentId).some((candidate) =>
    fsSync.existsSync(candidate)
  );
}

/** Directory holding this document's assets (new location first). */
export async function findDocumentUploadDirectory(documentId: string) {
  const candidates = [
    documentUploadDirectory(documentId),
    path.join(legacyUploadsRoot(), documentId),
  ];
  for (const candidate of candidates) {
    try {
      const stat = await fs.stat(candidate);
      if (stat.isDirectory()) return candidate;
    } catch {
      // try next location
    }
  }
  return documentUploadDirectory(documentId);
}

/** Sanitized filename that is safe to pass to pdflatex and to URLs. */
export function sanitizeFilename(name: string) {
  const base = path.basename(name).normalize("NFKD");
  const dot = base.lastIndexOf(".");
  const rawExt = dot > 0 ? base.slice(dot) : "";
  const ext = rawExt.toLowerCase().replace(/[^a-z0-9.]/g, "");
  const stem = (dot > 0 ? base.slice(0, dot) : base)
    .replace(/[^\w.-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^[._-]+|[._-]+$/g, "")
    .slice(0, 60);
  return `${stem || "file"}${ext}` || `file-${Date.now()}`;
}

/** Avoid collisions with filenames already present in the folder. */
export async function uniqueFilename(
  directory: string,
  desired: string,
  taken: string[] = []
): Promise<string> {
  const existing = new Set(taken);
  try {
    for (const entry of await fs.readdir(directory)) existing.add(entry);
  } catch {
    // directory does not exist yet
  }

  if (!existing.has(desired)) return desired;

  const ext = path.extname(desired);
  const stem = path.basename(desired, ext);
  for (let i = 2; i < 1000; i += 1) {
    const candidate = `${stem}-${i}${ext}`;
    if (!existing.has(candidate)) return candidate;
  }
  return `${stem}-${randomUUID().slice(0, 8)}${ext}`;
}

export function isImageFile(filename: string, fileType: string) {
  const ext = path.extname(filename).toLowerCase();
  return IMAGE_EXTENSIONS.includes(ext) || fileType.startsWith("image/");
}

export function isReferenceDocument(filename: string, fileType: string) {
  const ext = path.extname(filename).toLowerCase();
  return (
    DOCUMENT_EXTENSIONS.includes(ext) ||
    fileType === "application/pdf" ||
    fileType === "text/plain" ||
    fileType.startsWith("text/") ||
    fileType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  );
}

export function assetPublicUrl(asset: { document_id: string; filename: string }) {
  return `/api/files/uploads/${asset.document_id}/${encodeURIComponent(asset.filename)}`;
}

export async function removeDocumentAssetFile(documentId: string, filename: string) {
  await Promise.all(
    [
      path.join(documentUploadDirectory(documentId), filename),
      path.join(legacyUploadsRoot(), documentId, filename),
    ].map((target) => fs.rm(target, { force: true }).catch(() => undefined))
  );
}

export async function removeDocumentFiles(documentId: string) {
  if (!isSafeDocumentId(documentId)) return;
  await fs.rm(documentUploadDirectory(documentId), { recursive: true, force: true });
  await fs.rm(path.join(legacyUploadsRoot(), documentId), {
    recursive: true,
    force: true,
  });
  await Promise.all(
    compiledPdfCandidates(documentId).map((target) =>
      fs.rm(target, { force: true }).catch(() => undefined)
    )
  );
}
