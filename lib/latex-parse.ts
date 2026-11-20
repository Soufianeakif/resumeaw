/** Extracts a complete LaTeX document from an AI response. */
export function extractLatexDocument(content: string): string | null {
  const fences = [...content.matchAll(/```(?:latex|tex)?[ \t]*\r?\n([\s\S]*?)```/gi)];
  let best = "";
  for (const fence of fences) {
    const body = fence[1];
    if (
      (body.includes("\\documentclass") || body.includes("\\begin{document}")) &&
      body.length > best.length
    ) {
      best = body;
    }
  }
  if (best) return best.trim();

  const start = content.indexOf("\\documentclass");
  const end = content.lastIndexOf("\\end{document}");
  if (start >= 0 && end > start) {
    return content.slice(start, end + "\\end{document}".length).trim();
  }
  return null;
}

const VALID_TITLE_CLASSES = new Set(["top", "page", "straight"]);

// Invisible typographic spaces (narrow no-break space, thin space, BOM,
// line separators) extracted from PDFs and DOCX files. pdfLaTeX with
// inputenc/T1 rejects them, so they become ordinary spaces.
const UNICODE_SPACES =
  /[\u00A0\u2007\u2009\u202F\u200A\u2008\u2002\u2003\u2004\u2005\u2006\u2028\u2029\uFEFF]/g;

/**
 * Repairs constructs models commonly emit that pdflatex rejects.
 * `\titleclass{\section}{normal}` is invalid (titlesec only accepts top,
 * page and straight), so those declarations are dropped.
 */
const MACRO_DEFINITION =
  /\\(newcommand|renewcommand|providecommand|def|newenvironment|newcolumntype|catcode)\b/;
const VERBATIM_URL = /\\(url|href|includegraphics)\s*[{\[]/;

/**
 * A literal # in text ("C#", "issue #4") breaks pdflatex. Escape it unless the
 * line defines a macro, passes an argument placeholder, or is a URL.
 */
function escapeStrayHashes(line: string) {
  if (MACRO_DEFINITION.test(line) || VERBATIM_URL.test(line)) return line;
  return line.replace(/(^|[^\\])#(?![0-9])/g, "$1\\#");
}

export function sanitizeGeneratedLatex(latex: string) {
  return latex
    .replace(UNICODE_SPACES, " ")
    .split("\n")
    .filter((line) => {
      const match = /\\titleclass\s*\{[^}]*\}\s*\{([^}]*)\}/.exec(line);
      if (!match) return true;
      return VALID_TITLE_CLASSES.has(match[1].trim());
    })
    .map(escapeStrayHashes)
    .join("\n");
}

export function extractExplanation(content: string) {
  const withoutFences = content
    .replace(/```(?:latex|tex)?[ \t]*\r?\n[\s\S]*?```/gi, "")
    .replace(/^\s*changelog\s*:?\s*/i, "")
    .trim();
  return withoutFences || "Updated the LaTeX source.";
}
