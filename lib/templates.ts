import type { TemplateId } from "./types";

export type LatexTemplate = {
  id: TemplateId;
  name: string;
  description: string;
  latex: string;
};

const blank = String.raw`\documentclass[11pt,a4paper]{article}
\usepackage[utf8]{inputenc}
\usepackage[T1]{fontenc}
\usepackage[margin=1in]{geometry}
\usepackage{hyperref}

\title{Untitled Document}
\author{}
\date{\today}

\begin{document}
\maketitle

\section{Introduction}
Start writing here.

\end{document}
`;

const modernResume = String.raw`\documentclass[11pt,a4paper]{article}
\usepackage[utf8]{inputenc}
\usepackage[T1]{fontenc}
\usepackage[top=0.55in,bottom=0.55in,left=0.65in,right=0.65in]{geometry}
\usepackage{enumitem}
\usepackage{titlesec}
\usepackage{xcolor}
\usepackage[hidelinks]{hyperref}
\usepackage{parskip}

\pagestyle{empty}
\definecolor{accent}{HTML}{1F4E79}
\definecolor{muted}{HTML}{555555}

\titleformat{\section}{\large\bfseries\color{accent}}{}{0em}{}[\vspace{-0.55em}{\color{accent}\rule{\textwidth}{0.6pt}}]
\titlespacing*{\section}{0pt}{0.7em}{0.35em}
\setlist[itemize]{leftmargin=1.1em,itemsep=0pt,topsep=0.15em,parsep=0pt}

\newcommand{\entry}[4]{%
  \textbf{#1}\hfill #2\\[1pt]%
  \textit{#3}\hfill\textit{\color{muted}#4}\\[2pt]%
}

\begin{document}

\begin{center}
  {\LARGE\bfseries Alex Morgan}\\[3pt]
  {\color{muted}Software Engineer}\\[3pt]
  \small alex.morgan@example.com \textbullet\ +1 (555) 012-3456 \textbullet\ Berlin, Germany\\
  \small \href{https://github.com/example}{github.com/example} \textbullet\ \href{https://example.com}{example.com}
\end{center}

\section{Summary}
Software engineer with 6 years of experience building reliable web platforms and developer tooling.
Focused on performance, clear interfaces and pragmatic delivery.

\section{Experience}
\entry{Senior Software Engineer}{2022 -- Present}{Northwind Labs}{Berlin, Germany}
\begin{itemize}
  \item Led the migration of a monolith to a typed service architecture, cutting p95 latency by 42\%.
  \item Built an internal design-system package used by 9 product teams.
  \item Mentored 4 engineers and introduced a lightweight design-review process.
\end{itemize}

\entry{Software Engineer}{2019 -- 2022}{Acme Digital}{Remote}
\begin{itemize}
  \item Shipped a billing pipeline handling 1.2M monthly transactions with zero data loss.
  \item Reduced CI runtime from 24 to 7 minutes by parallelising test suites.
\end{itemize}

\section{Projects}
\textbf{resumeaw} --- local-first LaTeX resume editor with AI-assisted layout fixes.\\
\textbf{Gridwatch} --- observability dashboard for small teams (open source, 1.8k stars).

\section{Skills}
\textbf{Languages:} TypeScript, Go, Python, SQL\\
\textbf{Platforms:} PostgreSQL, Redis, Docker, Kubernetes, AWS\\
\textbf{Focus:} distributed systems, developer experience, performance

\section{Education}
\entry{BSc Computer Science}{2015 -- 2019}{Technical University of Munich}{Munich, Germany}

\end{document}
`;

const coverLetter = String.raw`\documentclass[11pt,a4paper]{article}
\usepackage[utf8]{inputenc}
\usepackage[T1]{fontenc}
\usepackage[top=1in,bottom=1in,left=1.1in,right=1.1in]{geometry}
\usepackage{hyperref}
\usepackage{parskip}

\pagestyle{empty}
\setlength{\parindent}{0pt}

\begin{document}

\begin{flushright}
Alex Morgan\\
alex.morgan@example.com\\
+1 (555) 012-3456\\
\today
\end{flushright}

\vspace{1em}
Hiring Manager\\
Northwind Labs\\
Berlin, Germany

\vspace{1.5em}
\textbf{Re: Application for Senior Software Engineer}

\vspace{1em}
Dear Hiring Manager,

I am writing to apply for the Senior Software Engineer role at Northwind Labs. Over the past six
years I have built and operated web platforms where reliability and clear interfaces matter more
than novelty, and I would like to bring that focus to your team.

At Acme Digital I owned a billing pipeline processing over one million transactions per month.
I redesigned its retry and reconciliation logic, which removed a recurring class of duplicate
charges and reduced support tickets by a third. I also led the test-suite overhaul that cut CI
time from 24 minutes to 7, which changed how quickly the team could ship.

What draws me to Northwind Labs is the combination of a small product surface and a strong
engineering culture. I enjoy work where the design of the interface is discussed as carefully as
the implementation behind it.

Thank you for your time and consideration. I would welcome the chance to discuss how I can
contribute.

\vspace{1.5em}
Sincerely,\\
Alex Morgan

\end{document}
`;

export const TEMPLATES: LatexTemplate[] = [
  {
    id: "blank",
    name: "Blank LaTeX",
    description: "A minimal article scaffold to start from scratch.",
    latex: blank,
  },
  {
    id: "modern-resume",
    name: "Modern Resume / CV",
    description: "Single-page, accent-coloured CV layout.",
    latex: modernResume,
  },
  {
    id: "cover-letter",
    name: "Cover Letter",
    description: "A clean formal letter with header block.",
    latex: coverLetter,
  },
];

export function getTemplate(id: string | null | undefined): LatexTemplate {
  return TEMPLATES.find((template) => template.id === id) ?? TEMPLATES[1];
}

export function createTitleForTemplate(template: LatexTemplate) {
  const stamp = new Date().toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  return `${template.name} — ${stamp}`;
}
