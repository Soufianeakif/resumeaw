import { NextResponse } from "next/server";
import fs from "node:fs/promises";
import { addHistory, getDocument, getSettings, listAssets } from "@/lib/db";
import { compiledPdfPath, isImageFile, isSafeDocumentId } from "@/lib/assets";
import { callChatCompletion, DEFAULT_MODEL, type ChatContentPart } from "@/lib/openrouter";
import {
  extractExplanation,
  extractLatexDocument,
  sanitizeGeneratedLatex,
} from "@/lib/latex-parse";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const MAX_ASSET_CHAR_BUDGET = 40_000;
const MAX_SINGLE_ASSET_CHARS = 12_000;

const SYSTEM_PROMPT = `You are resumeaw, an expert LaTeX editor and resume designer.

You receive:
- the current complete LaTeX source of a resume/CV/cover letter,
- a rendered PDF of that source (to inspect layout, overflow, spacing and alignment),
- the list of uploaded asset files available in the compile directory,
- optional pdflatex error output from the latest compile attempt.

Your job: apply the user's requested change and return the FULL updated LaTeX document.

Hard rules:
1. Output the complete document, from \\documentclass to \\end{document}. Never output a diff, a fragment, or "unchanged" placeholders.
2. The result must compile with pdflatex using -interaction=nonstopmode -halt-on-error -no-shell-escape.
3. Only use packages available in texlive-latex-base, texlive-latex-extra and texlive-fonts-recommended. Never use shell-escape, minted, or external tooling.
4. Only reference files that appear in the provided asset list, using their exact filenames. Images go through \\includegraphics[width=...]{filename}.
5. If a compile error is provided, fix its root cause; do not delete the user's content just to make it compile.
6. Preserve the user's content and style unless the instruction says otherwise. Keep ATS-friendliness: real text, no images of text.
7. If the request is "fit on one page" or similar, tighten spacing, margins, font size and bullet wording as needed while keeping it readable.
8. Never emit \\titleclass: titlesec only accepts top, page and straight, and "normal" is invalid. Style sections with \\titleformat and \\titlespacing only.

Response format:
- First a short changelog: 2 to 5 plain-text bullet points, no code fences, no headings.
- Then EXACTLY ONE fenced code block tagged latex containing the complete updated document.`;

type AssetRow = {
  filename: string;
  file_type: string;
  extracted_text: string | null;
};

function buildAssetSection(assets: AssetRow[]) {
  if (assets.length === 0) {
    return "No files have been uploaded for this document. You cannot reference external images.";
  }

  const lines: string[] = [];
  for (const asset of assets) {
    const kind = isImageFile(asset.filename, asset.file_type)
      ? "image — usable with \\includegraphics"
      : "reference document";
    lines.push(`- ${asset.filename} (${asset.file_type}, ${kind})`);
  }

  let budget = MAX_ASSET_CHAR_BUDGET;
  const texts: string[] = [];
  for (const asset of assets) {
    if (!asset.extracted_text) continue;
    if (budget <= 0) break;
    const slice = asset.extracted_text.slice(
      0,
      Math.min(MAX_SINGLE_ASSET_CHARS, budget)
    );
    budget -= slice.length;
    texts.push(
      `--- extracted text from ${asset.filename} ---\n${slice}\n--- end of ${asset.filename} ---`
    );
  }

  return [lines.join("\n"), texts.join("\n\n")].filter(Boolean).join("\n\n");
}

export async function POST(request: Request) {
  let body: {
    documentId?: unknown;
    prompt?: unknown;
    latexCode?: unknown;
    compileLog?: unknown;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const documentId = typeof body.documentId === "string" ? body.documentId : "";
  const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
  const latexCode = typeof body.latexCode === "string" ? body.latexCode : "";
  const compileLog =
    typeof body.compileLog === "string" ? body.compileLog.slice(0, 12_000) : "";

  if (!isSafeDocumentId(documentId) || !getDocument(documentId)) {
    return NextResponse.json({ error: "Document not found." }, { status: 404 });
  }
  if (!prompt) {
    return NextResponse.json({ error: "Describe the change you want." }, { status: 400 });
  }
  if (!latexCode.trim()) {
    return NextResponse.json({ error: "The LaTeX source is empty." }, { status: 400 });
  }

  const settings = getSettings();
  if (!settings.openrouter_api_key.trim()) {
    return NextResponse.json(
      {
        error:
          "No OpenRouter API key configured. Open Settings, paste your key and press Apply.",
        code: "missing_key",
      },
      { status: 400 }
    );
  }

  const model = settings.openrouter_model || DEFAULT_MODEL;
  const assets = listAssets(documentId).map((asset) => ({
    filename: asset.filename,
    file_type: asset.file_type,
    extracted_text: asset.extracted_text,
  }));

  const textPart = [
    `# User request\n${prompt}`,
    `# Current LaTeX source\n${latexCode}`,
    `# Uploaded files in the compile directory\n${buildAssetSection(assets)}`,
    compileLog.trim()
      ? `# Latest pdflatex output (the document may currently fail to compile)\n${compileLog.trim()}`
      : "# Compile status\nNo compile errors were reported for the current source.",
    "Remember: return a short changelog, then one ```latex fenced block with the complete document.",
  ].join("\n\n");

  const userContent: ChatContentPart[] = [{ type: "text", text: textPart }];

  try {
    const pdf = await fs.readFile(compiledPdfPath(documentId));
    userContent.push({
      type: "file",
      file: {
        filename: "current-preview.pdf",
        file_data: `data:application/pdf;base64,${pdf.toString("base64")}`,
      },
    });
  } catch {
    // No compiled PDF yet — the source alone is enough context.
  }

  const completion = await callChatCompletion({
    apiKey: settings.openrouter_api_key,
    model,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userContent },
    ],
    maxTokens: 8192,
    temperature: 0.2,
  });

  if (!completion.ok) {
    return NextResponse.json(
      { error: completion.message, code: "openrouter_error" },
      { status: completion.status && completion.status >= 400 ? completion.status : 502 }
    );
  }

  const parsedLatex = extractLatexDocument(completion.content);
  const updatedLatex = parsedLatex ? sanitizeGeneratedLatex(parsedLatex) : null;
  if (!updatedLatex) {
    return NextResponse.json(
      {
        error:
          "The model did not return a complete LaTeX document. Try rephrasing the request or switching models.",
        code: "parse_error",
      },
      { status: 422 }
    );
  }

  const explanation = extractExplanation(completion.content);

  addHistory({
    documentId,
    prompt,
    explanation,
    latexBefore: latexCode,
    latexAfter: updatedLatex,
    model,
  });

  return NextResponse.json({ updatedLatex, explanation, model });
}
