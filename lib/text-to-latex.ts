const ESCAPES: Record<string, string> = {
  "\\": "\\textbackslash{}",
  "{": "\\{",
  "}": "\\}",
  $: "\\$",
  "&": "\\&",
  "#": "\\#",
  "^": "\\textasciicircum{}",
  _: "\\_",
  "%": "\\%",
  "~": "\\textasciitilde{}",
};

export function escapeLatex(value: string) {
  return value.replace(/[\\{}$&#^_%~]/g, (char) => ESCAPES[char] ?? char);
}

function isHeading(line: string) {
  const letters = line.replace(/[^A-Za-z]/g, "");
  return (
    line.length > 0 &&
    line.length <= 60 &&
    letters.length >= 3 &&
    letters === letters.toUpperCase() &&
    !line.endsWith(".")
  );
}

function isBullet(line: string) {
  return /^[•·▪◦*\-–]\s+/.test(line);
}

function titleCase(value: string) {
  return value
    .toLowerCase()
    .replace(/\b[a-z]/g, (char) => char.toUpperCase())
    .trim();
}

/**
 * Deterministic text -> LaTeX conversion used when no AI key is configured
 * or the AI request fails. Produces a complete, compilable document.
 */
export function textToLatex(text: string, title: string): string {
  const lines = text
    .replace(/\r\n/g, "\n")
    .replace(/\u0000/g, "")
    .split("\n")
    .map((line) => line.replace(/\s+$/, "").trim());

  const blocks: string[] = [];
  let bullets: string[] = [];

  const flushBullets = () => {
    if (bullets.length === 0) return;
    blocks.push(
      [
        "\\begin{itemize}",
        ...bullets.map((item) => `  \\item ${escapeLatex(item)}`),
        "\\end{itemize}",
      ].join("\n")
    );
    bullets = [];
  };

  for (const line of lines) {
    if (!line) {
      flushBullets();
      continue;
    }
    if (isBullet(line)) {
      bullets.push(line.replace(/^[•·▪◦*\-–]\s+/, ""));
      continue;
    }
    flushBullets();
    if (isHeading(line)) {
      blocks.push(`\\section*{${escapeLatex(titleCase(line))}}`);
      continue;
    }
    blocks.push(`\\noindent ${escapeLatex(line)}`);
  }
  flushBullets();

  if (blocks.length === 0) {
    blocks.push("\\noindent The imported file contained no readable text.");
  }

  return String.raw`\documentclass[11pt,a4paper]{article}
\usepackage[utf8]{inputenc}
\usepackage[T1]{fontenc}
\usepackage[margin=0.9in]{geometry}
\usepackage{enumitem}
\usepackage{titlesec}
\usepackage{xcolor}
\usepackage[hidelinks]{hyperref}
\usepackage{parskip}

\pagestyle{empty}
\definecolor{accent}{HTML}{1F4E79}
\titleformat{\section}{\large\bfseries\color{accent}}{}{0em}{}[\vspace{-0.55em}{\color{accent}\rule{\textwidth}{0.6pt}}]
\titlespacing*{\section}{0pt}{0.7em}{0.35em}
\setlist[itemize]{leftmargin=1.1em,itemsep=0pt,topsep=0.15em,parsep=0pt}

\hypersetup{pdftitle={__TITLE__}}

\begin{document}

__BODY__

\end{document}
`
    .replace("__TITLE__", escapeLatex(title))
    .replace("__BODY__", blocks.join("\n\n"));
}
