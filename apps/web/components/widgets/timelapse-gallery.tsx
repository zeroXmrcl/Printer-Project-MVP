import type { MediaRow } from "@printcast/db";

export function TimelapseGallery({ items }: { items: MediaRow[] }) {
  if (items.length === 0) return null;
  return (
    <div className="frames">
      {items.map((item) => (
        <figure key={item.id}>
          {item.kind === "timelapse" ? (
            <video src={`/api/media/${item.rel_path}`} controls />
          ) : (
            <img src={`/api/media/${item.rel_path}`} alt="" width={320} height={180} loading="lazy" />
          )}
          <figcaption>
            {item.kind === "timelapse"
              ? "Timelapse"
              : new Date(item.at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hourCycle: "h23" })}
          </figcaption>
        </figure>
      ))}
    </div>
  );
}
