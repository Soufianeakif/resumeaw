import { execFile } from "node:child_process";
import fsSync from "node:fs";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  compiledDirectory,
  compiledPdfPath,
  findDocumentUploadDirectory,
} from "./assets";
import { updateDocument } from "./db";

const TIMEOUT_MS = 15_000;
const MAX_LOG_CHARS = 30_000;

function executableName() {
  return process.platform === "win32" ? "pdflatex.exe" : "pdflatex";
}

/** Finds <root>/<year>/bin/<platform>/pdflatex for TeX Live style trees. */
function texliveBinaries(root: string) {
  const found: string[] = [];
  try {
    for (const year of fsSync.readdirSync(root)) {
      const binRoot = path.join(root, year, "bin");
      try {
        for (const platform of fsSync.readdirSync(binRoot)) {
          found.push(path.join(binRoot, platform, executableName()));
        }
      } catch {
        // not a TeX Live year directory
      }
    }
  } catch {
    // root missing
  }
  return found;
}

let resolvedPdflatex: string | null = null;

/**
 * Resolves the pdflatex executable. Order: PDFLATEX_PATH, a project-local
 * `.texlive` toolchain, common MiKTeX/TinyTeX/TeX Live install locations, PATH.
 */
export function resolvePdflatex(): string {
  if (resolvedPdflatex) return resolvedPdflatex;

  const configured = process.env.PDFLATEX_PATH?.trim();
  if (configured) {
    resolvedPdflatex = configured;
    return configured;
  }

  const exe = executableName();
  const cwd = process.cwd();
  const candidates: string[] = [];

  if (process.platform === "win32") {
    const localAppData = process.env.LOCALAPPDATA ?? "";
    const appData = process.env.APPDATA ?? "";
    const programFiles = process.env.ProgramFiles ?? "C:\\Program Files";
    candidates.push(
      path.join(cwd, ".texlive", "bin", "windows", exe),
      path.join(appData, "TinyTeX", "bin", "windows", exe),
      path.join(localAppData, "TinyTeX", "bin", "windows", exe),
      path.join(localAppData, "Programs", "MiKTeX", "miktex", "bin", "x64", exe),
      path.join(localAppData, "Programs", "MiKTeX", "miktex", "bin", exe),
      path.join(programFiles, "MiKTeX", "miktex", "bin", "x64", exe),
      path.join(programFiles, "MiKTeX", "miktex", "bin", exe),
      ...texliveBinaries("C:\\texlive"),
      ...texliveBinaries(path.join(cwd, ".texlive"))
    );
  } else {
    const platformDir =
      process.platform === "darwin"
        ? ["universal-darwin", "arm64-darwin", "x86_64-darwin"]
        : ["x86_64-linux", "aarch64-linux"];
    candidates.push(
      ...platformDir.map((dir) => path.join(cwd, ".texlive", "bin", dir, exe)),
      "/Library/TeX/texbin/pdflatex",
      "/opt/homebrew/bin/pdflatex",
      "/usr/local/bin/pdflatex",
      "/usr/bin/pdflatex",
      ...texliveBinaries("/usr/local/texlive"),
      ...texliveBinaries("/opt/texlive")
    );
  }

  for (const candidate of candidates) {
    if (candidate && fsSync.existsSync(candidate)) {
      resolvedPdflatex = candidate;
      return candidate;
    }
  }

  return "pdflatex";
}

export type CompileResult =
  | { success: true; pdfUrl: string; log: string }
  | { success: false; log: string };

export const MISSING_BINARY_MESSAGE = `pdflatex was not found on this system.

resumeaw looks for it in:\n  • PDFLATEX_PATH\n  • .texlive/bin/windows/pdflatex.exe inside this project\n  • MiKTeX, TinyTeX and TeX Live install folders\n  • the system PATH

Install a LaTeX distribution so compilation can run:
  • Windows: install MiKTeX or TeX Live (https://tug.org/texlive)
  • macOS:   brew install --cask mactex-no-gui
  • Linux:   sudo apt install texlive-latex-base texlive-latex-extra texlive-fonts-recommended
  • Docker:  docker build -t resumeaw . && docker run -p 3000:3000 resumeaw

Or set PDFLATEX_PATH to the full path of the pdflatex executable.`;

type RunOutcome = {
  ok: boolean;
  output: string;
  missingBinary: boolean;
  timedOut: boolean;
};

