import { NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";
import {
  assetFilenames,
  createAsset,
  deleteAsset,
  getAsset,
  getDocument,
  listAssets,
} from "@/lib/db";
import {
  assetPublicUrl,
  documentUploadDirectory,
  isImageFile,
  isReferenceDocument,
  MAX_UPLOAD_BYTES,
  removeDocumentAssetFile,
  sanitizeFilename,
  uniqueFilename,
} from "@/lib/assets";
import { extractTextFromFile } from "@/lib/extract-text";
import type { DocumentAsset } from "@/lib/types";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

function withUrl(asset: DocumentAsset) {
  return {
    ...asset,
    url: assetPublicUrl(asset),
    is_image: isImageFile(asset.filename, asset.file_type),
    is_reference: isReferenceDocument(asset.filename, asset.file_type),
  };
}

export async function GET(_request: Request, { params }: Params) {
  const { id } = await params;
  if (!getDocument(id)) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }
  return NextResponse.json({ assets: listAssets(id).map(withUrl) });
}

export async function POST(request: Request, { params }: Params) {
  const { id } = await params;
  if (!getDocument(id)) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json(
      { error: "Expected multipart/form-data with a files field" },
      { status: 400 }
    );
  }

  const files = form
    .getAll("files")
    .filter((value): value is File => value instanceof File);

  if (files.length === 0) {
    return NextResponse.json({ error: "No files provided" }, { status: 400 });
  }

  const directory = documentUploadDirectory(id);
  await fs.mkdir(directory, { recursive: true });

  const created: ReturnType<typeof withUrl>[] = [];
  const errors: string[] = [];
  const taken = assetFilenames(id);

  for (const file of files) {
    const originalName = file.name || "upload";

    if (file.size === 0) {
      errors.push(`${originalName}: file is empty.`);
      continue;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      errors.push(`${originalName}: larger than 25 MB.`);
      continue;
    }

    const candidateType = file.type || "";
    if (
      !isImageFile(originalName, candidateType) &&
      !isReferenceDocument(originalName, candidateType)
    ) {
      errors.push(
        `${originalName}: unsupported type. Use .png/.jpg/.jpeg images or .pdf/.txt/.docx documents.`
      );
      continue;
    }

    const desired = sanitizeFilename(originalName);
    const filename = await uniqueFilename(directory, desired, taken);
    taken.push(filename);
    const absolutePath = path.join(directory, filename);

    try {
      const buffer = Buffer.from(await file.arrayBuffer());
      await fs.writeFile(absolutePath, buffer);

      const extracted = isReferenceDocument(filename, candidateType)
        ? await extractTextFromFile(absolutePath, filename)
        : null;

      const asset = createAsset({
        document_id: id,
        filename,
        original_name: originalName,
        file_type: candidateType || guessType(filename),
        file_path: absolutePath,
        extracted_text: extracted,
      });
      created.push(withUrl(asset));
    } catch (error) {
      errors.push(
        `${originalName}: could not be saved (${
          error instanceof Error ? error.message : "unknown error"
        }).`
      );
    }
  }

  if (created.length === 0) {
    return NextResponse.json(
      { error: errors.join(" ") || "No files could be saved.", errors },
      { status: 400 }
    );
  }

  return NextResponse.json({ assets: created, errors }, { status: 201 });
}

export async function DELETE(request: Request, { params }: Params) {
  const { id } = await params;
  const assetId = new URL(request.url).searchParams.get("assetId");
  if (!assetId) {
    return NextResponse.json({ error: "assetId is required" }, { status: 400 });
  }

  const asset = getAsset(id, assetId);
  if (!asset) {
    return NextResponse.json({ error: "Asset not found" }, { status: 404 });
  }

  deleteAsset(id, assetId);
  await removeDocumentAssetFile(id, asset.filename);

  return NextResponse.json({ deleted: true });
}

function guessType(filename: string) {
  const ext = path.extname(filename).toLowerCase();
  const map: Record<string, string> = {
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".pdf": "application/pdf",
    ".txt": "text/plain",
    ".docx":
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  };
  return map[ext] ?? "application/octet-stream";
}
