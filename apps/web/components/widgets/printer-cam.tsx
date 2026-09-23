"use client";

import { useEffect, useRef } from "react";

export function PrinterCam({ url }: { url: string | null }) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !url) return;
    let cancelled = false;
    let hls: { destroy: () => void } | null = null;
    if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = url;
      return;
    }
    void import("hls.js").then(({ default: Hls }) => {
      if (cancelled || !Hls.isSupported()) return;
      const player = new Hls({ enableWorker: true });
      player.loadSource(url);
      player.attachMedia(video);
      hls = player;
    });
    return () => {
      cancelled = true;
      hls?.destroy();
    };
  }, [url]);

  return (
    <div className="finder">
      {url ? <video ref={videoRef} autoPlay muted playsInline controls /> : <span>Stream not set</span>}
    </div>
  );
}
