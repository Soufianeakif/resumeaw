import { NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";
import { publicDirectory, storageRoot } from "@/lib/assets";

export const dynamic = "force-dynamic";

const TYPES: Record<string, string> = {
  ".pdf": "application/pdf",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".txt": "text/plain; charset=utf-8",
  ".docx":
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path: segments } = await params;

  let decoded: string[];
  try {
    decoded = segments.map((segment) => decodeURIComponent(segment));
  } catch {
    return NextResponse.json({ error: "Invalid path" }, { status: 400 });
  }

  for (const root of [storageRoot(), publicDirectory()]) {
    const base = path.resolve(root);
    const target = path.resolve(base, ...decoded);

    if (target === base || !target.startsWith(base + path.sep)) {
      return NextResponse.json({ error: "Invalid path" }, { status: 400 });
    }

    try {
      const stat = await fs.stat(target);
      if (!stat.isFile()) continue;
      const data = await fs.readFile(target);
      const type =
        TYPES[path.extname(target).toLowerCase()] ?? "application/octet-stream";

      return new Response(new Uint8Array(data), {
        headers: {
          "Content-Type": type,
          "Content-Length": String(data.byteLength),
          "Cache-Control": "no-store, max-age=0",
          "Content-Disposition": `inline; filename="${path.basename(target)}"`,
        },
      });
    } catch {
      // try the next root
    }
  }

  return NextResponse.json({ error: "File not found" }, { status: 404 });
}
