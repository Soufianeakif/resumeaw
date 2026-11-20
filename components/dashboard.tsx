"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ChevronDown,
  Copy,
  FileText,
  Github,
  Image as ImageIcon,
  Loader2,
  Pencil,
  Plus,
  Settings,
  Smartphone,
  Trash2,
  Upload,
} from "lucide-react";
import { TEMPLATES } from "@/lib/templates";
import type { DashboardDocument } from "@/lib/types";
import { formatDateTime, formatRelativeTime } from "@/lib/format";
import { SettingsDialog } from "./settings-dialog";
import { ImportDialog } from "./import-dialog";
import { ThemeToggle } from "./theme-toggle";
import { ShareWithPhone } from "./share-with-phone";
import { Modal } from "./ui/modal";

export function Dashboard({
  initialDocuments,
}: {
  initialDocuments: DashboardDocument[];
}) {
  const router = useRouter();
  const [documents, setDocuments] = useState(initialDocuments);
  const [menuOpen, setMenuOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [creating, setCreating] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [renameTarget, setRenameTarget] = useState<DashboardDocument | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<DashboardDocument | null>(null);
  const [error, setError] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setDocuments(initialDocuments);
  }, [initialDocuments]);

  useEffect(() => {
    function onClick(event: MouseEvent) {
      if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const reload = useCallback(async () => {
    try {
      const response = await fetch("/api/documents", { cache: "no-store" });
      const data = (await response.json()) as { documents: DashboardDocument[] };
      setDocuments(data.documents ?? []);
    } catch {
      setError("Could not refresh the document list.");
    }
    router.refresh();
  }, [router]);

  async function createDocument(templateId: string) {
    setCreating(templateId);
    setError(null);
    try {
      const response = await fetch("/api/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ templateId }),
      });
      const data = (await response.json()) as {
        document?: { id: string };
        error?: string;
      };
      if (!response.ok || !data.document) {
        throw new Error(data.error ?? "Could not create the document.");
      }
      setMenuOpen(false);
      router.push(`/editor/${data.document.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create the document.");
    } finally {
      setCreating(null);
    }
  }

  async function duplicate(document: DashboardDocument) {
    setBusyId(document.id);
    setError(null);
    try {
      const response = await fetch("/api/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ duplicateOf: document.id }),
      });
      if (!response.ok) throw new Error("Duplicate failed.");
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Duplicate failed.");
    } finally {
      setBusyId(null);
    }
  }

  async function rename(event: React.FormEvent) {
    event.preventDefault();
    if (!renameTarget) return;
    const title = renameValue.trim();
    if (!title) return;
    setBusyId(renameTarget.id);
    try {
      const response = await fetch(`/api/documents/${renameTarget.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title }),
      });
      if (!response.ok) throw new Error("Rename failed.");
      setRenameTarget(null);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Rename failed.");
    } finally {
      setBusyId(null);
    }
  }

  async function remove() {
    if (!deleteTarget) return;
    setBusyId(deleteTarget.id);
    try {
      const response = await fetch(`/api/documents/${deleteTarget.id}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("Delete failed.");
      setDocuments((current) =>
        current.filter((doc) => doc.id !== deleteTarget.id)
      );
      setDeleteTarget(null);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="flex min-h-screen">
      {/* Sidebar backdrop (mobile) */}
      {sidebarOpen ? (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm md:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      ) : null}

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-border bg-surface transition-transform md:static md:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-14 items-center gap-3 border-b border-border px-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/resumeaw.jpg"
            alt="resumeaw logo"
            width={32}
            height={32}
            className="h-8 w-8 rounded-lg object-cover ring-1 ring-border"
          />
          <span className="text-base font-semibold">Reasumeaw</span>
        </div>
        <nav className="flex-1 space-y-1 p-3 text-sm">
          <button
            type="button"
            onClick={() => setSidebarOpen(false)}
            className="flex w-full items-center gap-2 rounded-lg bg-elevated px-3 py-2 font-medium"
          >
            <FileText className="h-4 w-4 text-accent" />
            Documents
          </button>
          <button
            type="button"
            onClick={() => {
              setShareOpen(true);
              setSidebarOpen(false);
            }}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-muted transition hover:bg-elevated hover:text-foreground"
          >
            <Smartphone className="h-4 w-4" />
            Share with phone
          </button>
          <button
            type="button"
            onClick={() => {
              setImportOpen(true);
              setSidebarOpen(false);
            }}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-muted transition hover:bg-elevated hover:text-foreground"
          >
            <Upload className="h-4 w-4" />
            Import
          </button>
          <button
            type="button"
            onClick={() => {
              setSettingsOpen(true);
              setSidebarOpen(false);
            }}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-muted transition hover:bg-elevated hover:text-foreground"
          >
            <Settings className="h-4 w-4" />
            Settings
          </button>
        </nav>
        <div className="border-t border-border p-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-muted">Theme</span>
            <ThemeToggle />
          </div>
        </div>
      </aside>

      <div className="flex min-h-screen flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-border bg-background/85 px-4 backdrop-blur md:px-6">
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            className="btn-ghost h-9 w-9 !px-0 md:hidden"
            aria-label="Open menu"
          >
            <span className="sr-only">Menu</span>
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>

          <div className="relative" ref={menuRef}>
            <button
              type="button"
              onClick={() => setMenuOpen((open) => !open)}
              className="btn-primary"
              aria-expanded={menuOpen}
              aria-haspopup="menu"
            >
              <Plus className="h-4 w-4" />
              New document
              <ChevronDown className="h-3.5 w-3.5 opacity-80" />
            </button>
            {menuOpen ? (
              <div
                role="menu"
                className="absolute left-0 z-40 mt-2 w-72 animate-fade-in overflow-hidden rounded-xl border border-border bg-surface shadow-xl"
              >
                {TEMPLATES.map((template) => (
                  <button
                    key={template.id}
                    type="button"
                    role="menuitem"
                    disabled={creating !== null}
                    onClick={() => void createDocument(template.id)}
                    className="flex w-full items-start gap-3 px-3.5 py-3 text-left transition hover:bg-elevated disabled:opacity-60"
                  >
                    <FileText className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                    <span className="min-w-0">
                      <span className="flex items-center gap-2 text-sm font-medium">
                        {template.name}
                        {creating === template.id ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : null}
                      </span>
                      <span className="mt-0.5 block text-xs text-muted">
                        {template.description}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShareOpen(true)}
              className="btn-secondary"
              title="Share with your phone"
            >
              <Smartphone className="h-4 w-4" />
              <span className="hidden sm:inline">Share</span>
            </button>
          </div>
        </header>

        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 md:px-6 md:py-8">
          <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">Documents</h1>
              <p className="mt-1 text-sm text-muted">
                {documents.length === 0
                  ? "Nothing here yet — start from a template."
                  : `${documents.length} document${
                      documents.length === 1 ? "" : "s"
                    } stored locally in SQLite.`}
              </p>
            </div>
          </div>

          {error ? (
            <div className="mb-4 rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
              {error}
            </div>
          ) : null}

          {documents.length === 0 ? (
            <div className="card p-10 text-center">
              <FileText className="mx-auto h-9 w-9 text-faint" />
              <h2 className="mt-3 text-lg font-semibold">Create your first document</h2>
              <p className="mx-auto mt-1 max-w-md text-sm text-muted">
                Pick a starter template, upload your photo and old resume, then ask the
                assistant to fit everything on one page.
              </p>
              <div className="mt-6 grid gap-3 sm:grid-cols-3">
                {TEMPLATES.map((template) => (
                  <button
                    key={template.id}
                    type="button"
                    onClick={() => void createDocument(template.id)}
                    disabled={creating !== null}
                    className="rounded-xl border border-border bg-background p-4 text-left transition hover:border-accent/50 hover:bg-elevated disabled:opacity-60"
                  >
                    <FileText className="h-4 w-4 text-accent" />
                    <span className="mt-2 block text-sm font-medium">
                      {template.name}
                    </span>
                    <span className="mt-1 block text-xs text-muted">
                      {template.description}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {documents.map((document) => (
                <article
                  key={document.id}
                  className="card group flex flex-col overflow-hidden transition hover:border-accent/40"
                >
                  <Link
                    href={`/editor/${document.id}`}
                    className="flex gap-3 border-b border-border bg-elevated/40 p-4"
                  >
                    <div className="flex h-20 w-[60px] shrink-0 flex-col gap-1 rounded-md border border-border bg-surface p-2 shadow-sm">
                      <span className="h-1 w-6 rounded-full bg-accent/70" />
                      <span className="h-0.5 w-full rounded-full bg-border" />
                      <span className="h-0.5 w-4/5 rounded-full bg-border" />
                      <span className="mt-1 h-0.5 w-full rounded-full bg-border" />
                      <span className="h-0.5 w-3/4 rounded-full bg-border" />
                      <span className="mt-1 h-0.5 w-full rounded-full bg-border" />
                      <span className="h-0.5 w-2/3 rounded-full bg-border" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="truncate text-sm font-semibold group-hover:text-accent">
                        {document.title}
                      </h3>
                      <p
                        className="mt-1 text-xs text-muted"
                        title={formatDateTime(document.updated_at)}
                        suppressHydrationWarning
                      >
                        Updated{" "}
                        <span suppressHydrationWarning>
                          {formatRelativeTime(document.updated_at)}
                        </span>
                      </p>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {document.has_pdf ? (
                          <span className="badge border-success/30 text-success">
                            PDF ready
                          </span>
                        ) : (
                          <span className="badge">Draft</span>
                        )}
                        {document.asset_count > 0 ? (
                          <span className="badge">
                            <ImageIcon className="h-3 w-3" />
                            {document.asset_count} asset
                            {document.asset_count === 1 ? "" : "s"}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </Link>

                  <div className="flex items-center justify-between gap-1 p-2.5">
                    <Link
                      href={`/editor/${document.id}`}
                      className="btn-secondary flex-1 !py-1.5"
                    >
                      Open
                    </Link>
                    <button
                      type="button"
                      onClick={() => void duplicate(document)}
                      disabled={busyId === document.id}
                      className="btn-ghost h-8 w-8 !px-0"
                      title="Duplicate"
                      aria-label={`Duplicate ${document.title}`}
                    >
                      {busyId === document.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setRenameTarget(document);
                        setRenameValue(document.title);
                      }}
                      className="btn-ghost h-8 w-8 !px-0"
                      title="Rename"
                      aria-label={`Rename ${document.title}`}
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteTarget(document)}
                      className="btn-ghost h-8 w-8 !px-0 hover:text-danger"
                      title="Delete"
                      aria-label={`Delete ${document.title}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </main>

        <footer className="mt-auto border-t border-border bg-surface/40">
          <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-5 py-5 sm:flex-row">
            <div className="flex items-center gap-2 text-xs text-muted">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/resumeaw.jpg"
                alt=""
                width={24}
                height={24}
                className="h-6 w-6 rounded object-cover ring-1 ring-border"
              />
              <span>
                Developed by{" "}
                <span className="font-medium text-foreground">AKIF Soufiane</span>
              </span>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-2">
              <a
                href="https://github.com/Soufianeakif"
                target="_blank"
                rel="noreferrer noopener"
                className="btn-secondary h-9 gap-1.5"
                title="AKIF Soufiane on GitHub"
                aria-label="AKIF Soufiane on GitHub"
              >
                <Github className="h-4 w-4" />
                <span className="text-xs">Soufianeakif</span>
              </a>

              <a
                href="https://www.buymeacoffee.com/soufianeakif"
                target="_blank"
                rel="noreferrer noopener"
                className="inline-flex"
                title="Buy me a coffee"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="https://img.buymeacoffee.com/button-api/?text=Buy%20me%20a%20coffee&emoji=&slug=soufianeakif&button_colour=FFDD00&font_colour=000000&font_family=Comic&outline_colour=000000&coffee_colour=ffffff"
                  alt="Buy me a coffee"
                  width={210}
                  height={48}
                  className="h-10 w-auto"
                />
              </a>
            </div>
          </div>
        </footer>
      </div>

      <SettingsDialog
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        onSaved={() => router.refresh()}
      />

      <ImportDialog
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImported={(documentId) => {
          setImportOpen(false);
          router.push(`/editor/${documentId}`);
        }}
      />

      <ShareWithPhone open={shareOpen} onClose={() => setShareOpen(false)} />

      <Modal
        open={renameTarget !== null}
        onClose={() => setRenameTarget(null)}
        title="Rename document"
        size="sm"
      >
        <form onSubmit={rename} className="space-y-4">
          <input
            autoFocus
            value={renameValue}
            onChange={(event) => setRenameValue(event.target.value)}
            className="field"
            aria-label="Document title"
          />
          <div className="flex justify-end gap-2">
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setRenameTarget(null)}
            >
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={!renameValue.trim()}>
              Save
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        title="Delete document?"
        description={`"${deleteTarget?.title ?? ""}" and its uploaded files will be removed from disk. This cannot be undone.`}
        size="sm"
        footer={
          <>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setDeleteTarget(null)}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn-danger"
              onClick={() => void remove()}
              disabled={busyId === deleteTarget?.id}
            >
              {busyId === deleteTarget?.id ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
              Delete
            </button>
          </>
        }
      >
        <p className="text-sm text-muted">
          Any compiled PDF and uploaded assets for this document are deleted as well.
        </p>
      </Modal>
    </div>
  );
}
