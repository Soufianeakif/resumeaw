import { NextResponse } from "next/server";
import { deleteDocument, getDocument, listAssets, updateDocument } from "@/lib/db";
import { hasCompiledPdf, removeDocumentFiles } from "@/lib/assets";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { id } = await params;
  const document = getDocument(id);
  if (!document) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }

  const hasPdf = hasCompiledPdf(id);

  return NextResponse.json({
    document,
    assets: listAssets(id),
    hasPdf,
    pdfUrl: hasPdf ? `/api/files/compiled/${id}.pdf` : null,
  });
}

export async function PATCH(request: Request, { params }: Params) {
  const { id } = await params;
  if (!getDocument(id)) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }

  let body: { title?: unknown; latexCode?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const title =
    typeof body.title === "string" && body.title.trim()
      ? body.title.trim().slice(0, 200)
      : undefined;
  const latexCode = typeof body.latexCode === "string" ? body.latexCode : undefined;

  if (title === undefined && latexCode === undefined) {
    return NextResponse.json(
      { error: "Provide a title or latexCode to update" },
      { status: 400 }
    );
  }

  const document = updateDocument(id, { title, latexCode });
  return NextResponse.json({ document });
}

export async function DELETE(_request: Request, { params }: Params) {
  const { id } = await params;
  if (!getDocument(id)) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }

  deleteDocument(id);
  await removeDocumentFiles(id);

  return NextResponse.json({ deleted: true });
}
