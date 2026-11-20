import { NextResponse } from "next/server";
import os from "node:os";

export const dynamic = "force-dynamic";

function lanAddresses(): string[] {
  const interfaces = os.networkInterfaces();
  const addresses: string[] = [];
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name] ?? []) {
      if (iface.family !== "IPv4" || iface.internal) continue;
      addresses.push(iface.address);
    }
  }
  // Prefer private ranges; dedupe.
  const unique = Array.from(new Set(addresses));
  return unique;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const port = url.port || process.env.PORT || "3000";
  const protocol = url.protocol || "http:";
  const ips = lanAddresses();
  const urls = ips.map((ip) => `${protocol}//${ip}:${port}`);
  // Also include the host the client used, if it isn't localhost.
  const hostHeader = request.headers.get("host") ?? "";
  const hostIp = hostHeader.split(":")[0];
  if (hostIp && hostIp !== "localhost" && hostIp !== "127.0.0.1" && !ips.includes(hostIp)) {
    ips.unshift(hostIp);
    urls.unshift(`${protocol}//${hostHeader}`);
  }
  return NextResponse.json({ ips, port, urls });
}