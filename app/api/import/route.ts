import { NextResponse } from "next/server";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { createDocument, getSettings } from "@/lib/db";
import { extractTextFromFile } from "@/lib/extract-text";
import { callChatCompletion, DEFAULT_MODEL } from "@/lib/openrouter";
import {
  extractLatexDocument,
  sanitizeGeneratedLatex,
} from "@/lib/latex-parse";
import { textToLatex } from "@/lib/text-to-latex";
import { compileLatexSnippet } from "@/lib/compile";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const MAX_BYTES = 20 * 1024 * 1024;
const MAX_TEXT_CHARS = 60_000;
const ALLOWED_EXTENSIONS = [".pdf", ".docx"];

const SYSTEM_PROMPT = `You convert an existing resume/CV document into a complete LaTeX document.

Rules:
1. Return the FULL document from \\documentclass to \\end{document} inside one fenced latex block.
2. Use article class, 11pt, a4paper, with geometry, enumitem, titlesec, xcolor, hyperref, parskip and graphicx.
3. It must compile with pdflatex using -interaction=nonstopmode -halt-on-error -no-shell-escape, using only packages from texlive-latex-base, texlive-latex-extra and texlive-fonts-recommended.
4. Preserve every fact from the source: names, contact details, dates, employers, job titles, bullet points, numbers, skills and education. Do not invent content and do not drop items.
5. Rebuild the visual structure: a centred header for the name and contact line, an accent-ruled section heading for each section, \\itemize for bullets, and a two-column style line for role/company on the left and dates on the right.
6. Keep it readable and ATS-friendly: real text, no images of text, no tables for layout.
7. Never use \\titleclass: titlesec only accepts top, page and straight, and "normal" is invalid. Style section headings with \\titleformat and \\titlespacing only.

Before the code block, write 2-4 plain-text lines summarising what you mapped.`;

function cleanText(value: string) {
  return value
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{4,}/g, "\n\n\n")
    .trim();
}

export async function POST(request: Request) {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json(
      { error: "Expected multipart/form-data with a file field." },
      { status: 400 }
    );
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file provided." }, { status: 400 });
  }

  const originalName = file.name || "upload";
  const extension = path.extname(originalName).toLowerCase();

  if (!ALLOWED_EXTENSIONS.includes(extension)) {
    return NextResponse.json(
      { error: "Only PDF and Word (.docx) files can be imported." },
      { status: 400 }
    );
  }
  if (file.size === 0) {
    return NextResponse.json({ error: "The file is empty." }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: "The file is larger than 20 MB." },
      { status: 400 }
    );
  }

  const rawTitle = typeof form.get("title") === "string" ? String(form.get("title")) : "";
  const title =
    rawTitle.trim().slice(0, 200) ||
    path
      .basename(originalName, extension)
      .replace(/[_-]+/g, " ")
      .trim() ||
    "Imported document";

  const tempPath = path.join(
    os.tmpdir(),
    `resumeaw-import-${randomUUID()}${extension}`
  );

  let text: string | null = null;
  try {
    await fs.writeFile(tempPath, Buffer.from(await file.arrayBuffer()));
    text = await extractTextFromFile(tempPath, originalName);
  } catch (error) {
    return NextResponse.json(
      {
        error: `Could not read the file: ${
          error instanceof Error ? error.message : "unknown error"
        }`,
      },
      { status: 400 }
    );
  } finally {
    await fs.rm(tempPath, { force: true }).catch(() => undefined);
  }

  const cleaned = cleanText(text ?? "");
  if (cleaned.length === 0) {
    return NextResponse.json(
      {
        error:
          "No readable text was found in this file. Scanned or image-only PDFs need OCR before importing.",
      },
      { status: 400 }
    );
  }

  const settings = getSettings();
  const apiKey = settings.openrouter_api_key.trim();
  const model = settings.openrouter_model || DEFAULT_MODEL;
  const sourceText = `# File: ${originalName}\n\n${cleaned.slice(0, MAX_TEXT_CHARS)}`;

  let latex: string | null = null;
  let method: "ai" | "basic" = "basic";
  let note: string | null = null;

  if (apiKey) {
    const completion = await callChatCompletion({
      apiKey,
      model,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: sourceText },
      ],
      maxTokens: 8192,
      temperature: 0.2,
    });

    if (!completion.ok) {
      note = `AI conversion failed (${completion.message}). The built-in text converter was used instead.`;
    } else {
      const parsed = extractLatexDocument(completion.content);
      if (!parsed) {
        note =
          "The model did not return valid LaTeX, so the built-in converter was used.";
      } else {
        let candidate = sanitizeGeneratedLatex(parsed);
        let check = await compileLatexSnippet(candidate);

        // One repair round: hand the compiler error back to the model.
        if (!check.success) {
          const retry = await callChatCompletion({
            apiKey,
            model,
            messages: [
              { role: "system", content: SYSTEM_PROMPT },
              {
                role: "user",
                content: `${sourceText}\n\n# Your previous output failed to compile with pdflatex:\n${check.log.slice(
                  0,
                  4000
                )}\n\nReturn a corrected, complete document.`,
              },
            ],
            maxTokens: 8192,
            temperature: 0.1,
          });

          const retried = retry.ok ? extractLatexDocument(retry.content) : null;
          if (retried) {
            const repaired = sanitizeGeneratedLatex(retried);
            const secondCheck = await compileLatexSnippet(repaired);
            if (secondCheck.success) {
              candidate = repaired;
              check = secondCheck;
            } else {
              note =
                "The AI output did not compile, so the built-in text converter was used. Edit the document or re-import for another attempt.";
            }
          } else {
            note =
              "The AI output did not compile and the repair attempt failed, so the built-in text converter was used.";
          }
        }

        if (check.success) {
          latex = candidate;
          method = "ai";
        }
      }
    }
  } else {
    note =
      "No OpenRouter key is configured, so the built-in text converter was used. Add a key in Settings and re-import for a richer conversion.";
  }

  if (!latex) latex = textToLatex(cleaned, title);

  const document = createDocument({ title, latexCode: latex });

  return NextResponse.json({ document, method, note }, { status: 201 });
}
