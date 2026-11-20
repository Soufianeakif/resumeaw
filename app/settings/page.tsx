import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { SettingsPanel } from "@/components/settings-panel";
import { ThemeToggle } from "@/components/theme-toggle";

export const metadata = { title: "Settings — resumeaw" };

export default function SettingsPage() {
  return (
    <div className="min-h-screen">
      <header className="border-b border-border bg-background/85 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-5 py-3">
          <Link href="/" className="btn-ghost">
            <ArrowLeft className="h-4 w-4" />
            Documents
          </Link>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">Settings</span>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-5 py-8">
        <h1 className="text-2xl font-semibold tracking-tight">AI settings</h1>
        <p className="mt-1 max-w-xl text-sm text-muted">
          resumeaw talks to OpenRouter directly from your machine. The key is stored in
          the local SQLite database and never leaves your computer except in requests to
          openrouter.ai.
        </p>

        <div className="card mt-6 p-5">
          <SettingsPanel />
        </div>
      </main>
    </div>
  );
}
