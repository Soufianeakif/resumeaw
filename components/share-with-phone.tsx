"use client";

import { useEffect, useState } from "react";
import { Copy, QrCode, Smartphone, Wifi } from "lucide-react";
import QRCode from "qrcode";
import { Modal } from "./ui/modal";

export function ShareWithPhone({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [urls, setUrls] = useState<string[]>([]);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setError(null);
    setQrDataUrl(null);
    (async () => {
      try {
        const response = await fetch("/api/network", { cache: "no-store" });
        const data = (await response.json()) as { urls?: string[] };
        const list = data.urls ?? [];
        if (cancelled) return;
        setUrls(list);
        if (list.length === 0) {
          setError("No LAN address found. Connect to a network and try again.");
          return;
        }
        const dataUrl = await QRCode.toDataURL(list[0], {
          width: 256,
          margin: 2,
          color: { dark: "#0f141c", light: "#ffffff" },
        });
        if (!cancelled) setQrDataUrl(dataUrl);
      } catch (err) {
        if (!cancelled)
          setError(err instanceof Error ? err.message : "Could not load network info.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open]);

  async function copy(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(url);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      // ignore
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Share with your phone"
      description="Scan the QR code with your phone camera. Your phone and this computer must be on the same Wi-Fi / network."
      size="md"
    >
      <div className="space-y-4">
        <div className="flex flex-col items-center gap-3 rounded-xl border border-border bg-elevated/40 p-4">
          {qrDataUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={qrDataUrl}
              alt="QR code for LAN access"
              width={256}
              height={256}
              className="rounded-lg bg-white p-2"
            />
          ) : error ? (
            <div className="flex h-64 w-64 items-center justify-center rounded-lg border border-danger/30 bg-danger/10 text-center text-sm text-danger">
              {error}
            </div>
          ) : (
            <div className="flex h-64 w-64 items-center justify-center">
              <QrCode className="h-8 w-8 animate-pulse text-muted" />
            </div>
          )}
          {urls.length > 0 ? (
            <p className="break-all text-center font-mono text-xs text-muted">
              {urls[0]}
            </p>
          ) : null}
        </div>

        {urls.length > 1 ? (
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted">Other addresses</p>
            {urls.slice(1).map((url) => (
              <div
                key={url}
                className="flex items-center justify-between gap-2 rounded-lg border border-border bg-background px-3 py-2"
              >
                <span className="truncate font-mono text-xs">{url}</span>
                <button
                  type="button"
                  onClick={() => void copy(url)}
                  className="btn-ghost h-7 !px-2 text-xs"
                >
                  {copied === url ? "Copied" : "Copy"}
                </button>
              </div>
            ))}
          </div>
        ) : null}

        <div className="rounded-lg border border-border bg-background p-3 text-sm text-muted">
          <div className="flex items-start gap-2">
            <Wifi className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
            <div className="space-y-1">
              <p>
                Open the scanned link on your phone. You will see the same
                documents and editor; changes sync through this computer.
              </p>
              <p>
                If the page does not load, check that your firewall allows
                port {urls[0]?.split(":").pop() ?? "3000"} and that both
                devices are on the same network.
              </p>
            </div>
          </div>
        </div>

        {urls.length > 0 ? (
          <button
            type="button"
            onClick={() => void copy(urls[0])}
            className="btn-secondary w-full justify-center gap-2"
          >
            <Copy className="h-4 w-4" />
            {copied === urls[0] ? "Copied link" : "Copy link"}
          </button>
        ) : null}

        <div className="flex items-center gap-2 text-xs text-faint">
          <Smartphone className="h-3.5 w-3.5" />
          Tip: add the page to your phone home screen for app-like access.
        </div>
      </div>
    </Modal>
  );
}