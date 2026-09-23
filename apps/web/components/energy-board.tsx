"use client";

import { useEffect, useState } from "react";
import type { BoardSnapshot } from "../lib/store";
import { TelemetrySpark } from "./widgets/telemetry-spark";
import { TimelapseGallery } from "./widgets/timelapse-gallery";

export function EnergyBoard({ initial }: { initial: BoardSnapshot }) {
  const [board, setBoard] = useState(initial);
  const live = board.live;

  useEffect(() => {
    const source = new EventSource("/api/live");
    const onLive = (event: Event) => {
      const data = (event as MessageEvent).data;
      if (!data || data === "null") return;
      setBoard(JSON.parse(data) as BoardSnapshot);
    };
    source.addEventListener("live", onLive);
    return () => source.close();
  }, []);

  return (
    <>
      <section className="widget pad">
        <div className="kicker">Estimate</div>
        <p className="watt">{live.energy.watts === null ? "—" : `${live.energy.watts} W`}</p>
        {board.kwh !== null ? <div className="muted">{(board.kwh / 1000).toFixed(2)} kWh so far</div> : null}
        <TelemetrySpark samples={board.curve} />
      </section>
      <section className="widget pad">
        <div className="kicker">Frames</div>
        {board.frames.length === 0 ? (
          <p className="muted">No frames for the current job yet.</p>
        ) : (
          <TimelapseGallery
            items={board.frames.map((frame) => ({
              id: frame.id,
              kind: frame.kind,
              rel_path: frame.path,
              at: frame.at,
              job_id: "",
            }))}
          />
        )}
      </section>
    </>
  );
}
