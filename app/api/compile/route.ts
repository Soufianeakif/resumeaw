import { NextResponse } from "next/server";
import { compileDocument } from "@/lib/compile";
import { getDocument } from "@/lib/db";
import { isSafeDocumentId } from "@/lib/assets";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: Request) {
  let body: { documentId?: unknown; latexCode?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, log: "Invalid JSON body." }, { status: 400 });
  }

  const documentId = typeof body.documentId === "string" ? body.documentId : "";
  const latexCode = typeof body.latexCode === "string" ? body.latexCode : "";

  if (!isSafeDocumentId(documentId) || !getDocument(documentId)) {
    return NextResponse.json(
      { success: false, log: "Document not found." },
      { status: 404 }
    );
  }

  if (!latexCode.trim()) {
    return NextResponse.json(
      { success: false, log: "The LaTeX source is empty." },
      { status: 400 }
    );
  }

  try {
    const result = await compileDocument(documentId, latexCode);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        log: `Compilation crashed: ${
          error instanceof Error ? error.message : "unknown error"
        }`,
      },
      { status: 500 }
    );
  }
}
