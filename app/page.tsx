import { hasCompiledPdf } from "@/lib/assets";
import { listAssets, listDocuments } from "@/lib/db";
import { Dashboard } from "@/components/dashboard";
import type { DashboardDocument } from "@/lib/types";

export const dynamic = "force-dynamic";

export default function HomePage() {
  const documents: DashboardDocument[] = listDocuments().map((document) => {
    const hasPdf = hasCompiledPdf(document.id);

    return {
      id: document.id,
      title: document.title,
      created_at: document.created_at,
      updated_at: document.updated_at,
      asset_count: listAssets(document.id).length,
      has_pdf: hasPdf,
      pdf_url: hasPdf ? `/api/files/compiled/${document.id}.pdf` : null,
    };
  });

  return <Dashboard initialDocuments={documents} />;
}
