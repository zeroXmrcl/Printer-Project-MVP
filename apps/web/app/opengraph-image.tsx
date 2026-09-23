import { ImageResponse } from "next/og";
import { currentLive, settings } from "../lib/store";
import { buildShareCardCopy, fallbackShareCardCopy } from "../lib/share-card";
import { rasterizeShareCardAssets } from "../lib/share-card-image";
import { resolveShareCardStill } from "../lib/share-card-still";

export const alt = "PrintCast";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function Image() {
  const copy = loadCopy();
  const { stillSrc, logoSrc } = await rasterizeShareCardAssets(resolveShareCardStill());

  return new ImageResponse(
    (
      <div style={{ display: "flex", width: 1200, height: 630, background: "#101010", position: "relative" }}>
        {stillSrc ? (
          <img src={stillSrc} alt="" width={1200} height={630} style={{ position: "absolute", left: 0, top: 0, objectFit: "cover" }} />
        ) : null}
        <div
          style={{
            display: "flex",
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            height: 290,
            backgroundImage: "linear-gradient(to top, rgba(16,16,16,0.92) 0%, rgba(16,16,16,0.55) 45%, rgba(16,16,16,0) 100%)",
          }}
        />
        <div
          style={{
            display: "flex",
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            padding: "28px 40px 32px",
            justifyContent: "space-between",
            alignItems: "flex-end",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <img src={logoSrc} alt="" width={40} height={40} />
            <div style={{ display: "flex", fontSize: 28, fontWeight: 600, color: "#fafafa", letterSpacing: "-0.03em" }}>{copy.title}</div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
            <div style={{ display: "flex", fontSize: 34, fontWeight: 600, color: "#fafafa", letterSpacing: "-0.03em" }}>{copy.subject}</div>
            {copy.stats ? <div style={{ display: "flex", marginTop: 8, fontSize: 22, color: "#d4d4d8" }}>{copy.stats}</div> : null}
          </div>
        </div>
      </div>
    ),
    { width: 1200, height: 630 },
  );
}

function loadCopy() {
  try {
    const live = currentLive();
    const display = settings();
    return buildShareCardCopy({
      title: display.title,
      file: live.filename,
      percent: live.showBar ? live.percent : null,
      nozzleC: live.temps.nozzle.actual,
      bedC: live.temps.bed.actual,
      host: "",
    });
  } catch {
    return fallbackShareCardCopy("");
  }
}