function runPdflatex(cwd: string): Promise<RunOutcome> {
  return new Promise((resolve) => {
    execFile(
      resolvePdflatex(),
      [
        "-interaction=nonstopmode",
        "-halt-on-error",
        "-no-shell-escape",
        "-file-line-error",
        "main.tex",
      ],
      {
        cwd,
        timeout: TIMEOUT_MS,
        maxBuffer: 8 * 1024 * 1024,
        windowsHide: true,
      },
      (error, stdout, stderr) => {
        const err = error as (NodeJS.ErrnoException & { killed?: boolean }) | null;
        resolve({
          ok: !error,
          output: [stdout, stderr].filter(Boolean).join("\n"),
          missingBinary: err?.code === "ENOENT",
          timedOut: Boolean(err?.killed),
        });
      }
    );
  });
}

async function readLog(workDir: string) {
  try {
    return await fs.readFile(path.join(workDir, "main.log"), "utf8");
  } catch {
    return "";
  }
}

function truncate(value: string) {
  const trimmed = value.trim();
  if (trimmed.length <= MAX_LOG_CHARS) return trimmed;
  return `${trimmed.slice(0, MAX_LOG_CHARS)}\n… log truncated …`;
}

/**
 * Compiles a LaTeX snippet with no assets, purely to validate it.
 * Returns success when pdflatex is not installed (nothing to verify against).
 */
export async function compileLatexSnippet(
  latex: string
): Promise<{ success: boolean; log: string }> {
  const workDir = await fs.mkdtemp(path.join(os.tmpdir(), "resumeaw-check-"));
  try {
    await fs.writeFile(path.join(workDir, "main.tex"), latex, "utf8");
    const first = await runPdflatex(workDir);
    if (first.missingBinary) {
      return { success: true, log: MISSING_BINARY_MESSAGE };
    }
    if (!first.ok) {
      const log = await readLog(workDir);
      return { success: false, log: truncate(log || first.output) };
    }
    const second = await runPdflatex(workDir);
    if (!second.ok) {
      const log = await readLog(workDir);
      return { success: false, log: truncate(log || second.output) };
    }
    return { success: true, log: truncate(second.output) };
  } finally {
    await fs.rm(workDir, { recursive: true, force: true }).catch(() => undefined);
  }
}

/**
 * Compiles LaTeX for a document in an isolated temp directory containing
 * main.tex plus copies of the document's uploaded assets.
 */
export async function compileDocument(
  documentId: string,
  latexCode: string
): Promise<CompileResult> {
  const workDir = await fs.mkdtemp(path.join(os.tmpdir(), "resumeaw-build-"));

  try {
    await fs.writeFile(path.join(workDir, "main.tex"), latexCode, "utf8");

    try {
      const sourceDir = await findDocumentUploadDirectory(documentId);
      const entries = await fs.readdir(sourceDir, { withFileTypes: true });
      await Promise.all(
        entries
          .filter((entry) => entry.isFile())
          .map((entry) =>
            fs.copyFile(
              path.join(sourceDir, entry.name),
              path.join(workDir, entry.name)
            )
          )
      );
    } catch {
      // No assets folder yet — nothing to copy.
    }

    const first = await runPdflatex(workDir);

    if (first.missingBinary) {
      return { success: false, log: MISSING_BINARY_MESSAGE };
    }

    if (!first.ok) {
      const log = await readLog(workDir);
      if (first.timedOut) {
        return {
          success: false,
          log: truncate(
            `Compilation timed out after ${TIMEOUT_MS / 1000}s. A document may be stuck in an infinite loop.\n\n${
              log || first.output
            }`
          ),
        };
      }
      return {
        success: false,
        log: truncate(log || first.output || "pdflatex failed without output."),
      };
    }

    // Second pass resolves cross-references and page numbers.
    const second = await runPdflatex(workDir);
    if (!second.ok) {
      const log = await readLog(workDir);
      return {
        success: false,
        log: truncate(
          log ||
            second.output ||
            "pdflatex failed on the second pass (cross-references)."
        ),
      };
    }

    const produced = path.join(workDir, "main.pdf");
    try {
      await fs.access(produced);
    } catch {
      const log = await readLog(workDir);
      return {
        success: false,
        log: truncate(
          `pdflatex reported success but no main.pdf was produced.\n\n${
            log || second.output
          }`
        ),
      };
    }

    await fs.mkdir(compiledDirectory(), { recursive: true });
    await fs.copyFile(produced, compiledPdfPath(documentId));
    updateDocument(documentId, { lastPdfPath: `compiled/${documentId}.pdf` });

    return {
      success: true,
      pdfUrl: `/api/files/compiled/${documentId}.pdf?v=${Date.now()}`,
      log: truncate(second.output),
    };
  } finally {
    await fs.rm(workDir, { recursive: true, force: true }).catch(() => undefined);
  }
}
