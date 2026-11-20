import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { AppSettings, DocumentAsset, DocumentRecord } from "./types";

const DEFAULT_MODEL = "google/gemini-2.5-flash";

function dataDirectory() {
  return process.env.RESUMEAW_DATA_DIR
    ? path.resolve(process.env.RESUMEAW_DATA_DIR)
    : path.join(process.cwd(), "data");
}

export function databaseFile() {
  const dir = dataDirectory();
  fs.mkdirSync(dir, { recursive: true });
  return path.join(dir, "sqlite.db");
}

function migrate(db: Database.Database) {
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.exec(`
    CREATE TABLE IF NOT EXISTS documents (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      latex_code TEXT NOT NULL,
      last_pdf_path TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS document_assets (
      id TEXT PRIMARY KEY,
      document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
      filename TEXT NOT NULL,
      original_name TEXT NOT NULL,
      file_type TEXT NOT NULL,
      file_path TEXT NOT NULL,
      extracted_text TEXT,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS document_assets_document_id
      ON document_assets (document_id);

    CREATE TABLE IF NOT EXISTS settings (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      openrouter_api_key TEXT NOT NULL DEFAULT '',
      openrouter_model TEXT NOT NULL DEFAULT '${DEFAULT_MODEL}',
      openrouter_models TEXT NOT NULL DEFAULT '',
      api_status TEXT NOT NULL DEFAULT 'untested',
      api_status_message TEXT NOT NULL DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS ai_history (
      id TEXT PRIMARY KEY,
      document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
      prompt TEXT NOT NULL,
      explanation TEXT,
      latex_before TEXT,
      latex_after TEXT,
      model TEXT,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS ai_history_document_id
      ON ai_history (document_id);
  `);

  // Older databases predate the editable model list.
  const settingsColumns = db
    .prepare(`PRAGMA table_info(settings)`)
    .all() as { name: string }[];
  if (!settingsColumns.some((column) => column.name === "openrouter_models")) {
    db.exec(
      `ALTER TABLE settings ADD COLUMN openrouter_models TEXT NOT NULL DEFAULT ''`
    );
  }

  db.prepare(
    `INSERT OR IGNORE INTO settings
       (id, openrouter_api_key, openrouter_model, openrouter_models, api_status, api_status_message)
     VALUES (1, '', ?, '', 'untested', '')`
  ).run(DEFAULT_MODEL);
}

const globalForDb = globalThis as unknown as {
  __resumeawDb?: Database.Database;
};

export function getDb() {
  if (!globalForDb.__resumeawDb) {
    const db = new Database(databaseFile());
    migrate(db);
    globalForDb.__resumeawDb = db;
  }
  return globalForDb.__resumeawDb;
}

export const defaultModel = DEFAULT_MODEL;

/* ------------------------------------------------------------------ */
/* Documents                                                           */
/* ------------------------------------------------------------------ */

export function listDocuments(): DocumentRecord[] {
  return getDb()
    .prepare(`SELECT * FROM documents ORDER BY updated_at DESC`)
    .all() as DocumentRecord[];
}

export function getDocument(id: string): DocumentRecord | null {
  const row = getDb().prepare(`SELECT * FROM documents WHERE id = ?`).get(id);
  return (row as DocumentRecord | undefined) ?? null;
}

export function createDocument(input: {
  title: string;
  latexCode: string;
}): DocumentRecord {
  const now = new Date().toISOString();
  const doc: DocumentRecord = {
    id: randomUUID(),
    title: input.title,
    latex_code: input.latexCode,
    last_pdf_path: null,
    created_at: now,
    updated_at: now,
  };
  getDb()
    .prepare(
      `INSERT INTO documents (id, title, latex_code, last_pdf_path, created_at, updated_at)
       VALUES (@id, @title, @latex_code, @last_pdf_path, @created_at, @updated_at)`
    )
    .run(doc);
  return doc;
}

export function updateDocument(
  id: string,
  fields: { title?: string; latexCode?: string; lastPdfPath?: string | null }
): DocumentRecord | null {
  const existing = getDocument(id);
  if (!existing) return null;

  getDb()
    .prepare(
      `UPDATE documents
         SET title = COALESCE(?, title),
             latex_code = COALESCE(?, latex_code),
             last_pdf_path = COALESCE(?, last_pdf_path),
             updated_at = ?
       WHERE id = ?`
    )
    .run(
      fields.title ?? null,
      fields.latexCode ?? null,
      fields.lastPdfPath === undefined ? null : fields.lastPdfPath,
      new Date().toISOString(),
      id
    );

  return getDocument(id);
}

export function deleteDocument(id: string) {
  getDb().prepare(`DELETE FROM documents WHERE id = ?`).run(id);
}

/* ------------------------------------------------------------------ */
/* Assets                                                              */
/* ------------------------------------------------------------------ */

