import { readFile } from "node:fs/promises";
import path from "node:path";
import { ImageResponse } from "next/og";
import { currentLive, settings } from "../lib/store";
import { buildShareCardCopy, fallbackShareCardCopy, shareCardBrand, shareCardMeter, shareCardStatus, shareCardTemp } from "../lib/share-card";
import { rasterizeShareCardAssets } from "../lib/share-card-image";
import { resolveShareCardStill } from "../lib/share-card-still";

export const alt = "PrintCast";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const SHARE_CARD_HEADERS = {
  "Cache-Control": "private, no-store, no-cache, must-revalidate, max-age=0",
  "CDN-Cache-Control": "no-store",
  "Cloudflare-CDN-Cache-Control": "no-store",
};

const plexSans = readFile(path.join(process.cwd(), "assets", "ibm-plex-sans-600.woff"));

export default async function Image() {
  const copy = loadCopy();
  const status = shareCardStatus(copy.state);
  const { stillSrc } = await rasterizeShareCardAssets(resolveShareCardStill());
  const font = await plexSans;

  return new ImageResponse(
    (
      <div style={{ display: "flex", width: 1200, height: 630, background: "#101010", fontFamily: "IBM Plex Sans" }}>
        <div style={{ display: "flex", width: 852, height: 630, background: "#101010" }}>
          {stillSrc ? <img src={stillSrc} alt="" width={852} height={630} style={{ objectFit: "cover" }} /> : null}
        </div>
        <div style={{ display: "flex", width: 348, height: 630, background: "#101010", position: "relative" }}>
          <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 8, background: status.color }} />
          <div style={{ position: "absolute", left: 0, top: 0, width: 72, height: 8, background: status.color }} />
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              position: "absolute",
              left: 36,
              right: 32,
              top: 36,
              bottom: 36,
              width: 280,
            }}
          >
            <div style={{ display: "flex", fontSize: 15, fontWeight: 600, letterSpacing: 3.3, color: status.color }}>
              {status.label.toUpperCase()}
            </div>
            {copy.meter.show ? (
              <div style={{ display: "flex", flexDirection: "column" }}>
                <div style={{ display: "flex", fontSize: 56, fontWeight: 600, letterSpacing: -2, color: "#f4f4f5" }}>{copy.meter.percent}%</div>
                <div style={{ display: "flex", marginTop: 16, width: 280, height: 8, background: "#2a2a2a" }}>
                  {copy.meter.percent > 0 ? (
                    <div style={{ display: "flex", width: Math.round((280 * copy.meter.percent) / 100), height: 8, background: status.color }} />
                  ) : null}
                </div>
              </div>
            ) : (
              <div style={{ display: "flex", fontSize: 22, fontWeight: 600, color: "#71717a" }}>No job</div>
            )}
            <div style={{ display: "flex", justifyContent: "space-between", width: 280 }}>
              <div style={{ display: "flex", flexDirection: "column" }}>
                <div style={{ display: "flex", fontSize: 11, letterSpacing: 1.5, color: "#71717a" }}>NOZZLE</div>
                <div style={{ display: "flex", marginTop: 4, fontSize: 22, fontWeight: 600, color: "#f4f4f5" }}>{copy.nozzle}</div>
              </div>
              <div style={{ display: "flex", flexDirection: "column" }}>
                <div style={{ display: "flex", fontSize: 11, letterSpacing: 1.5, color: "#71717a" }}>BED</div>
                <div style={{ display: "flex", marginTop: 4, fontSize: 22, fontWeight: 600, color: "#f4f4f5" }}>{copy.bed}</div>
              </div>
              <div style={{ display: "flex", flexDirection: "column" }}>
                <div style={{ display: "flex", fontSize: 11, letterSpacing: 1.5, color: "#71717a" }}>CHAMBER</div>
                <div style={{ display: "flex", marginTop: 4, fontSize: 22, fontWeight: 600, color: "#f4f4f5" }}>{copy.chamber}</div>
              </div>
            </div>
            <div style={{ display: "flex", fontSize: 16, fontWeight: 600, letterSpacing: 2.9, color: "#71717a" }}>{copy.brand}</div>
          </div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      headers: SHARE_CARD_HEADERS,
      fonts: [{ name: "IBM Plex Sans", data: font, weight: 600, style: "normal" }],
    },
  );
}

function loadCopy() {
  try {
    const live = currentLive();
    const display = settings();
    const copy = buildShareCardCopy({
      title: display.title,
      file: live.filename,
      percent: live.percent,
      nozzleC: live.temps.nozzle.actual,
      bedC: live.temps.bed.actual,
      host: "",
      state: live.state,
    });
    return {
      ...copy,
      nozzle: shareCardTemp(live.temps.nozzle.actual),
      bed: shareCardTemp(live.temps.bed.actual),
      chamber: shareCardTemp(live.temps.chamber.actual),
      meter: shareCardMeter(live.state, live.showBar ? live.percent : null),
      brand: shareCardBrand(copy.title),
    };
  } catch {
    const copy = fallbackShareCardCopy("");
    return {
      ...copy,
      nozzle: "—",
      bed: "—",
      chamber: "—",
      meter: shareCardMeter("IDLE", null),
      brand: shareCardBrand(copy.title),
    };
  }
}
