import { NextResponse } from "next/server";
import { countHistory, getDocument, listHistoryEntries } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!getDocument(id)) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }

  const requested = Number(new URL(request.url).searchParams.get("limit"));
  const limit =
    Number.isFinite(requested) && requested > 0
      ? Math.min(Math.floor(requested), 100)
      : 30;

  return NextResponse.json(
    {
      entries: listHistoryEntries(id, limit),
      total: countHistory(id),
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
