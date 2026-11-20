import fs from "node:fs/promises";
import path from "node:path";

const MAX_TEXT_CHARS = 200_000;

export async function extractTextFromFile(
  absolutePath: string,
  originalName: string
): Promise<string | null> {
  const ext = path.extname(originalName).toLowerCase();

  try {
    if (ext === ".txt" || ext === ".md" || ext === ".tex") {
      return (await fs.readFile(absolutePath, "utf8")).slice(0, MAX_TEXT_CHARS);
    }

    if (ext === ".pdf") {
      const { PDFParse } = await import("pdf-parse");
      const data = new Uint8Array(await fs.readFile(absolutePath));
      const parser = new PDFParse({ data });
      try {
        const parsed = await parser.getText();
        return normalize(parsed.text).slice(0, MAX_TEXT_CHARS);
      } finally {
        await parser.destroy().catch(() => undefined);
      }
    }

    if (ext === ".docx") {
      const mammoth = await import("mammoth");
      const result = await mammoth.extractRawText({ path: absolutePath });
      return normalize(result.value).slice(0, MAX_TEXT_CHARS);
    }
  } catch (error) {
    console.warn(
      `[resumeaw] Could not extract text from ${originalName}:`,
      error instanceof Error ? error.message : error
    );
  }

  return null;
}

function normalize(text: string) {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/^-- \d+ of \d+ --$/gm, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{4,}/g, "\n\n\n")
    .trim();
}
