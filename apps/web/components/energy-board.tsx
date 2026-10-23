"use client";

import { useEffect, useState } from "react";
import type { BoardSnapshot } from "../lib/store";
import { TelemetrySpark } from "./widgets/telemetry-spark";

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
      <section className="panel pad">
        <div className="kicker">Live draw</div>
        <p className="watt">{live.energy.watts === null ? "-" : `${live.energy.watts} W`}</p>
        {board.kwh !== null ? <div className="muted">{(board.kwh / 1000).toFixed(2)} kWh so far</div> : null}
        <TelemetrySpark samples={board.curve} />
      </section>
    </>
  );
}
