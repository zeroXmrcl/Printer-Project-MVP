"use client";

import Hls from "hls.js";
import { useEffect, useRef, useState } from "react";
import { COVER_FADE_MS, COVER_MIN_MS, coverShouldHide } from "../../lib/cam-cover";

const RETRY_MS = 2000;
const STALL_MS = 2500;
const CLOCK_MS = 250;
const LIVE_LAG_S = 4;
const LIVE_JUMP_S = 12;

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
    let stall: number | null = null;
    let stalls = 0;
    let nativeOnError: (() => void) | null = null;
    let resettingNative = false;
    let catching = false;

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

    const clearStall = () => {
      if (stall !== null) window.clearTimeout(stall);
      stall = null;
      stalls = 0;
    };

    const armStall = () => {
      if (stall !== null) return;
      stall = window.setTimeout(() => {
        stall = null;
        if (cancelled) return;
        const moving = !video.paused && video.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA;
        if (moving) {
          stalls = 0;
          return;
        }
        stalls += 1;
        if (stalls >= 3) {
          stalls = 0;
          attach();
          return;
        }
        void video.play().catch(() => undefined);
        if (hls && stalls === 1) hls.recoverMediaError();
        else catchLive();
        armStall();
      }, STALL_MS);
    };

    const markBuffering = () => {
      const ok = video.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA && !video.paused;
      setPlaying(ok);
      if (!ok) {
        setShownAtMs((prev) => prev ?? Date.now());
        armStall();
      }
    };

    const onPlaying = () => {
      clearStall();
      setPlaying(true);
      setFatal(false);
      snapshot();
    };

    const catchLive = () => {
      if (cancelled || catching || !video.buffered.length) return;
      const edge = hls?.levels?.[hls.currentLevel]?.details?.edge ?? hls?.levels?.[0]?.details?.edge;
      const index = video.buffered.length - 1;
      const end = video.buffered.end(index);
      const start = video.buffered.start(index);
      if (edge === undefined || Math.abs(end - edge) > 2) return;
      if (end - video.currentTime <= LIVE_JUMP_S) return;
      catching = true;
      const done = () => {
        video.removeEventListener("seeked", done);
        catching = false;
      };
      video.addEventListener("seeked", done);
      video.currentTime = Math.max(start, end - LIVE_LAG_S);
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
        hls = new Hls({
          enableWorker: false,
          backBufferLength: 10,
          maxBufferLength: 90,
          liveDurationInfinity: true,
          startPosition: -1,
        });
        hls.attachMedia(video);
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          void video.play().catch(() => undefined);
        });
        hls.on(Hls.Events.LEVEL_UPDATED, () => {
          catchLive();
        });
        hls.on(Hls.Events.FRAG_BUFFERED, () => {
          catchLive();
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
    video.addEventListener("progress", catchLive);
    video.addEventListener("timeupdate", snapshot);
    attach();
    void video.play().catch(() => undefined);

    return () => {
      cancelled = true;
      if (retry !== null) window.clearTimeout(retry);
      if (stall !== null) window.clearTimeout(stall);
      video.removeEventListener("playing", onPlaying);
      video.removeEventListener("pause", markBuffering);
      video.removeEventListener("waiting", markBuffering);
      video.removeEventListener("stalled", markBuffering);
      video.removeEventListener("progress", catchLive);
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