export function listAssets(documentId: string): DocumentAsset[] {
  return getDb()
    .prepare(
      `SELECT * FROM document_assets WHERE document_id = ? ORDER BY created_at ASC`
    )
    .all(documentId) as DocumentAsset[];
}

export function getAsset(documentId: string, assetId: string): DocumentAsset | null {
  const row = getDb()
    .prepare(`SELECT * FROM document_assets WHERE id = ? AND document_id = ?`)
    .get(assetId, documentId);
  return (row as DocumentAsset | undefined) ?? null;
}

export function createAsset(input: Omit<DocumentAsset, "id" | "created_at">): DocumentAsset {
  const asset: DocumentAsset = {
    ...input,
    id: randomUUID(),
    created_at: new Date().toISOString(),
  };
  getDb()
    .prepare(
      `INSERT INTO document_assets
         (id, document_id, filename, original_name, file_type, file_path, extracted_text, created_at)
       VALUES (@id, @document_id, @filename, @original_name, @file_type, @file_path, @extracted_text, @created_at)`
    )
    .run(asset);
  return asset;
}

export function deleteAsset(documentId: string, assetId: string): DocumentAsset | null {
  const asset = getAsset(documentId, assetId);
  if (!asset) return null;
  getDb()
    .prepare(`DELETE FROM document_assets WHERE id = ? AND document_id = ?`)
    .run(assetId, documentId);
  return asset;
}

/** Asset filenames already used inside a document (for unique-name checks). */
export function assetFilenames(documentId: string): string[] {
  return (
    getDb()
      .prepare(`SELECT filename FROM document_assets WHERE document_id = ?`)
      .all(documentId) as { filename: string }[]
  ).map((row) => row.filename);
}

/* ------------------------------------------------------------------ */
/* Settings                                                            */
/* ------------------------------------------------------------------ */

export function getSettings(): AppSettings {
  const row = getDb().prepare(`SELECT * FROM settings WHERE id = 1`).get();
  if (row) return row as AppSettings;
  getDb()
    .prepare(
      `INSERT INTO settings (id, openrouter_api_key, openrouter_model, api_status, api_status_message)
       VALUES (1, '', ?, 'untested', '')`
    )
    .run(DEFAULT_MODEL);
  return getDb().prepare(`SELECT * FROM settings WHERE id = 1`).get() as AppSettings;
}

export function saveSettings(input: {
  apiKey: string;
  model: string;
  models?: string;
  status?: AppSettings["api_status"];
  statusMessage?: string;
}): AppSettings {
  const model = input.model.trim() || DEFAULT_MODEL;
  getDb()
    .prepare(
      `UPDATE settings
          SET openrouter_api_key = ?,
              openrouter_model = ?,
              openrouter_models = COALESCE(?, openrouter_models),
              api_status = COALESCE(?, api_status),
              api_status_message = COALESCE(?, api_status_message)
        WHERE id = 1`
    )
    .run(
      input.apiKey,
      model,
      input.models ?? null,
      input.status ?? null,
      input.statusMessage ?? null
    );
  return getSettings();
}

/* ------------------------------------------------------------------ */
/* AI history                                                          */
/* ------------------------------------------------------------------ */

export function addHistory(input: {
  documentId: string;
  prompt: string;
  explanation: string;
  latexBefore: string;
  latexAfter: string;
  model: string;
}) {
  getDb()
    .prepare(
      `INSERT INTO ai_history
         (id, document_id, prompt, explanation, latex_before, latex_after, model, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      randomUUID(),
      input.documentId,
      input.prompt,
      input.explanation,
      input.latexBefore,
      input.latexAfter,
      input.model,
      new Date().toISOString()
    );
}

export type HistoryEntry = {
  id: string;
  document_id: string;
  prompt: string;
  explanation: string | null;
  latex_before: string;
  latex_after: string;
  model: string | null;
  created_at: string;
};

export function listHistoryEntries(
  documentId: string,
  limit = 30
): HistoryEntry[] {
  return getDb()
    .prepare(
      `SELECT * FROM ai_history WHERE document_id = ?
        ORDER BY created_at DESC LIMIT ?`
    )
    .all(documentId, limit) as HistoryEntry[];
}

export function countHistory(documentId: string): number {
  const row = getDb()
    .prepare(`SELECT COUNT(*) AS total FROM ai_history WHERE document_id = ?`)
    .get(documentId) as { total: number } | undefined;
  return row?.total ?? 0;
}

export function listHistory(documentId: string, limit = 20) {
  return getDb()
    .prepare(
      `SELECT id, document_id, prompt, explanation, model, created_at
         FROM ai_history WHERE document_id = ?
        ORDER BY created_at DESC LIMIT ?`
    )
    .all(documentId, limit) as {
    id: string;
    document_id: string;
    prompt: string;
    explanation: string | null;
    model: string | null;
    created_at: string;
  }[];
}
