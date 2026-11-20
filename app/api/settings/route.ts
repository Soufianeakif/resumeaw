import { NextResponse } from "next/server";
import { getSettings, saveSettings } from "@/lib/db";
import {
  DEFAULT_MODEL,
  MODEL_PRESETS,
  parseModelList,
  testOpenRouterKey,
} from "@/lib/openrouter";

export const dynamic = "force-dynamic";
export const maxDuration = 90;

export async function GET() {
  const settings = getSettings();
  return NextResponse.json(
    {
      settings,
      models: parseModelList(settings.openrouter_models),
      presets: MODEL_PRESETS,
      defaultModel: DEFAULT_MODEL,
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}

export async function POST(request: Request) {
  let body: { apiKey?: unknown; model?: unknown; models?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { working: false, statusMessage: "Invalid JSON body." },
      { status: 400 }
    );
  }

  const current = getSettings();
  const apiKey =
    typeof body.apiKey === "string" ? body.apiKey.trim() : current.openrouter_api_key;
  const model =
    typeof body.model === "string" && body.model.trim()
      ? body.model.trim()
      : current.openrouter_model || DEFAULT_MODEL;

  const rawModels =
    typeof body.models === "string"
      ? body.models
      : Array.isArray(body.models)
        ? body.models.filter((value): value is string => typeof value === "string").join("\n")
        : current.openrouter_models;

  let models = parseModelList(rawModels);
  if (models.length === 0) models = [model];
  if (!models.includes(model)) models = [model, ...models];
  const modelsText = models.join("\n");

  if (!apiKey) {
    const saved = saveSettings({
      apiKey: "",
      model,
      models: modelsText,
      status: "error",
      statusMessage: "No API key saved.",
    });
    return NextResponse.json({
      working: false,
      statusMessage: "No API key saved. Paste your OpenRouter key and press Apply.",
      models: parseModelList(saved.openrouter_models),
      settings: saved,
    });
  }

  // Persist first so the key and list survive a failed test.
  saveSettings({
    apiKey,
    model,
    models: modelsText,
    status: "untested",
    statusMessage: "Testing…",
  });

  const result = await testOpenRouterKey(apiKey, model);
  const saved = saveSettings({
    apiKey,
    model,
    models: modelsText,
    status: result.status,
    statusMessage: result.message,
  });

  return NextResponse.json(
    {
      working: result.working,
      statusMessage: result.message,
      apiStatus: result.status,
      models: parseModelList(saved.openrouter_models),
      settings: saved,
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
