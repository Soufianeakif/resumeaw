"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Eye,
  EyeOff,
  Loader2,
  RefreshCw,
  Sparkles,
} from "lucide-react";

type Preset = { id: string; label: string };
type StatusPayload = { working: boolean; message: string };

const CUSTOM = "__custom__";
const DEFAULT_MODEL = "google/gemini-2.5-flash";

function splitModels(value: string) {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const raw of value.split(/[\n,]/)) {
    const id = raw.trim();
    if (!id || id.startsWith("#") || seen.has(id)) continue;
    seen.add(id);
    result.push(id);
  }
  return result;
}

export function SettingsPanel({
  onSaved,
  compact = false,
}: {
  onSaved?: () => void;
  compact?: boolean;
}) {
  const [loading, setLoading] = useState(true);
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState(DEFAULT_MODEL);
  const [modelsText, setModelsText] = useState("");
  const [presets, setPresets] = useState<Preset[]>([]);
  const [customMode, setCustomMode] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [applying, setApplying] = useState(false);
  const [loadingFree, setLoadingFree] = useState(false);
  const [freeNote, setFreeNote] = useState<string | null>(null);
  const [freeError, setFreeError] = useState<string | null>(null);
  const [result, setResult] = useState<StatusPayload | null>(null);
  const [savedStatus, setSavedStatus] = useState<"untested" | "connected" | "error">(
    "untested"
  );
  const [savedMessage, setSavedMessage] = useState("");
  const [loadError, setLoadError] = useState<string | null>(null);
  const autoLoadedFree = useRef(false);

  const loadFreeModels = useCallback(async () => {
    setLoadingFree(true);
    setFreeError(null);
    setFreeNote(null);
    try {
      const response = await fetch("/api/models", { cache: "no-store" });
      const data = (await response.json()) as {
        models?: { id: string; name: string }[];
        count?: number;
        error?: string;
      };
      if (!response.ok) {
        throw new Error(data.error ?? "Could not load free models from OpenRouter.");
      }
      const ids = (data.models ?? []).map((entry) => entry.id);
      if (ids.length === 0) {
        throw new Error("OpenRouter returned no free models right now.");
      }
      setModelsText(ids.join("\n"));
      setCustomMode(false);
      setFreeNote(
        `${ids.length} free model${ids.length === 1 ? "" : "s"} loaded from OpenRouter.`
      );
    } catch (error) {
      setFreeError(
        error instanceof Error ? error.message : "Could not load free models."
      );
    } finally {
      setLoadingFree(false);
    }
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const response = await fetch("/api/settings", { cache: "no-store" });
      if (!response.ok) throw new Error(`Settings request failed (${response.status})`);
      const data = (await response.json()) as {
        settings: {
          openrouter_api_key: string;
          openrouter_model: string;
          openrouter_models: string;
          api_status: "untested" | "connected" | "error";
          api_status_message: string;
        };
        models: string[];
        presets: Preset[];
      };
      const savedModels = data.settings.openrouter_models ?? "";
      setApiKey(data.settings.openrouter_api_key ?? "");
      setModel(data.settings.openrouter_model ?? DEFAULT_MODEL);
      setModelsText(savedModels);
      setPresets(data.presets ?? []);
      setSavedStatus(data.settings.api_status ?? "untested");
      setSavedMessage(data.settings.api_status_message ?? "");
      setCustomMode(
        Boolean(data.settings.openrouter_model) &&
          !savedModels.includes(data.settings.openrouter_model) &&
          !(data.presets ?? []).some(
            (preset) => preset.id === data.settings.openrouter_model
          )
      );
    } catch (error) {
      setLoadError(
        error instanceof Error ? error.message : "Could not load settings."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // First open with no saved list: fill it from OpenRouter's free catalogue.
  useEffect(() => {
    if (loading || modelsText.trim() || autoLoadedFree.current) return;
    autoLoadedFree.current = true;
    void loadFreeModels();
  }, [loading, modelsText, loadFreeModels]);

  const modelIds = useMemo(() => splitModels(modelsText), [modelsText]);

  const options = useMemo(() => {
    const list = modelIds.length > 0 ? modelIds : presets.map((preset) => preset.id);
    return list.includes(model) ? list : [model, ...list].filter(Boolean);
  }, [modelIds, presets, model]);

  async function apply(event: React.FormEvent) {
    event.preventDefault();
    setApplying(true);
    setResult(null);
    try {
      const response = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey, model, models: modelsText }),
      });
      const data = (await response.json()) as {
        working?: boolean;
        statusMessage?: string;
        apiStatus?: "connected" | "error" | "untested";
        models?: string[];
        settings?: { openrouter_models?: string };
        error?: string;
      };

      if (data.settings?.openrouter_models !== undefined) {
        setModelsText(data.settings.openrouter_models);
      }

      if (typeof data.working === "boolean") {
        setResult({
          working: data.working,
          message: data.statusMessage ?? "",
        });
        setSavedStatus(data.apiStatus ?? (data.working ? "connected" : "error"));
        setSavedMessage(data.statusMessage ?? "");
        if (data.working) onSaved?.();
      } else {
        setResult({
          working: false,
          message: data.error ?? "OpenRouter test failed.",
        });
      }
    } catch (error) {
      setResult({
        working: false,
        message:
          error instanceof Error ? error.message : "Network request failed.",
      });
    } finally {
      setApplying(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-8 text-sm text-muted">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading settings…
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="space-y-3 py-4">
        <p className="text-sm text-danger">{loadError}</p>
        <button type="button" onClick={() => void load()} className="btn-secondary">
          <RefreshCw className="h-4 w-4" /> Retry
        </button>
      </div>
    );
  }

  const statusMessage = result?.message ?? savedMessage;

  return (
    <form onSubmit={apply} className="space-y-5">
      <div className="space-y-2">
        <label htmlFor="api-key" className="text-sm font-medium">
          OpenRouter API key
        </label>
        <div className="relative">
          <input
            id="api-key"
            type={showKey ? "text" : "password"}
            value={apiKey}
            onChange={(event) => setApiKey(event.target.value)}
            placeholder="sk-or-v1-…"
            autoComplete="off"
            spellCheck={false}
            className="field pr-10 font-mono text-xs"
          />
          <button
            type="button"
            onClick={() => setShowKey((value) => !value)}
            className="absolute right-1 top-1/2 -translate-y-1/2 rounded p-2 text-muted hover:text-foreground"
            aria-label={showKey ? "Hide API key" : "Show API key"}
            title={showKey ? "Hide API key" : "Show API key"}
          >
            {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        <p className="text-xs text-muted">
          Stored locally in <code className="font-mono">data/sqlite.db</code>. Create a key
          at{" "}
          <a
            href="https://openrouter.ai/keys"
            target="_blank"
            rel="noreferrer"
            className="text-accent underline underline-offset-2"
          >
            openrouter.ai/keys
          </a>
          .
        </p>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <label htmlFor="model" className="text-sm font-medium">
            Active model
          </label>
          <span className="badge">{modelIds.length || options.length} available</span>
        </div>
        <select
          id="model"
          value={customMode ? CUSTOM : model}
          onChange={(event) => {
            if (event.target.value === CUSTOM) {
              setCustomMode(true);
              return;
            }
            setCustomMode(false);
            setModel(event.target.value);
          }}
          className="field"
        >
          {options.map((id) => {
            const preset = presets.find((entry) => entry.id === id);
            return (
              <option key={id} value={id}>
                {preset ? preset.label : id}
              </option>
            );
          })}
          <option value={CUSTOM}>Custom model ID…</option>
        </select>

        {customMode ? (
          <input
            type="text"
            value={model}
            onChange={(event) => setModel(event.target.value)}
            placeholder="vendor/model-id"
            className="field font-mono text-xs"
            aria-label="Custom OpenRouter model ID"
          />
        ) : null}
      </div>

      <div className="space-y-2">
        <label htmlFor="model-list" className="text-sm font-medium">
          Model list
        </label>
        <textarea
          id="model-list"
          value={modelsText}
          onChange={(event) => setModelsText(event.target.value)}
          rows={compact ? 7 : 10}
          spellCheck={false}
          placeholder={"vendor/model-id:free\nvendor/another-model:free"}
          className="field resize-y font-mono text-[11px] leading-relaxed"
        />
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => void loadFreeModels()}
            disabled={loadingFree}
            className="btn-secondary !py-1.5 text-xs"
          >
            {loadingFree ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Sparkles className="h-3.5 w-3.5" />
            )}
            {loadingFree ? "Loading…" : "Load all free models"}
          </button>
          <span className="text-[11px] text-muted">
            One model ID per line (# starts a comment). Add or remove lines to change the
            picker.
          </span>
        </div>
        {freeNote ? <p className="text-xs text-success">{freeNote}</p> : null}
        {freeError ? <p className="text-xs text-danger">{freeError}</p> : null}
        <p className="text-xs text-muted">
          Free models support text; only some accept images or PDFs. Pick a vision/PDF
          capable model to let the assistant inspect your rendered layout.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={applying} className="btn-primary">
          {applying ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
          {applying ? "Applying…" : "Apply & test"}
        </button>
        <span className="text-xs text-muted">
          Saves to SQLite, then checks the key against OpenRouter.
        </span>
      </div>

      {result || savedStatus !== "untested" ? (
        <div
          className={`rounded-lg border p-3 text-sm ${
            result
              ? result.working
                ? "border-success/30 bg-success/10"
                : "border-danger/30 bg-danger/10"
              : savedStatus === "connected"
                ? "border-success/30 bg-success/10"
                : "border-danger/30 bg-danger/10"
          }`}
        >
          <div className="flex items-center gap-2 font-medium">
            {(result?.working ?? savedStatus === "connected") ? (
              <>
                <CheckCircle2 className="h-4 w-4 text-success" />
                <span className="text-success">AI Connected &amp; Working</span>
              </>
            ) : (
              <>
                <AlertCircle className="h-4 w-4 text-danger" />
                <span className="text-danger">AI Not Working</span>
              </>
            )}
          </div>
          {statusMessage ? (
            <p className="mt-1.5 break-words text-xs text-muted">{statusMessage}</p>
          ) : null}
        </div>
      ) : (
        <div className="rounded-lg border border-border bg-elevated p-3 text-xs text-muted">
          Not tested yet. Add your key and press Apply to verify it live.
        </div>
      )}
    </form>
  );
}
