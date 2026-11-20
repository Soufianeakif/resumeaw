import { NextResponse } from "next/server";
import fsp from "node:fs/promises";
import path from "node:path";
import {
  createAsset,
  createDocument,
  getDocument,
  listAssets,
  listDocuments,
} from "@/lib/db";
import { createTitleForTemplate, getTemplate } from "@/lib/templates";
import { documentUploadDirectory, hasCompiledPdf } from "@/lib/assets";

export const dynamic = "force-dynamic";

function pdfUrlFor(id: string) {
  return hasCompiledPdf(id) ? `/api/files/compiled/${id}.pdf` : null;
}

export async function GET() {
  const documents = listDocuments().map((doc) => {
    const pdfUrl = pdfUrlFor(doc.id);
    return {
      id: doc.id,
      title: doc.title,
      created_at: doc.created_at,
      updated_at: doc.updated_at,
      asset_count: listAssets(doc.id).length,
      has_pdf: Boolean(pdfUrl),
      pdf_url: pdfUrl,
    };
  });

  return NextResponse.json({ documents });
}

export async function POST(request: Request) {
  let body: {
    title?: unknown;
    templateId?: unknown;
    duplicateOf?: unknown;
  };

  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const duplicateOf = typeof body.duplicateOf === "string" ? body.duplicateOf : null;

  if (duplicateOf) {
    const source = getDocument(duplicateOf);
    if (!source) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    const copy = createDocument({
      title: `${source.title} (copy)`,
      latexCode: source.latex_code,
    });

    const sourceAssets = listAssets(source.id);
    if (sourceAssets.length > 0) {
      const sourceDir = documentUploadDirectory(source.id);
      const targetDir = documentUploadDirectory(copy.id);
      await fsp.mkdir(targetDir, { recursive: true });

      for (const asset of sourceAssets) {
        const from = path.join(sourceDir, asset.filename);
        const to = path.join(targetDir, asset.filename);
        try {
          await fsp.copyFile(from, to);
        } catch {
          continue;
        }
        createAsset({
          document_id: copy.id,
          filename: asset.filename,
          original_name: asset.original_name,
          file_type: asset.file_type,
          file_path: to,
          extracted_text: asset.extracted_text,
        });
      }
    }

    return NextResponse.json({ document: copy }, { status: 201 });
  }

  const template = getTemplate(
    typeof body.templateId === "string" ? body.templateId : undefined
  );
  const title =
    typeof body.title === "string" && body.title.trim()
      ? body.title.trim()
      : createTitleForTemplate(template);

  const document = createDocument({ title, latexCode: template.latex });
  return NextResponse.json({ document }, { status: 201 });
}
