<div align="center">
  <img src="./public/resumeaw.jpg" alt="Reasumeaw logo" width="180" />
  <h1>Reasumeaw</h1>
</div>

**A local-first LaTeX resume studio.** Write LaTeX on the left, watch a real `pdflatex`
render on the right, and ask an AI to fix the layout for you.

<div align="center">
  <a href="https://www.buymeacoffee.com/soufianeakif" target="_blank">
    <img src="https://img.buymeacoffee.com/button-api/?text=Buy%20me%20a%20coffee&emoji=&slug=soufianeakif&button_colour=FFDD00&font_colour=000000&font_family=Comic&outline_colour=000000&coffee_colour=ffffff" alt="Buy me a coffee" height="48" />
  </a>
</div>

No accounts, no cloud database, no telemetry. Documents, uploads, AI history and settings
live in a single SQLite file on your machine, and compiled PDFs are written to disk.

![Next.js](https://img.shields.io/badge/Next.js-15-000000?logo=next.js&logoColor=white)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3-06B6D4?logo=tailwindcss&logoColor=white)
![SQLite](https://img.shields.io/badge/SQLite-better--sqlite3-003B57?logo=sqlite&logoColor=white)
![LaTeX](https://img.shields.io/badge/pdflatex-TeX_Live-008080?logo=latex&logoColor=white)

```
Dashboard  →  split editor (LaTeX + live PDF)  →  AI prompt dock  →  History / Undo
```

---

## Table of contents

- [Why this exists](#why-this-exists)
- [Features](#features)
- [How it works](#how-it-works)
- [Tech stack](#tech-stack)
- [Requirements](#requirements)
- [Quick start](#quick-start)
- [Run Reasumeaw on a Windows PC](#run-reasumeaw-on-a-windows-pc)
- [LaTeX setup](#latex-setup)
- [Using the app](#using-the-app)
- [Keyboard shortcuts](#keyboard-shortcuts)
- [Configuration](#configuration)
- [Where your data lives](#where-your-data-lives)
- [How compilation works](#how-compilation-works)
- [How the AI works](#how-the-ai-works)
- [API reference](#api-reference)
- [Project structure](#project-structure)
- [Docker](#docker)
- [Troubleshooting](#troubleshooting)
- [Scripts](#scripts)
- [Security note](#security-note)
- [License](#license)
- [Author](#author)

---

## Why this exists

Resume builders either lock your CV inside a proprietary editor or make you hand-write
LaTeX in a plain text file. `resumeaw` sits in between:

- **Real LaTeX, not a template engine.** You edit the actual `.tex` source, so every
  package, macro and spacing tweak is available, and the output is a normal PDF you can
  send anywhere.
- **Local-first.** `better-sqlite3` holds your documents; uploads and compiled PDFs are
  plain files under `data/`. Nothing is uploaded unless you explicitly send an AI request.
- **AI that can see the result.** Human edits are easy ("move the title up a bit"), but
  LaTeX is not. The AI receives your source **and** the rendered PDF, so it can reason
  about actual page breaks instead of guessing.
- **Reversible.** Every AI edit stores a before/after snapshot, so a bad suggestion is one
  click away from being undone.

## Features

**Documents**

- Dashboard with starter templates — *Blank LaTeX*, *Modern Resume / CV*, *Cover Letter*.
- Rename, duplicate and delete documents (assets, history and the compiled PDF go with it).
- Cards show last-edit time, asset count and a *PDF ready* badge once a build exists.

**Editor**

- CodeMirror 6 with LaTeX syntax highlighting, line numbers and active-line highlighting.
- Resizable split view: editor on the left, PDF preview on the right.
- PDF preview with zoom and page navigation, plus a download button for `.tex` and `.pdf`.
- Auto-compile ~900 ms after you stop typing, or instantly with `Ctrl/⌘ + S`.
- Compiler errors appear with the exact `main.tex:LINE:` location, and the last successful
  PDF stays on screen so you are never staring at a blank panel.

**AI assistant**

- Prompt dock that sends your LaTeX, the rendered PDF, uploaded reference material and any
  current compile error to OpenRouter.
- The model returns a short changelog plus one complete corrected document.
- A persistent notice shows what the AI changed; **History** lists every edit with
  **Undo change** and **Restore result**.
- Works with any OpenRouter model, including free ones. The model list is editable text.

**Import**

- Upload a `.pdf` or `.docx` and get a brand-new LaTeX document.
- AI conversion when an OpenRouter key is configured; a deterministic text-to-LaTeX
  converter otherwise.
- AI output is sanitized and **compile-checked**. If it fails, the compiler log is sent
  back for one repair attempt; if that fails too, the built-in converter is used so you
  always end up with a document that compiles.

**Assets**

- Upload headshots (`.png`, `.jpg`, `.jpeg`) and reference documents (`.pdf`, `.txt`,
  `.docx`) per document.
- One click inserts `\includegraphics[width=0.3\textwidth]{photo.png}` at the cursor.
- Text from reference documents is extracted and attached to AI requests.

**App**

- Dark/light theme, favicons and web manifest, settings page or in-editor dialog.
- Optional Docker image with TeX Live preinstalled.

## How it works

```
                ┌──────────────────────────────────────────────┐
   .pdf/.docx ─►│ /api/import                                  │
                │  extract text → AI (or fallback converter)   │
                │  → sanitize → pdflatex check → retry → save  │
                └──────────────────────┬───────────────────────┘
                                       │
   Starter template ───────────────────┤
                                       ▼
                          ┌────────────────────────┐
                          │  documents (SQLite)    │
                          └───────────┬────────────┘
                                      ▼
                    ┌─────────────────────────────────┐
                    │ Editor  (CodeMirror + PDF pane)  │
                    └───────┬─────────────────┬───────┘
                            │                 │
              latexCode     ▼                 ▼  prompt + PDF + log
                    ┌───────────────┐   ┌──────────────────────┐
                    │ /api/compile  │   │ /api/ai/modify       │
                    │ temp dir +    │   │ OpenRouter           │
                    │ pdflatex ×2   │   │ → sanitize → save    │
                    └───────┬───────┘   └──────────┬───────────┘
                            │                      │
              data/compiled/<id>.pdf         ai_history row
                            │                      │
                            ▼                      ▼
                     PDF preview            History drawer (undo)
```

## Tech stack

| Layer | Choice | Why |
| --- | --- | --- |
| Framework | Next.js 15 (App Router) | Server routes run Node APIs directly — needed for `pdflatex` and SQLite. |
| UI | React 19 + Tailwind CSS 3 | Fast to build a dense, keyboard-friendly studio UI. |
| Editor | CodeMirror 6 (`@uiw/react-codemirror`) | Lightweight, real LaTeX mode, no Monaco bundle. |
| Database | `better-sqlite3` | Synchronous, zero-config, a single file next to the app. |
| PDF text | `pdf-parse` v2 | Extracts text from imported PDFs. |
| Word text | `mammoth` | `.docx` → plain text for conversion. |
| Compiler | `pdflatex` (TeX Live / MiKTeX) | The real thing, invoked in an isolated temp directory. |
| AI | OpenRouter chat completions | One API for many models, including free ones. |

## Requirements

| Requirement | Notes |
| --- | --- |
| **Node.js 20+** (22 LTS recommended) | `better-sqlite3` ships prebuilt binaries for common platforms. |
| **A LaTeX distribution** (`pdflatex`) | TeX Live, MiKTeX, TinyTeX or a project-local `.texlive/` tree. The Docker image bundles it. |
| **OpenRouter API key** (optional) | Only for AI editing and AI import. Everything else works without it. |

## Quick start

```bash
git clone <your-repo-url> resumeaw
cd resumeaw
npm install
npm run dev
```

Open <http://localhost:3000>, click **New document**, pick a template, and start typing.
The PDF builds automatically once `pdflatex` is found.

> **npm 12 blocks native install scripts by default.** If `npm install` leaves
> `better-sqlite3` unbuilt, run `npm install-scripts approve better-sqlite3`, or approve it
> when npm asks. `package.json` already declares it under `allowScripts`.

### Optional: enable the AI assistant

1. Create a key at <https://openrouter.ai/keys>.
2. Open **Settings**.
3. Paste the key.
4. The **model list** is preloaded with every free OpenRouter model. It is a plain
   textarea: one model ID per line, `#` starts a comment, add or remove anything you like.
   **Load all free models** refreshes it from `https://openrouter.ai/api/v1/models`.
5. Pick the active model and press **Apply & test**.

The status badge reports the real result: green *AI Connected & Working* with the
remaining credit balance, or red *AI Not Working* with the exact reason (invalid key, no
credits, unknown model, network failure).

## Run Reasumeaw on a Windows PC

### 1. Install the prerequisites

1. Install [Node.js 20 or newer](https://nodejs.org/) (Node.js 22 LTS is recommended).
2. Install one LaTeX distribution:
   - [MiKTeX](https://miktex.org/download), or
   - [TeX Live](https://tug.org/texlive/acquire-netinstall.html).
3. Close and reopen PowerShell or Windows Terminal after installation so `pdflatex` is
   available on `PATH`.

### 2. Download and start the app

Open PowerShell in the project folder, then run:

```powershell
npm install
npm run dev
```

Open <http://localhost:3000> in a browser.

For a production-style local run:

```powershell
npm run build
npm start
```

### 3. Verify compilation

Open a new PowerShell window and run:

```powershell
pdflatex --version
```

If the command is not found, set `PDFLATEX_PATH` for the current PowerShell session:

```powershell
$env:PDFLATEX_PATH="C:\full\path\to\pdflatex.exe"
npm run dev
```

You can also place a TeX Live portable tree under `.texlive\`; the app detects
`.texlive\bin\windows\pdflatex.exe` automatically.

### 4. Optional AI setup

Create an [OpenRouter API key](https://openrouter.ai/keys), open **Settings** in
Reasumeaw, paste the key and select a model. AI features are optional; document editing,
importing, SQLite storage and local PDF compilation work without a key.

## LaTeX setup

`resumeaw` never bundles a compiler — it finds one. Resolution order, first match wins:

1. `PDFLATEX_PATH`, if set.
2. A project-local toolchain: `.texlive/bin/windows/pdflatex.exe` (Windows) or
   `.texlive/bin/<platform>/pdflatex` (macOS/Linux).
3. TinyTeX (`%APPDATA%\TinyTeX`), MiKTeX (`%LOCALAPPDATA%\Programs\MiKTeX`,
   `%ProgramFiles%\MiKTeX`) and TeX Live (`C:\texlive\<year>\bin\<platform>`,
   `/usr/local/texlive`, `/opt/texlive`).
4. The system `PATH`.

**Installing one**

```bash
# Windows: install MiKTeX or TeX Live
#   https://miktex.org  /  https://tug.org/texlive

# macOS
brew install --cask mactex-no-gui

# Debian / Ubuntu
sudo apt install texlive-latex-base texlive-latex-extra texlive-fonts-recommended

# Fedora
sudo dnf install texlive-scheme-basic texlive-latex texlive-collection-latexextra
```

**Project-local TeX Live with no system install**

Drop a TeX Live tree at `.texlive/` in the project root (gitignored) and it is used
automatically. Install extra packages into it with its own `tlmgr`:

```bash
# Windows
.texlive/bin/windows/tlmgr.bat install enumitem titlesec parskip
# macOS / Linux
.texlive/bin/<platform>/tlmgr install enumitem titlesec parskip
```

**Point at a specific binary**

```bash
PDFLATEX_PATH="/usr/local/texlive/2024/bin/x86_64-linux/pdflatex" npm run dev
```

If no compiler is found, the preview shows an install hint instead of failing silently, and
the rest of the app keeps working.

## Using the app

### Dashboard

Every document is a card with its title, last-edit time, asset count and a PDF badge.
Actions: open, rename, duplicate, delete. **New document** creates one from a template;
**Import** turns an existing PDF or Word file into a project.

### Importing an existing resume

1. Click **Import** next to *New document* (or drop a file on the dialog).
2. `.pdf` and `.docx` up to **20 MB** are accepted.
3. Text is extracted, then converted to LaTeX — by the AI when a key is set, otherwise by
   the built-in converter.
4. The AI result is sanitized (invalid sectioning classes, invisible unicode spaces and
   unescaped `#` are repaired) and compiled in a temporary directory. A failure triggers
   one repair attempt that includes the compiler log; a second failure falls back to the
   deterministic converter, and the dialog says which path was used.

### Editor

- **Left pane:** LaTeX source. Autosaves as you type; compiles ~900 ms later.
- **Right pane:** PDF preview. Compile errors appear inline with the failing line.
- Toolbar: back to dashboard, editable title, **History**, **Compile**, download `.tex`,
  download `.pdf`, AI settings, assets toggle, theme toggle.
- **Assets panel:** upload a headshot or a reference file, then insert it at the cursor.

### AI prompt dock

Type an instruction ("fit this on one page", "tighten the skills section", "make the header
more compact") and send. The route sends:

1. your complete LaTeX source,
2. the current rendered PDF (base64 `file` part) when one exists,
3. metadata for uploaded assets and extracted text from reference documents,
4. the latest `pdflatex` log when the document does not currently compile.

You get a short changelog and the updated document. The change is saved to `ai_history`,
applied in the editor, recompiled, and announced in a dismissible notice. **History** lets
you undo a change or restore a previous result.

## Keyboard shortcuts

| Shortcut | Action |
| --- | --- |
| `Ctrl/⌘ + S` | Save and compile immediately |
| `Ctrl/⌘ + Enter` | Send the AI prompt |
| `Enter` in the title field | Save the title |
| `Esc` | Close a dialog or drawer |

## Configuration

| Variable | Default | Purpose |
| --- | --- | --- |
| `PDFLATEX_PATH` | auto-detected | Absolute path to the `pdflatex` binary. |
| `RESUMEAW_DATA_DIR` | `./data` | Where `sqlite.db`, `uploads/` and `compiled/` live. |
| `OPENROUTER_BASE_URL` | `https://openrouter.ai/api/v1` | Override for a proxy or compatible gateway. |

The OpenRouter key is **not** an environment variable — it is saved in SQLite through the
settings UI, so it never ends up in a shell history or a committed `.env` file.

## Where your data lives

```
data/
  sqlite.db                 documents, assets, settings, AI history
  uploads/<documentId>/     uploaded headshots and reference files
  compiled/<documentId>.pdf latest successful PDF
```

Runtime files deliberately live under `data/` rather than `public/`: Next's dev server
watches `public/`, and writing PDFs there triggered page reloads that discarded editor
state. Older builds that used `public/uploads` and `public/compiled` are still readable.

**Schema**

| Table | Columns |
| --- | --- |
| `documents` | `id`, `title`, `latex_code`, `last_pdf_path`, `created_at`, `updated_at` |
| `document_assets` | `id`, `document_id`, `filename`, `original_name`, `file_type`, `file_path`, `extracted_text`, `created_at` |
| `settings` | singleton row: `openrouter_api_key`, `openrouter_model`, `openrouter_models`, `api_status`, `api_status_message` |
| `ai_history` | `id`, `document_id`, `prompt`, `explanation`, `latex_before`, `latex_after`, `model`, `created_at` |

Foreign keys cascade, so deleting a document removes its assets and history rows, and the
API also deletes its upload folder and compiled PDF.

**Backups** are a single copy of `data/`. Nothing else in the repository holds user data.

## How compilation works

1. `POST /api/compile` receives `{ documentId, latexCode }`.
2. A temp directory is created with `main.tex` plus a copy of every uploaded asset, so
   `\includegraphics{photo.png}` resolves exactly as written.
3. `pdflatex -interaction=nonstopmode -halt-on-error -no-shell-escape -file-line-error main.tex`
   runs **twice** (references and page numbers), 15 s timeout per pass, no shell escape.
4. On success the PDF is copied to `data/compiled/<id>.pdf` and returned as
   `/api/files/compiled/<id>.pdf?v=<timestamp>` to defeat caching.
5. On failure the API returns the log (truncated at 30k characters). `-file-line-error`
   makes errors read `main.tex:15: Package titlesec Error: …`, which the editor shows
   verbatim and the AI receives when you ask for a fix.
6. The temp directory is always deleted.

## How the AI works

`POST /api/ai/modify` builds one multimodal request to
`https://openrouter.ai/api/v1/chat/completions`:

- **System prompt:** you are a LaTeX layout assistant; return a short changelog plus exactly
  one fenced `latex` block containing the complete document; never use `\titleclass`;
  preserve facts and ATS readability.
- **User content:** the full source, the rendered PDF, asset metadata, extracted reference
  text and, if present, the current compiler error.

The response is parsed for the last fenced code block, stripped of fences, sanitized
(`\titleclass` with invalid classes dropped, invisible unicode spaces normalized, stray `#`
escaped outside macro definitions and URLs), saved, and returned as
`{ updatedLatex, explanation }`.

Free models change often, which is why the model list is editable text rather than a fixed
dropdown. Model tests call the real API, so the status badge reflects reality.

## API reference

| Method | Route | Description |
| --- | --- | --- |
| `GET` | `/api/documents` | List documents with asset count and PDF status. |
| `POST` | `/api/documents` | Create from `{ templateId }`, or duplicate with `{ duplicateOf }`. |
| `GET` | `/api/documents/[id]` | Document plus assets. |
| `PATCH` | `/api/documents/[id]` | Update `title` and/or `latexCode`. |
| `DELETE` | `/api/documents/[id]` | Delete the document, its uploads and compiled PDF. |
| `GET` | `/api/documents/[id]/history` | AI changes with before/after LaTeX (`?limit=`, max 100, default 30). |
| `GET` | `/api/documents/[id]/assets` | List assets. |
| `POST` | `/api/documents/[id]/assets` | Multipart upload, field `files` (25 MB each). |
| `DELETE` | `/api/documents/[id]/assets?assetId=…` | Delete one asset. |
| `POST` | `/api/import` | Multipart `file` (`.pdf`/`.docx`, ≤ 20 MB) + optional `title` → new document. |
| `POST` | `/api/compile` | `{ documentId, latexCode }` → `{ success: true, pdfUrl }` or `{ success: false, log }`. |
| `POST` | `/api/ai/modify` | `{ documentId, prompt, latexCode, compileLog? }` → `{ updatedLatex, explanation }`. |
| `GET` | `/api/models` | Every free OpenRouter model (`pricing` 0/0 or a `:free` suffix). |
| `GET` | `/api/settings` | Settings, saved model list, presets, default model. |
| `POST` | `/api/settings` | `{ apiKey, model, models }` → saves, tests live, returns `{ working, statusMessage }`. |
| `GET` | `/api/files/[...path]` | Serves uploaded assets and compiled PDFs (also legacy `public/` paths). |

## Project structure

```
app/
  page.tsx                        dashboard (server component)
  settings/page.tsx               standalone settings page
  editor/[id]/page.tsx            editor shell
  not-found.tsx
  layout.tsx                      metadata, theme script, favicons
  globals.css
  api/
    documents/route.ts                     list / create / duplicate
    documents/[id]/route.ts                load / update / delete
    documents/[id]/assets/route.ts         upload / list / delete assets
    documents/[id]/history/route.ts        AI history with before/after snapshots
    compile/route.ts                       pdflatex pipeline
    import/route.ts                        PDF/DOCX → LaTeX (AI + repair + fallback)
    ai/modify/route.ts                     OpenRouter editing
    models/route.ts                        free model catalogue
    settings/route.ts                      settings + live key test
    files/[...path]/route.ts               serves uploads and compiled PDFs
components/
  dashboard.tsx                   document grid, header, footer
  import-dialog.tsx               drag-drop import with per-method notes
  settings-panel.tsx              key + model list form with live status
  settings-dialog.tsx             in-editor version of the settings form
  theme-toggle.tsx
  ui/modal.tsx
  editor/
    workspace.tsx                 split view, autosave, shortcuts, downloads
    code-editor.tsx               CodeMirror + insert-at-cursor
    pdf-preview.tsx               PDF frame, zoom, error overlay
    ai-bar.tsx                    prompt dock, changelog notice
    history-drawer.tsx            edit list with undo / restore
    assets-panel.tsx              uploads and \includegraphics insertion
lib/
  db.ts                           SQLite schema, migrations and queries
  compile.ts                      pdflatex resolution, compile pipeline, validation
  openrouter.ts                   key test, free models, chat completions, presets
  latex-parse.ts                  code-block extraction + AI output sanitizer
  text-to-latex.ts                deterministic PDF/DOCX text → LaTeX fallback
  extract-text.ts                 PDF / DOCX / TXT text extraction
  assets.ts                       paths, filename sanitizing, legacy fallbacks
  templates.ts                    starter LaTeX documents
  types.ts                        shared types
  format.ts                       date formatting
public/                           favicons, manifest, logo
data/                             created at runtime (gitignored)
.texlive/                         optional project-local TeX Live (gitignored)
Dockerfile                        production image with TeX Live
```

## Docker

```bash
docker build -t resumeaw .
docker run --rm -p 3000:3000 -v resumeaw-data:/app/data resumeaw
```

The image installs `texlive-latex-base`, `texlive-latex-extra`,
`texlive-fonts-recommended` and `texlive-lang-english`, so compilation works out of the box.
Mount `/app/data` to keep SQLite, uploads and compiled PDFs between runs. Configuration
variables can be passed with `-e`, for example
`-e RESUMEAW_DATA_DIR=/app/data -e PDFLATEX_PATH=/usr/bin/pdflatex`.

## Troubleshooting

**`pdflatex was not found on this system`**
Install TeX Live or MiKTeX, drop a TeX Live tree at `.texlive/`, or set `PDFLATEX_PATH`,
then restart the dev server. Docker needs nothing on the host.

**`File 'grfext.sty' not found` / any missing `.sty`**
That package is not in your distribution. With a project-local tree:
`.texlive/bin/windows/tlmgr.bat install grfext` (or `tlmgr install <package>` on
macOS/Linux). Debian/Ubuntu: `sudo apt install texlive-latex-extra`.

**`Package titlesec Error: Unknown sectioning class` at `\titleclass{\section}{normal}`**
`\titleclass` only accepts `top`, `page` and `straight`. Imports are sanitized and
compile-checked, so this should not reach you from AI output; if you pasted it yourself,
delete the line or use `\titleformat` / `\titlespacing` instead.

**`LaTeX Error: Unicode character  (U+202F)`**
A narrow no-break space copied from a PDF. Imports normalize invisible spaces
automatically; in hand-written LaTeX replace it with a normal space or `~`.

**`You can't use macro parameter character # in horizontal mode`**
A literal `#` such as "C#" that was not escaped. Write `C\#`. Imports escape it
automatically.

**AI Not Working: 401 / 402**
`401` means the key is invalid or revoked — create a new one. `402` means OpenRouter
credits are exhausted — top up at <https://openrouter.ai/credits>.

**The model rejects the request**
Some models are text-only. Pick a vision/PDF-capable model (Gemini, Claude Sonnet, GPT-4.1,
Qwen-VL) or enter a custom ID.

**Free model list is empty**
OpenRouter may be unreachable. Press **Load all free models** again or type model IDs by
hand.

**Images missing from the PDF**
The filename in `\includegraphics` must match the asset panel exactly. Use the
*Insert `\includegraphics`* button so the name is correct; files are copied next to
`main.tex` for each compile.

**`npm install` fails on `better-sqlite3`**
Native install scripts were blocked. Run `npm install-scripts approve better-sqlite3`
(npm ≥ 12) and reinstall. Node 20+ is required.

**Compilation times out**
Each pass has a 15 s limit. A runaway macro or an infinite loop is the usual cause; check
the log for the last file processed.

## Scripts

```bash
npm run dev        # dev server on http://localhost:3000
npm run build      # production build
npm start          # run the production build
npm run typecheck  # tsc --noEmit
```

## Security note

`resumeaw` has **no authentication by design** — it is a single-user, local application
that runs `pdflatex` on your machine and reads your local files. Do not expose it to the
internet or an untrusted network as-is. Compilation runs with `-no-shell-escape`, but a
public deployment would still need auth, per-user data isolation and a sandboxed runner.

Outbound requests happen only when you trigger AI features, and they go to the OpenRouter
endpoint with the key stored in your local database.

## License

This project is licensed under the [MIT License](./LICENSE).

## Author

**AKIF Soufiane**

- GitHub: [@Soufianeakif](https://github.com/Soufianeakif)
- Support: [Buy Me a Coffee](https://www.buymeacoffee.com/soufianeakif)

Built with Next.js, a lot of LaTeX debugging, and an AI that occasionally needs to be told
that "normal" is not a sectioning class.
