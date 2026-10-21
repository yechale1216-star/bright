"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  Play,
  Pause,
  RotateCcw,
  RotateCw,
  Volume2,
  VolumeX,
  Maximize2,
  Minimize2,
  ExternalLink,
  Video,
  Subtitles,
  Settings,
  ArrowLeft,
  Check,
  Smartphone,
} from "lucide-react";
import {
  isYouTubeUrl,
  isDirectVideoUrl,
  getYouTubeEmbedUrl,
  getYouTubeWatchUrl,
} from "@/lib/utils/video-utils";
import { NativeBridge } from "@/lib/utils/native-bridge";
import { cn } from "@/lib/utils/utils";

export interface EducationalVideoPlayerProps {
  fileUrl: string;
  title?: string;
  thumbnailUrl?: string;
  subtitleUrl?: string;
  subtitleLang?: string;
  subtitleLabel?: string;
  showSubtitles?: boolean;
  autoPlay?: boolean;
  className?: string;
  showExternalAction?: boolean;
  onFullscreenChange?: (isFullscreen: boolean) => void;
}

const SPEED_OPTIONS = [0.5, 0.75, 1, 1.25, 1.5, 2];

function formatTime(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return "00:00";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) {
    return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  }
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

export function EducationalVideoPlayer({
  fileUrl,
  title,
  thumbnailUrl,
  subtitleUrl,
  subtitleLang = "en",
  subtitleLabel = "English",
  showSubtitles = true,
  autoPlay = false,
  className,
  showExternalAction = true,
  onFullscreenChange,
}: EducationalVideoPlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastTapRef = useRef<{ time: number; x: number }>({ time: 0, x: 0 });

  const [iframeError, setIframeError] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isLandscape, setIsLandscape] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [showControls, setShowControls] = useState(true);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const [captionsActive, setCaptionsActive] = useState(showSubtitles);
  const [doubleTapFeedback, setDoubleTapFeedback] = useState<{
    side: "left" | "right";
    text: string;
  } | null>(null);

  const isYouTube = isYouTubeUrl(fileUrl);
  const isDirect = isDirectVideoUrl(fileUrl);
  const embedUrl = isYouTube ? getYouTubeEmbedUrl(fileUrl, { autoplay: autoPlay }) : null;
  const watchUrl = isYouTube ? getYouTubeWatchUrl(fileUrl) : fileUrl;

  // Track window orientation
  useEffect(() => {
    const checkOrientation = () => {
      if (typeof window !== "undefined") {
        const isLand = window.innerWidth > window.innerHeight;
        setIsLandscape(isLand);
      }
    };
    checkOrientation();
    window.addEventListener("resize", checkOrientation);
    window.addEventListener("orientationchange", checkOrientation);
    return () => {
      window.removeEventListener("resize", checkOrientation);
      window.removeEventListener("orientationchange", checkOrientation);
    };
  }, []);

  // Sync controls auto-hide (like YouTube, hides after 3.5 seconds of inactivity)
  const triggerShowControls = useCallback(() => {
    setShowControls(true);
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    controlsTimeoutRef.current = setTimeout(() => {
      if (isPlaying) {
        setShowControls(false);
        setShowSpeedMenu(false);
      }
    }, 3500);
  }, [isPlaying]);

  useEffect(() => {
    if (!isPlaying) {
      setShowControls(true);
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
    } else {
      triggerShowControls();
    }
  }, [isPlaying, triggerShowControls]);

  // Fullscreen entry & exit logic
  const enterFullscreen = useCallback(async () => {
    setIsFullscreen(true);
    onFullscreenChange?.(true);
    document.body.classList.add("video-fullscreen-active");

    // Lock to landscape orientation
    await NativeBridge.lockLandscape();

    // Browser Fullscreen API request (when permitted)
    try {
      if (containerRef.current && !document.fullscreenElement) {
        if (containerRef.current.requestFullscreen) {
          await containerRef.current.requestFullscreen().catch(() => {});
        } else if ((containerRef.current as any).webkitRequestFullscreen) {
          (containerRef.current as any).webkitRequestFullscreen();
        }
      }
    } catch {
      // Handled by CSS fixed overlay fallback
    }

    // Push history state so Android / Browser Back button exits fullscreen gracefully
    try {
      window.history.pushState({ videoFullscreen: true }, "");
    } catch {}

    triggerShowControls();
  }, [onFullscreenChange, triggerShowControls]);

  const exitFullscreen = useCallback(async (shouldPopHistory = true) => {
    setIsFullscreen(false);
    onFullscreenChange?.(false);
    document.body.classList.remove("video-fullscreen-active");

    // Restore orientation
    await NativeBridge.unlockOrientation();

    // Exit browser native fullscreen if active
    try {
      if (document.fullscreenElement) {
        if (document.exitFullscreen) {
          await document.exitFullscreen().catch(() => {});
        } else if ((document as any).webkitExitFullscreen) {
          (document as any).webkitExitFullscreen();
        }
      }
    } catch {}

    // Pop history if requested and on our fullscreen state
    if (shouldPopHistory && window.history.state?.videoFullscreen) {
      window.history.back();
    }
  }, [onFullscreenChange]);

  const toggleFullscreen = useCallback(() => {
    if (isFullscreen) {
      exitFullscreen();
    } else {
      enterFullscreen();
    }
  }, [isFullscreen, enterFullscreen, exitFullscreen]);

  // Android hardware back button & browser popstate listener
  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      if (isFullscreen) {
        exitFullscreen(false);
      }
    };

    window.addEventListener("popstate", handlePopState);

    // Capacitor native back button listener
    let capBackHandle: any = null;
    if (typeof window !== "undefined") {
      import("@capacitor/app")
        .then(({ App }) => {
          capBackHandle = App.addListener("backButton", ({ canGoBack }) => {
            if (isFullscreen) {
              exitFullscreen(false);
            }
          });
        })
        .catch(() => {});
    }

    return () => {
      window.removeEventListener("popstate", handlePopState);
      if (capBackHandle?.remove) {
        capBackHandle.remove();
      }
    };
  }, [isFullscreen, exitFullscreen]);

  // Document fullscreen change listener (syncs native YouTube fullscreen button clicks)
  useEffect(() => {
    const handleFsChange = () => {
      const isNativeFs = Boolean(
        document.fullscreenElement || (document as any).webkitFullscreenElement
      );
      if (isNativeFs && !isFullscreen) {
        setIsFullscreen(true);
        onFullscreenChange?.(true);
        document.body.classList.add("video-fullscreen-active");
        NativeBridge.lockLandscape();
      } else if (!isNativeFs && isFullscreen) {
        // Native fullscreen was exited via Esc or browser UI
        setIsFullscreen(false);
        onFullscreenChange?.(false);
        document.body.classList.remove("video-fullscreen-active");
        NativeBridge.unlockOrientation();
      }
    };

    document.addEventListener("fullscreenchange", handleFsChange);
    document.addEventListener("webkitfullscreenchange", handleFsChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleFsChange);
      document.removeEventListener("webkitfullscreenchange", handleFsChange);
    };
  }, [isFullscreen, onFullscreenChange]);

  // Keyboard controls (Desktop YouTube shortcuts)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept when user is typing in an input
      if (
        ["INPUT", "TEXTAREA"].includes((e.target as HTMLElement)?.tagName) ||
        (e.target as HTMLElement)?.isContentEditable
      ) {
        return;
      }

      if (e.key === "f" || e.key === "F") {
        e.preventDefault();
        toggleFullscreen();
      } else if (e.key === "Escape" && isFullscreen) {
        e.preventDefault();
        exitFullscreen();
      } else if (isDirect && videoRef.current) {
        if (e.key === " " || e.key === "k" || e.key === "K") {
          e.preventDefault();
          togglePlay();
        } else if (e.key === "ArrowLeft" || e.key === "j" || e.key === "J") {
          e.preventDefault();
          skipTime(-10);
        } else if (e.key === "ArrowRight" || e.key === "l" || e.key === "L") {
          e.preventDefault();
          skipTime(10);
        } else if (e.key === "m" || e.key === "M") {
          e.preventDefault();
          toggleMute();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isFullscreen, toggleFullscreen, exitFullscreen, isDirect]);

  // Direct video event listeners
  const togglePlay = () => {
    if (!videoRef.current) return;
    if (videoRef.current.paused) {
      videoRef.current.play().catch(() => {});
    } else {
      videoRef.current.pause();
    }
  };

  const skipTime = (delta: number) => {
    if (!videoRef.current) return;
    const newTime = Math.min(Math.max(0, videoRef.current.currentTime + delta), duration || 0);
    videoRef.current.currentTime = newTime;
    setCurrentTime(newTime);
    triggerShowControls();
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = parseFloat(e.target.value);
    if (videoRef.current) {
      videoRef.current.currentTime = newTime;
      setCurrentTime(newTime);
    }
    triggerShowControls();
  };

  const toggleMute = () => {
    if (!videoRef.current) return;
    const nextMuted = !isMuted;
    videoRef.current.muted = nextMuted;
    setIsMuted(nextMuted);
    if (!nextMuted && volume === 0) {
      videoRef.current.volume = 0.5;
      setVolume(0.5);
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVol = parseFloat(e.target.value);
    setVolume(newVol);
    if (videoRef.current) {
      videoRef.current.volume = newVol;
      videoRef.current.muted = newVol === 0;
      setIsMuted(newVol === 0);
    }
  };

  const handleSpeedSelect = (rate: number) => {
    setPlaybackSpeed(rate);
    setShowSpeedMenu(false);
    if (videoRef.current) {
      videoRef.current.playbackRate = rate;
    }
    triggerShowControls();
  };

  // YouTube-like double-tap detection for direct video:
  // - Double tap left 40% -> rewind 10s
  // - Double tap right 40% -> forward 10s
  // - Single tap center -> toggle controls
  const handleTouchEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    const touch = e.changedTouches[0];
    if (!touch || !containerRef.current) return;

    const now = Date.now();
    const rect = containerRef.current.getBoundingClientRect();
    const x = touch.clientX - rect.left;
    const width = rect.width;
    const isDoubleTap = now - lastTapRef.current.time < 300 && Math.abs(x - lastTapRef.current.x) < 50;

    lastTapRef.current = { time: now, x };

    if (isDoubleTap) {
      if (x < width * 0.4) {
        skipTime(-10);
        setDoubleTapFeedback({ side: "left", text: "10s ⏪" });
        setTimeout(() => setDoubleTapFeedback(null), 700);
      } else if (x > width * 0.6) {
        skipTime(10);
        setDoubleTapFeedback({ side: "right", text: "⏩ 10s" });
        setTimeout(() => setDoubleTapFeedback(null), 700);
      }
    } else {
      triggerShowControls();
    }
  };

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative transition-all duration-300 select-none",
        isFullscreen
          ? "fixed inset-0 z-[99999] w-screen h-screen bg-black flex items-center justify-center m-0 p-0 overflow-hidden"
          : "w-full space-y-2",
        className
      )}
      onMouseMove={triggerShowControls}
      onClick={triggerShowControls}
      onTouchEnd={handleTouchEnd}
    >
      {/* 
        16:9 Video Canvas — Stays strictly 16:9 at all times (like YouTube),
        occupying max possible landscape viewport without vertical stretching or distortion.
      */}
      <div
        className={cn(
          "relative bg-black flex items-center justify-center overflow-hidden transition-all duration-300",
          isFullscreen
            ? "w-full h-full max-w-full max-h-full aspect-video"
            : "w-full aspect-video max-h-[65vh] rounded-2xl shadow-xl border border-slate-900/60"
        )}
      >
        {/* Double-tap visual feedback indicator */}
        {doubleTapFeedback && (
          <div
            className={cn(
              "absolute top-0 bottom-0 z-40 w-1/3 flex items-center justify-center bg-white/10 backdrop-blur-xs pointer-events-none animate-in fade-in zoom-in duration-200",
              doubleTapFeedback.side === "left" ? "left-0 rounded-r-full" : "right-0 rounded-l-full"
            )}
          >
            <div className="flex flex-col items-center gap-1 text-white font-black text-sm">
              <span className="text-xl">{doubleTapFeedback.text}</span>
              <span className="text-[10px] text-white/80">Double tap</span>
            </div>
          </div>
        )}

        {/* ── CASE 1: YOUTUBE EMBED ────────────────────────────────────────── */}
        {isYouTube && embedUrl && !iframeError ? (
          <>
            <iframe
              src={embedUrl}
              title={title || "YouTube educational video player"}
              className="w-full h-full border-0 absolute inset-0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen"
              allowFullScreen
              loading="lazy"
              onError={() => setIframeError(true)}
            />

            {/* YouTube Fullscreen Helper Overlay (Ensures mobile users get 1-tap Landscape Fullscreen) */}
            <div
              className={cn(
                "absolute transition-opacity duration-300 pointer-events-auto z-30",
                isFullscreen
                  ? "top-4 left-4 flex items-center gap-2 pt-safe"
                  : "top-3 right-3 flex items-center gap-1.5"
              )}
            >
              <button
                type="button"
                onClick={toggleFullscreen}
                aria-label={isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen (Landscape)"}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-full font-bold text-xs backdrop-blur-md shadow-lg transition-transform active:scale-95 border",
                  isFullscreen
                    ? "bg-black/75 hover:bg-black text-white border-white/20"
                    : "bg-slate-900/80 hover:bg-slate-900 text-white border-slate-700/80 hover:border-purple-500"
                )}
                title={isFullscreen ? "Exit Fullscreen (Esc)" : "Expand to Landscape Fullscreen"}
              >
                {isFullscreen ? (
                  <>
                    <Minimize2 className="w-4 h-4 text-purple-400" />
                    <span>Exit Fullscreen</span>
                  </>
                ) : (
                  <>
                    <Maximize2 className="w-3.5 h-3.5 text-purple-400" />
                    <span className="hidden sm:inline">Landscape Fullscreen</span>
                  </>
                )}
              </button>
            </div>
          </>
        ) : isDirect ? (
          /* ── CASE 2: DIRECT HTML5 VIDEO (MP4, WebM) ─────────────────────── */
          <>
            <video
              ref={videoRef}
              src={fileUrl}
              autoPlay={autoPlay}
              playsInline
              webkit-playsinline="true"
              x5-playsinline="true"
              poster={thumbnailUrl}
              className="w-full h-full object-contain cursor-pointer"
              onClick={togglePlay}
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
              onTimeUpdate={() => {
                if (videoRef.current) {
                  setCurrentTime(videoRef.current.currentTime);
                }
              }}
              onLoadedMetadata={() => {
                if (videoRef.current) {
                  setDuration(videoRef.current.duration);
                }
              }}
              onProgress={() => {
                if (videoRef.current && videoRef.current.buffered.length > 0) {
                  const bufferedEnd = videoRef.current.buffered.end(
                    videoRef.current.buffered.length - 1
                  );
                  setBuffered((bufferedEnd / (videoRef.current.duration || 1)) * 100);
                }
              }}
              onEnded={() => {
                setIsPlaying(false);
                setShowControls(true);
              }}
            >
              {subtitleUrl && captionsActive && (
                <track
                  src={subtitleUrl}
                  kind="subtitles"
                  srcLang={subtitleLang}
                  label={subtitleLabel}
                  default
                />
              )}
            </video>

            {/* Center Big Play/Pause/Replay Button Overlay */}
            {(!isPlaying || showControls) && (
              <div
                className="absolute inset-0 flex items-center justify-center pointer-events-none z-20"
                style={{ background: !isPlaying ? "rgba(0,0,0,0.4)" : "transparent" }}
              >
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    togglePlay();
                  }}
                  className="pointer-events-auto w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-purple-600/90 hover:bg-purple-600 text-white flex items-center justify-center shadow-2xl transition-all duration-200 transform hover:scale-110 active:scale-95 border-2 border-white/20"
                  aria-label={isPlaying ? "Pause Video" : "Play Video"}
                >
                  {isPlaying ? (
                    <Pause className="w-6 h-6 sm:w-7 sm:h-7 fill-current" />
                  ) : (
                    <Play className="w-6 h-6 sm:w-7 sm:h-7 fill-current ml-1" />
                  )}
                </button>
              </div>
            )}

            {/* Custom YouTube-style Control Bar Overlay */}
            <div
              className={cn(
                "absolute inset-0 z-30 flex flex-col justify-between p-3 sm:p-4 bg-gradient-to-t from-black/85 via-transparent to-black/60 transition-opacity duration-300 pointer-events-none",
                showControls ? "opacity-100" : "opacity-0"
              )}
            >
              {/* Top Bar: Title & Exit Fullscreen Button */}
              <div className="flex items-center justify-between gap-3 pointer-events-auto pt-safe">
                <div className="flex items-center gap-2 min-w-0">
                  {isFullscreen && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        exitFullscreen();
                      }}
                      className="p-2 rounded-full bg-black/60 hover:bg-black text-white hover:text-purple-400 border border-white/10 transition-colors"
                      title="Exit Fullscreen (Esc)"
                    >
                      <ArrowLeft className="w-5 h-5" />
                    </button>
                  )}
                  {title && (
                    <h3 className="text-white font-bold text-xs sm:text-sm truncate drop-shadow-md">
                      {title}
                    </h3>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {/* Fullscreen Button in Normal mode */}
                  {!isFullscreen && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleFullscreen();
                      }}
                      className="p-1.5 rounded-lg bg-black/60 hover:bg-black text-white hover:text-purple-400 border border-white/10 transition-all text-xs font-semibold flex items-center gap-1"
                      title="Landscape Fullscreen"
                    >
                      <Maximize2 className="w-4 h-4" />
                      <span className="hidden sm:inline">Fullscreen</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Bottom Bar: Scrubber & Controls */}
              <div className="space-y-2 pointer-events-auto pb-safe">
                {/* Progress Scrubber */}
                <div className="relative flex items-center group cursor-pointer">
                  {/* Buffered track */}
                  <div
                    className="absolute h-1 bg-white/30 rounded-full pointer-events-none"
                    style={{ width: `${buffered}%` }}
                  />
                  <input
                    type="range"
                    min={0}
                    max={duration || 100}
                    step={0.1}
                    value={currentTime}
                    onChange={handleSeek}
                    className="w-full h-1 bg-white/20 rounded-full appearance-none cursor-pointer accent-purple-500 group-hover:h-2 transition-all focus:outline-hidden"
                    aria-label="Seek video position"
                  />
                </div>

                {/* Control Action Buttons */}
                <div className="flex items-center justify-between text-white text-xs sm:text-sm">
                  <div className="flex items-center gap-2 sm:gap-3">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        togglePlay();
                      }}
                      className="hover:text-purple-400 transition-colors p-1"
                      title={isPlaying ? "Pause (k)" : "Play (k)"}
                    >
                      {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 fill-current" />}
                    </button>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        skipTime(-10);
                      }}
                      className="hover:text-purple-400 transition-colors p-1"
                      title="Rewind 10 seconds (j)"
                    >
                      <RotateCcw className="w-4 h-4" />
                    </button>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        skipTime(10);
                      }}
                      className="hover:text-purple-400 transition-colors p-1"
                      title="Forward 10 seconds (l)"
                    >
                      <RotateCw className="w-4 h-4" />
                    </button>

                    {/* Volume */}
                    <div className="hidden sm:flex items-center gap-1.5 group/vol">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleMute();
                        }}
                        className="hover:text-purple-400 transition-colors p-1"
                        title={isMuted ? "Unmute (m)" : "Mute (m)"}
                      >
                        {isMuted || volume === 0 ? (
                          <VolumeX className="w-4 h-4 text-red-400" />
                        ) : (
                          <Volume2 className="w-4 h-4" />
                        )}
                      </button>
                      <input
                        type="range"
                        min={0}
                        max={1}
                        step={0.05}
                        value={isMuted ? 0 : volume}
                        onChange={handleVolumeChange}
                        className="w-16 h-1 bg-white/30 rounded-full appearance-none cursor-pointer accent-purple-500"
                        aria-label="Volume slider"
                      />
                    </div>

                    {/* Time display */}
                    <span className="font-mono text-[11px] sm:text-xs text-slate-300">
                      {formatTime(currentTime)} / {formatTime(duration)}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 sm:gap-3 relative">
                    {/* Captions Toggle */}
                    {subtitleUrl && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setCaptionsActive((v) => !v);
                        }}
                        className={cn(
                          "px-2 py-0.5 rounded-md font-bold text-[10px] sm:text-xs transition-colors border",
                          captionsActive
                            ? "bg-purple-600 text-white border-purple-400"
                            : "bg-white/10 text-white/70 border-white/20 hover:text-white"
                        )}
                        title="Toggle Subtitles"
                      >
                        CC
                      </button>
                    )}

                    {/* Speed Selector */}
                    <div className="relative">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowSpeedMenu((v) => !v);
                        }}
                        className="flex items-center gap-1 px-2 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white text-[11px] font-bold transition-colors"
                        title="Playback Speed"
                      >
                        <Settings className="w-3.5 h-3.5" />
                        <span>{playbackSpeed}x</span>
                      </button>

                      {showSpeedMenu && (
                        <div
                          className="absolute bottom-full right-0 mb-2 w-32 bg-slate-900/95 border border-slate-700 rounded-xl shadow-2xl p-1 z-50 backdrop-blur-md"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <p className="text-[10px] font-bold text-slate-400 px-2 py-1 uppercase tracking-wider">
                            Speed
                          </p>
                          {SPEED_OPTIONS.map((rate) => (
                            <button
                              key={rate}
                              type="button"
                              onClick={() => handleSpeedSelect(rate)}
                              className={cn(
                                "w-full text-left px-2 py-1.5 rounded-lg text-xs font-bold flex items-center justify-between transition-colors",
                                playbackSpeed === rate
                                  ? "bg-purple-600 text-white"
                                  : "text-slate-200 hover:bg-white/10"
                              )}
                            >
                              <span>{rate === 1 ? "Normal (1x)" : `${rate}x`}</span>
                              {playbackSpeed === rate && <Check className="w-3.5 h-3.5" />}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Fullscreen Button */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleFullscreen();
                      }}
                      className="p-1.5 hover:text-purple-400 transition-colors"
                      title={isFullscreen ? "Exit Fullscreen (f)" : "Enter Fullscreen (f)"}
                    >
                      {isFullscreen ? (
                        <Minimize2 className="w-5 h-5" />
                      ) : (
                        <Maximize2 className="w-5 h-5" />
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </>
        ) : (
          /* ── CASE 3: FALLBACK WHEN VIDEO CANNOT BE EMBEDDED ─────────────── */
          <div className="p-6 text-center text-white space-y-3 max-w-md mx-auto">
            <div className="w-12 h-12 rounded-2xl bg-purple-600/30 text-purple-400 flex items-center justify-center mx-auto border border-purple-500/40">
              <Video className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h4 className="font-bold text-sm text-slate-100">
                {title || "External Educational Video"}
              </h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                {isYouTube
                  ? "This video could not be embedded directly or owner disabled third-party embedding."
                  : "This video format cannot be played directly inline."}
              </p>
            </div>
            {watchUrl && (
              <a
                href={watchUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold shadow-xs transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                {isYouTube ? "Open on YouTube" : "Open Video Link"}
              </a>
            )}
          </div>
        )}

        {/* 
          Rotate Phone Helper Badge:
          Appears only when user is in fullscreen mode on a mobile device held in portrait.
          Provides a gentle, YouTube-like invitation to turn the phone into landscape.
        */}
        {isFullscreen && !isLandscape && (
          <div className="absolute bottom-16 sm:bottom-20 z-50 left-1/2 -translate-x-1/2 bg-slate-900/90 text-white px-3.5 py-2 rounded-full border border-purple-500/40 shadow-2xl flex items-center gap-2 backdrop-blur-md animate-bounce pointer-events-auto">
            <Smartphone className="w-4 h-4 text-purple-400 animate-pulse" />
            <span className="text-xs font-bold">Rotate phone for landscape viewing</span>
            <button
              type="button"
              onClick={async (e) => {
                e.stopPropagation();
                await NativeBridge.lockLandscape();
              }}
              className="ml-1 px-2 py-0.5 rounded-full bg-purple-600 hover:bg-purple-700 text-[10px] font-black uppercase text-white shadow-xs"
            >
              Rotate
            </button>
          </div>
        )}
      </div>

      {/* External Action link below the player (only in normal view) */}
      {!isFullscreen && showExternalAction && watchUrl && isYouTube && (
        <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 px-1 pt-1">
          <span className="flex items-center gap-1 text-[11px]">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            Educational Video Mode
          </span>
          <a
            href={watchUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-[11px] font-bold text-purple-600 dark:text-purple-400 hover:underline"
          >
            <ExternalLink className="w-3 h-3" />
            Watch directly on YouTube
          </a>
        </div>
      )}
    </div>
  );
}
