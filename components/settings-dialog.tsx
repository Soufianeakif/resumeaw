"use client";

import { Modal } from "./ui/modal";
import { SettingsPanel } from "./settings-panel";

export function SettingsDialog({
  open,
  onClose,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  onSaved?: () => void;
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="AI settings"
      description="Connect OpenRouter so the assistant can edit your LaTeX."
      size="lg"
      footer={
        <button type="button" onClick={onClose} className="btn-secondary">
          Close
        </button>
      }
    >
      <SettingsPanel onSaved={onSaved} compact />
    </Modal>
  );
}
