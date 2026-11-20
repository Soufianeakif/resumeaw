export type DocumentRecord = {
  id: string;
  title: string;
  latex_code: string;
  last_pdf_path: string | null;
  created_at: string;
  updated_at: string;
};

export type DocumentSummary = DocumentRecord & {
  asset_count: number;
  has_pdf: boolean;
  pdf_url: string | null;
};

export type DocumentAsset = {
  id: string;
  document_id: string;
  filename: string;
  original_name: string;
  file_type: string;
  file_path: string;
  extracted_text: string | null;
  created_at: string;
};

export type AppSettings = {
  id: number;
  openrouter_api_key: string;
  openrouter_model: string;
  openrouter_models: string;
  api_status: "untested" | "connected" | "error";
  api_status_message: string;
};

export type FreeModel = { id: string; name: string };

export type TemplateId = "blank" | "modern-resume" | "cover-letter";

export type ClientAsset = DocumentAsset & {
  url: string;
  is_image: boolean;
  is_reference: boolean;
};

export type DashboardDocument = {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
  asset_count: number;
  has_pdf: boolean;
  pdf_url: string | null;
};
