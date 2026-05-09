"use client";

import {
  ConfigurableVideoPlayer,
  PlayerConfigProvider,
  PlayerPresets,
  cn,
  mergePlayerConfig,
} from "@madraka/nextjs-videoplayer";
import type { PlayerConfiguration, VideoPlayerState } from "@madraka/nextjs-videoplayer";
import { useCallback, useEffect, useRef, useState } from "react";

/** After this idle period while playing, chrome fades out (YouTube-style). */
const CHROME_HIDE_MS = 3000;

/** StreamVault — dark chrome, red accent, analytics off */
const streamVaultConfig: PlayerConfiguration = mergePlayerConfig(PlayerPresets.default, {
  theme: {
    primary: "#e50914",
    accent: "#f40612",
    background: "#000000",
    text: "#f5f5f5",
    controlsBackground: "rgba(10, 10, 10, 0.9)",
    progressColor: "#e50914",
    bufferColor: "rgba(255, 255, 255, 0.18)",
  },
  controls: {
    show: true,
    position: "bottom",
    size: "medium",
    visibility: {
      playPause: true,
      progress: true,
      volume: true,
      fullscreen: true,
      pictureInPicture: true,
      playbackRate: true,
      settings: true,
      time: true,
      keyboardShortcuts: true,
      quality: false,
      theaterMode: false,
    },
  },
  auto: {
    autoHideControls: true,
    autoHideDelay: CHROME_HIDE_MS,
  },
  gestures: {
    enabled: true,
    tapToPlay: true,
    doubleTapSeek: true,
  },
  keyboard: { enabled: true },
  analytics: {
    enabled: false,
    trackPlay: false,
    trackPause: false,
    trackSeek: false,
    trackQualityChange: false,
    trackFullscreen: false,
    trackPictureInPicture: false,
  },
  features: {
    thumbnailPreview: false,
    chapters: false,
    miniPlayer: false,
    playlist: false,
    airPlay: false,
    chromecast: false,
    subtitles: true,
  },
});

function controlSignature(s: VideoPlayerState) {
  return [
    s.isPlaying,
    s.isPaused,
    s.isLoading,
    s.isMuted,
    Math.round(s.volume * 100),
    s.isFullscreen,
    s.isPictureInPicture,
    s.isTheaterMode,
    s.error ?? "",
  ].join("|");
}

type Props = {
  src: string;
  poster?: string;
  fallbackSources?: string[];
  /** Start playback when the player loads (e.g. after navigating from Play). */
  autoPlay?: boolean;
  onPlaybackError?: (message?: string) => void;
  onPlay?: () => void;
  onPause?: () => void;
  onTimeUpdate?: (currentTime: number, duration: number) => void;
  className?: string;
};

/**
 * `@madraka/nextjs-videoplayer` with StreamVault theming.
 * Chrome fades out while playing after idle; pointer movement wakes it (YouTube-like).
 * (`ConfigurableVideoPlayer` does not wire `autoHideControls`; we implement fade via CSS + state.)
 */
export function WatchVideoPlayer({
  src,
  poster,
  fallbackSources,
  autoPlay = false,
  onPlaybackError,
  onPlay,
  onPause,
  onTimeUpdate,
  className,
}: Props) {
  const [chromeHidden, setChromeHidden] = useState(false);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const playingRef = useRef(false);
  const lastControlSigRef = useRef("");

  const clearHideTimer = useCallback(() => {
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
  }, []);

  const scheduleHideWhilePlaying = useCallback(() => {
    clearHideTimer();
    hideTimerRef.current = setTimeout(() => {
      if (playingRef.current) setChromeHidden(true);
    }, CHROME_HIDE_MS);
  }, [clearHideTimer]);

  const wakeChrome = useCallback(() => {
    setChromeHidden(false);
    if (playingRef.current) scheduleHideWhilePlaying();
    else clearHideTimer();
  }, [clearHideTimer, scheduleHideWhilePlaying]);

  const onStateChange = useCallback(
    (s: VideoPlayerState) => {
      const sig = controlSignature(s);
      if (sig === lastControlSigRef.current) return;
      lastControlSigRef.current = sig;

      playingRef.current = Boolean(s.isPlaying && !s.isPaused);

      if (s.isLoading) {
        setChromeHidden(false);
        clearHideTimer();
        return;
      }

      setChromeHidden(false);
      if (playingRef.current) scheduleHideWhilePlaying();
      else clearHideTimer();
    },
    [clearHideTimer, scheduleHideWhilePlaying]
  );

  useEffect(() => () => clearHideTimer(), [clearHideTimer]);

  return (
    <PlayerConfigProvider defaultConfig={streamVaultConfig} storageKey="streamvault-player-config">
      <div
        data-chrome-hidden={chromeHidden ? "true" : undefined}
        className={cn(
          "sv-player-stage relative isolate z-10 overflow-hidden rounded-2xl bg-black",
          "shadow-[0_16px_56px_rgba(0,0,0,0.72)] ring-1 ring-white/[0.1]",
          className
        )}
        onPointerMove={wakeChrome}
        onPointerDown={wakeChrome}
        onTouchStart={wakeChrome}
        onMouseLeave={() => {
          if (playingRef.current) setChromeHidden(true);
        }}
      >
        <div className="from-[#e50914]/[0.07] pointer-events-none absolute inset-0 z-0 bg-gradient-to-t via-transparent to-transparent" />
        <ConfigurableVideoPlayer
          src={src}
          poster={poster}
          fallbackSources={fallbackSources}
          autoPlay={autoPlay}
          aspectRatio="16/9"
          playsInline
          className={cn("relative z-[1] rounded-2xl [&_video]:bg-black")}
          onError={(err) => onPlaybackError?.(err)}
          onPlay={onPlay}
          onPause={onPause}
          onTimeUpdate={onTimeUpdate}
          onStateChange={onStateChange}
        />
      </div>
    </PlayerConfigProvider>
  );
}
