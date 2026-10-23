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
  const { stillSrc, logoSrc } = await rasterizeShareCardAssets(resolveShareCardStill());
  const font = await plexSans;

  return new ImageResponse(
    (
      <div style={{ display: "flex", width: 1200, height: 630, background: "#100f0d", fontFamily: "IBM Plex Sans" }}>
        <div style={{ display: "flex", width: 780, height: 630, background: "#0a0908", position: "relative" }}>
          {stillSrc ? (
            <img src={stillSrc} alt="" width={780} height={630} style={{ objectFit: "cover" }} />
          ) : (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", width: 780, height: 630 }}>
              <img src={logoSrc} alt="" width={48} height={48} />
              <div style={{ display: "flex", marginTop: 16, fontSize: 28, fontWeight: 600, letterSpacing: -0.5, color: "#f3eee6" }}>PrintCast</div>
            </div>
          )}
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            width: 420,
            height: 630,
            background: "#1a1815",
            borderLeft: "1px solid #2f2b26",
            padding: "40px 40px 36px",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", alignItems: "center" }}>
              <img src={logoSrc} alt="" width={22} height={22} />
              <div style={{ display: "flex", marginLeft: 10, fontSize: 13, fontWeight: 600, letterSpacing: 2.4, color: "#b7aea3" }}>{copy.brand}</div>
            </div>
            <div style={{ display: "flex", marginTop: 20, fontSize: 13, fontWeight: 600, letterSpacing: 1.6, color: status.color }}>
              {status.label.toUpperCase()}
            </div>
          </div>
          {copy.meter.show ? (
            <div style={{ display: "flex", flexDirection: "column" }}>
              <div style={{ display: "flex", fontSize: 72, fontWeight: 600, letterSpacing: -3, lineHeight: 0.95, color: "#f3eee6" }}>{copy.meter.percent}%</div>
              <div style={{ display: "flex", marginTop: 12, fontSize: 16, fontWeight: 500, color: "#b7aea3" }}>{copy.subject}</div>
              <div style={{ display: "flex", marginTop: 20, width: 340, height: 4, background: "#2f2b26", borderRadius: 99, overflow: "hidden" }}>
                {copy.meter.percent > 0 ? (
                  <div style={{ display: "flex", width: Math.round((340 * copy.meter.percent) / 100), height: 4, background: "#3bb87a" }} />
                ) : null}
              </div>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column" }}>
              <div style={{ display: "flex", fontSize: 22, fontWeight: 600, color: "#8d857b" }}>No job</div>
              <div style={{ display: "flex", marginTop: 8, fontSize: 16, fontWeight: 500, color: "#b7aea3" }}>{copy.subject}</div>
            </div>
          )}
          <div style={{ display: "flex", justifyContent: "space-between", width: 340, paddingTop: 20, borderTop: "1px solid #2f2b26" }}>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <div style={{ display: "flex", fontSize: 11, letterSpacing: 1.5, color: "#8d857b" }}>NOZZLE</div>
              <div style={{ display: "flex", marginTop: 6, fontSize: 22, fontWeight: 600, color: "#f3eee6" }}>{copy.nozzle}</div>
            </div>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <div style={{ display: "flex", fontSize: 11, letterSpacing: 1.5, color: "#8d857b" }}>BED</div>
              <div style={{ display: "flex", marginTop: 6, fontSize: 22, fontWeight: 600, color: "#f3eee6" }}>{copy.bed}</div>
            </div>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <div style={{ display: "flex", fontSize: 11, letterSpacing: 1.5, color: "#8d857b" }}>CHAMBER</div>
              <div style={{ display: "flex", marginTop: 6, fontSize: 22, fontWeight: 600, color: "#f3eee6" }}>{copy.chamber}</div>
            </div>
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
      nozzle: "-",
      bed: "-",
      chamber: "-",
      meter: shareCardMeter("IDLE", null),
      brand: shareCardBrand(copy.title),
    };
  }
}
