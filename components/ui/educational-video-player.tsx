"use client";

import React, { useState } from "react";
import {
  Play,
  ExternalLink,
  AlertCircle,
  Video,
} from "lucide-react";
import {
  isYouTubeUrl,
  isDirectVideoUrl,
  getYouTubeEmbedUrl,
  getYouTubeWatchUrl,
} from "@/lib/utils/video-utils";
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
}: EducationalVideoPlayerProps) {
  const [iframeError, setIframeError] = useState(false);

  const isYouTube = isYouTubeUrl(fileUrl);
  const isDirect = isDirectVideoUrl(fileUrl);
  const embedUrl = isYouTube ? getYouTubeEmbedUrl(fileUrl, { autoplay: autoPlay }) : null;
  const watchUrl = isYouTube ? getYouTubeWatchUrl(fileUrl) : fileUrl;

  return (
    <div className={cn("w-full space-y-2", className)}>
      {/* 16:9 Responsive Video Box */}
      <div className="w-full bg-black relative aspect-video max-h-[65vh] flex items-center justify-center overflow-hidden rounded-2xl shadow-md border border-slate-900/60">
        {isYouTube && embedUrl && !iframeError ? (
          <iframe
            src={embedUrl}
            title={title || "YouTube educational video player"}
            className="w-full h-full border-0 absolute inset-0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
            loading="lazy"
            onError={() => setIframeError(true)}
          />
        ) : isDirect ? (
          <video
            controls
            autoPlay={autoPlay}
            playsInline
            className="w-full h-full object-contain"
            poster={thumbnailUrl}
          >
            <source src={fileUrl} />
            {subtitleUrl && showSubtitles && (
              <track
                src={subtitleUrl}
                kind="subtitles"
                srcLang={subtitleLang}
                label={subtitleLabel}
                default
              />
            )}
            Your browser does not support HTML5 video playback.
          </video>
        ) : (
          /* Fallback when video cannot be embedded or link is invalid */
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
                  : "This video link cannot be played inline in the embedded player."}
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
      </div>
    </div>
  );
}
