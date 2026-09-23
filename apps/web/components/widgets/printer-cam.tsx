"use client";

import Hls from "hls.js";
import { useEffect, useRef, useState } from "react";
import { COVER_FADE_MS, COVER_MIN_MS, coverShouldHide } from "../../lib/cam-cover";

const RETRY_MS = 2000;
const CLOCK_MS = 250;

export function PrinterCam({ url }: { url: string | null }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [fatal, setFatal] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [hasFrame, setHasFrame] = useState(false);
  const [shownAtMs, setShownAtMs] = useState<number | null>(() => Date.now());
  const [nowMs, setNowMs] = useState(() => Date.now());
  const playlist = url?.trim() || "";
  const hide = coverShouldHide({ fatal, playing, shownAtMs, nowMs });
  const showCover = !hide;

  useEffect(() => {
    if (!hide || shownAtMs === null) {
      return;
    }
    const timer = window.setTimeout(() => {
      setShownAtMs(null);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [hide, shownAtMs]);

  useEffect(() => {
    if (!showCover) {
      return;
    }
    const timer = window.setInterval(() => {
      setNowMs(Date.now());
    }, CLOCK_MS);
    return () => window.clearInterval(timer);
  }, [showCover]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !playlist) return;

    let cancelled = false;
    let hls: Hls | null = null;
    let retry: number | null = null;
    let nativeOnError: (() => void) | null = null;
    let resettingNative = false;

    setPlaying(false);
    setHasFrame(false);
    setShownAtMs(Date.now());
    setFatal(false);

    const scheduleRetry = (fn: () => void) => {
      if (retry !== null) window.clearTimeout(retry);
      retry = window.setTimeout(() => {
        retry = null;
        if (!cancelled) fn();
      }, RETRY_MS);
    };

    const snapshot = () => {
      const canvas = canvasRef.current;
      if (!canvas || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
        return;
      }
      const width = video.videoWidth || 1280;
      const height = video.videoHeight || 720;
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      try {
        ctx.drawImage(video, 0, 0, width, height);
        setHasFrame(true);
      } catch {
        // Cross-origin native HLS can taint the canvas.
      }
    };

    const markBuffering = () => {
      const ok = video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA && !video.paused;
      setPlaying(ok);
      if (!ok) {
        setShownAtMs((prev) => prev ?? Date.now());
      }
    };

    const onPlaying = () => {
      setPlaying(true);
      setFatal(false);
      snapshot();
    };

    const fail = () => {
      if (!cancelled) {
        setFatal(true);
        setPlaying(false);
        setShownAtMs((prev) => prev ?? Date.now());
      }
    };

    const attach = () => {
      if (cancelled) return;
      hls?.destroy();
      hls = null;
      if (Hls.isSupported()) {
        hls = new Hls({ enableWorker: false, backBufferLength: 30 });
        hls.attachMedia(video);
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          void video.play().catch(() => undefined);
        });
        hls.on(Hls.Events.ERROR, (_event, data) => {
          if (data.fatal) {
            hls?.destroy();
            hls = null;
            fail();
            scheduleRetry(attach);
          }
        });
        hls.loadSource(playlist);
        return;
      }
      if (video.canPlayType("application/vnd.apple.mpegurl")) {
        if (!nativeOnError) {
          nativeOnError = () => {
            if (cancelled || resettingNative) return;
            fail();
            scheduleRetry(() => {
              if (cancelled || !nativeOnError) return;
              resettingNative = true;
              video.removeEventListener("error", nativeOnError);
              video.removeAttribute("src");
              video.load();
              video.addEventListener("error", nativeOnError);
              resettingNative = false;
              video.src = playlist;
              void video.play().catch(() => undefined);
            });
          };
          video.addEventListener("error", nativeOnError);
        }
        video.src = playlist;
        void video.play().catch(() => undefined);
      }
    };

    video.addEventListener("playing", onPlaying);
    video.addEventListener("pause", markBuffering);
    video.addEventListener("waiting", markBuffering);
    video.addEventListener("stalled", markBuffering);
    video.addEventListener("timeupdate", snapshot);
    attach();
    void video.play().catch(() => undefined);

    return () => {
      cancelled = true;
      if (retry !== null) window.clearTimeout(retry);
      video.removeEventListener("playing", onPlaying);
      video.removeEventListener("pause", markBuffering);
      video.removeEventListener("waiting", markBuffering);
      video.removeEventListener("stalled", markBuffering);
      video.removeEventListener("timeupdate", snapshot);
      if (nativeOnError) video.removeEventListener("error", nativeOnError);
      hls?.destroy();
      video.removeAttribute("src");
      video.load();
    };
  }, [playlist]);

  if (!playlist) {
    return (
      <div className="finder">
        <span>Stream not set</span>
      </div>
    );
  }

  return (
    <div className="finder">
      <video ref={videoRef} autoPlay muted playsInline title="Printer camera" />
      <canvas
        ref={canvasRef}
        className="cam-cover-frame"
        style={{
          opacity: showCover && hasFrame ? 1 : 0,
          transitionDuration: `${COVER_FADE_MS}ms`,
        }}
        aria-hidden="true"
      />
      <div
        className="cam-cover-scrim"
        style={{
          opacity: showCover && !hasFrame ? 1 : 0,
          transitionDuration: `${COVER_FADE_MS}ms`,
        }}
        aria-hidden="true"
      />
      <div
        className="cam-cover-banner"
        data-cover-min={COVER_MIN_MS}
        style={{
          opacity: showCover ? 1 : 0,
          transitionDuration: `${COVER_FADE_MS}ms`,
        }}
        aria-hidden={!showCover}
      >
        <div className="cam-cover-brand">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/mark.svg" alt="" width={40} height={40} />
          <span>PrintCast</span>
        </div>
        <p className="cam-cover-breathe">Reconnecting…</p>
      </div>
    </div>
  );
}
