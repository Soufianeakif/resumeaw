import { notFound } from "next/navigation";
import { EditorWorkspace } from "@/components/editor/workspace";
import {
  assetPublicUrl,
  hasCompiledPdf,
  isImageFile,
  isReferenceDocument,
} from "@/lib/assets";
import { getDocument, getSettings, listAssets } from "@/lib/db";
import type { ClientAsset } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function EditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const doc = getDocument(id);
  if (!doc) notFound();

  const assets: ClientAsset[] = listAssets(id).map((asset) => ({
    ...asset,
    url: assetPublicUrl(asset),
    is_image: isImageFile(asset.filename, asset.file_type),
    is_reference: isReferenceDocument(asset.filename, asset.file_type),
  }));

  const hasPdf = hasCompiledPdf(id);
  const settings = getSettings();

  return (
    <EditorWorkspace
      document={doc}
      initialAssets={assets}
      hasPdf={hasPdf}
      aiReady={Boolean(settings.openrouter_api_key.trim())}
      model={settings.openrouter_model}
    />
  );
}
