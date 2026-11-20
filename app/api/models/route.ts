import { NextResponse } from "next/server";
import { fetchFreeModels } from "@/lib/openrouter";

export const dynamic = "force-dynamic";

export async function GET() {
  const result = await fetchFreeModels();

  if (!result.ok) {
    return NextResponse.json(
      { error: result.message, models: [] },
      { status: 502, headers: { "Cache-Control": "no-store" } }
    );
  }

  return NextResponse.json(
    { models: result.models, count: result.models.length },
    { headers: { "Cache-Control": "no-store" } }
  );
}
