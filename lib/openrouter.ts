const BASE_URL =
  process.env.OPENROUTER_BASE_URL || "https://openrouter.ai/api/v1";

export const MODEL_PRESETS = [
  {
    id: "google/gemini-2.5-flash",
    label: "Google Gemini 2.5 Flash — fast, vision + PDF",
  },
  {
    id: "google/gemini-2.5-pro",
    label: "Google Gemini 2.5 Pro — strongest layout reasoning",
  },
  {
    id: "anthropic/claude-sonnet-4",
    label: "Anthropic Claude Sonnet 4 — vision + PDF",
  },
  {
    id: "openai/gpt-4.1",
    label: "OpenAI GPT-4.1 — vision + PDF",
  },
  {
    id: "openai/gpt-4o",
    label: "OpenAI GPT-4o — vision",
  },
  {
    id: "qwen/qwen2.5-vl-72b-instruct",
    label: "Qwen 2.5 VL 72B Instruct — vision",
  },
];

export const DEFAULT_MODEL = MODEL_PRESETS[0].id;

export type FreeModel = { id: string; name: string };

/** Splits a newline/comma separated model list into unique ids. */
export function parseModelList(value: string): string[] {
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

/**
 * Lists every free model currently offered by OpenRouter
 * (pricing 0/0 or a `:free` suffix). The models endpoint is public.
 */
export async function fetchFreeModels(): Promise<
  { ok: true; models: FreeModel[] } | { ok: false; message: string }
> {
  try {
    const response = await fetch(`${BASE_URL}/models`, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(25_000),
      cache: "no-store",
    });
    if (!response.ok) {
      return {
        ok: false,
        message: `Could not load the OpenRouter model catalogue (HTTP ${response.status}).`,
      };
    }

    const json = (await response.json()) as {
      data?: {
        id?: string;
        name?: string;
        pricing?: { prompt?: string | number; completion?: string | number };
      }[];
    };

    const models: FreeModel[] = (json.data ?? [])
      .filter((model) => {
        if (!model.id) return false;
        if (model.id.endsWith(":free")) return true;
        const prompt = Number(model.pricing?.prompt ?? NaN);
        const completion = Number(model.pricing?.completion ?? NaN);
        return prompt === 0 && completion === 0;
      })
      .map((model) => ({ id: model.id as string, name: model.name ?? (model.id as string) }))
      .sort((a, b) => a.id.localeCompare(b.id));

    if (models.length === 0) {
      return { ok: false, message: "OpenRouter returned no free models right now." };
    }

    return { ok: true, models };
  } catch (error) {
    return { ok: false, message: networkMessage(error) };
  }
}

export type OpenRouterTestResult = {
  working: boolean;
  status: "connected" | "error";
  message: string;
};

type KeyInfo = {
  label?: string;
  limit?: number | null;
  usage?: number;
  limit_remaining?: number | null;
  is_free_tier?: boolean;
};

function networkMessage(error: unknown) {
  if (error instanceof Error) {
    if (error.name === "TimeoutError" || error.name === "AbortError") {
      return "Request to OpenRouter timed out. Check your internet connection or proxy.";
    }
    return `Could not reach OpenRouter: ${error.message}`;
  }
  return "Could not reach OpenRouter (unknown network error).";
}

function creditsSummary(info: KeyInfo | null) {
  if (!info) return "";
  if (typeof info.limit_remaining === "number") {
    return ` Remaining credits: $${info.limit_remaining.toFixed(2)}.`;
  }
  if (info.limit === null) {
    return " This key has no spending limit configured.";
  }
  return "";
}

async function readJson(response: Response) {
  const text = await response.text();
  try {
    return { text, json: JSON.parse(text) as Record<string, unknown> };
  } catch {
    return { text, json: null };
  }
}

function apiErrorMessage(json: Record<string, unknown> | null, fallback: string) {
  const error = json?.error as
    | { message?: string; code?: number | string }
    | string
    | undefined;
  if (typeof error === "string") return error;
  if (error?.message) return error.message;
  return fallback;
}

/**
 * Validates the key against GET /auth/key, then performs a minimal chat
 * completion to confirm the selected model is actually usable.
 */
export async function testOpenRouterKey(
  apiKey: string,
  model: string
): Promise<OpenRouterTestResult> {
  const key = apiKey.trim();
  const selectedModel = model.trim() || DEFAULT_MODEL;

  if (!key) {
    return {
      working: false,
      status: "error",
      message: "No API key saved. Paste your OpenRouter key and press Apply.",
    };
  }

  let keyInfo: KeyInfo | null = null;

  try {
    const response = await fetch(`${BASE_URL}/auth/key`, {
      headers: {
        Authorization: `Bearer ${key}`,
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(20_000),
      cache: "no-store",
    });
    const { json } = await readJson(response);

    if (response.status === 401 || response.status === 403) {
      return {
        working: false,
        status: "error",
        message:
          "Invalid API key — OpenRouter rejected it (401 Unauthorized). Create a new key at openrouter.ai/keys.",
      };
    }
    if (!response.ok) {
      return {
        working: false,
        status: "error",
        message: `Key check failed (HTTP ${response.status}): ${apiErrorMessage(
          json,
          "OpenRouter did not accept this key."
        )}`,
      };
    }
    keyInfo = (json?.data as KeyInfo | undefined) ?? null;
  } catch (error) {
    return { working: false, status: "error", message: networkMessage(error) };
  }

  try {
    const response = await fetch(`${BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        "X-Title": "resumeaw",
      },
      signal: AbortSignal.timeout(45_000),
      cache: "no-store",
      body: JSON.stringify({
        model: selectedModel,
        messages: [
          { role: "user", content: "Reply with the single word: OK" },
        ],
        max_tokens: 32,
      }),
    });
    const { json } = await readJson(response);

    if (response.status === 402) {
      return {
        working: false,
        status: "error",
        message:
          "OpenRouter reports insufficient credits (402). Add credits at openrouter.ai/credits.",
      };
    }
    if (response.status === 401 || response.status === 403) {
      return {
        working: false,
        status: "error",
        message: "Invalid API key — OpenRouter rejected it while testing the model.",
      };
    }
    if (response.status === 404) {
      return {
        working: false,
        status: "error",
        message: `Model "${selectedModel}" was not found on OpenRouter. Pick a different model ID.`,
      };
    }
    if (response.status === 400) {
      return {
        working: false,
        status: "error",
        message: `Model "${selectedModel}" rejected the request: ${apiErrorMessage(
          json,
          "not a supported model ID."
        )}`,
      };
    }
    if (response.status === 429) {
      return {
        working: false,
        status: "error",
        message:
          "OpenRouter rate limit reached (429). Wait a moment and test again.",
      };
    }
    if (!response.ok) {
      return {
        working: false,
        status: "error",
        message: `Chat completion failed (HTTP ${response.status}): ${apiErrorMessage(
          json,
          "unknown error."
        )}`,
      };
    }

    return {
      working: true,
      status: "connected",
      message: `Key valid and ${selectedModel} responded.${creditsSummary(
        keyInfo
      )}`,
    };
  } catch (error) {
    return { working: false, status: "error", message: networkMessage(error) };
  }
}

export type ChatContentPart =
  | { type: "text"; text: string }
  | {
      type: "file";
      file: { filename: string; file_data: string };
    };

export async function callChatCompletion(input: {
  apiKey: string;
  model: string;
  messages: {
    role: "system" | "user" | "assistant";
    content: string | ChatContentPart[];
  }[];
  maxTokens?: number;
  temperature?: number;
}): Promise<
  { ok: true; content: string } | { ok: false; message: string; status?: number }
> {
  try {
    const response = await fetch(`${BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${input.apiKey.trim()}`,
        "Content-Type": "application/json",
        "X-Title": "resumeaw",
      },
      signal: AbortSignal.timeout(180_000),
      cache: "no-store",
      body: JSON.stringify({
        model: input.model.trim() || DEFAULT_MODEL,
        messages: input.messages,
        max_tokens: input.maxTokens ?? 8192,
        temperature: input.temperature ?? 0.2,
      }),
    });

    const { json } = await readJson(response);

    if (!response.ok) {
      const detail = apiErrorMessage(
        json,
        response.statusText || "OpenRouter request failed."
      );
      if (response.status === 402) {
        return {
          ok: false,
          status: 402,
          message: `OpenRouter reports insufficient credits (402). ${detail}`,
        };
      }
      if (response.status === 401) {
        return {
          ok: false,
          status: 401,
          message: `OpenRouter rejected the API key (401). ${detail}`,
        };
      }
      return {
        ok: false,
        status: response.status,
        message: `OpenRouter error (HTTP ${response.status}): ${detail}`,
      };
    }

    const choices = json?.choices as
      | { message?: { content?: unknown } }[]
      | undefined;
    const content = choices?.[0]?.message?.content;

    if (typeof content === "string" && content.trim()) {
      return { ok: true, content };
    }

    if (Array.isArray(content)) {
      const joined = content
        .map((part) =>
          part && typeof part === "object" && "text" in part
            ? String((part as { text?: unknown }).text ?? "")
            : ""
        )
        .join("\n")
        .trim();
      if (joined) return { ok: true, content: joined };
    }

    return {
      ok: false,
      message: "OpenRouter returned an empty response. Try again or switch models.",
    };
  } catch (error) {
    return { ok: false, message: networkMessage(error) };
  }
}
