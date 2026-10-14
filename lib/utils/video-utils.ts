/**
 * Bright Path Video & YouTube Utilities
 * 
 * Provides robust URL parsing, validation, and embed generation for educational video materials.
 * Supports:
 * - Standard desktop watch URLs: https://www.youtube.com/watch?v=VIDEO_ID
 * - URLs with arbitrary query parameters: https://www.youtube.com/watch?feature=shared&v=VIDEO_ID&t=42s
 * - Shortened youtu.be URLs: https://youtu.be/VIDEO_ID
 * - YouTube Shorts: https://www.youtube.com/shorts/VIDEO_ID
 * - YouTube Live streams: https://www.youtube.com/live/VIDEO_ID
 * - Existing embed URLs: https://www.youtube.com/embed/VIDEO_ID
 * - Mobile / Music / No-cookie domains: m.youtube.com, music.youtube.com, youtube-nocookie.com
 * - Direct video files: MP4, WebM, MOV, data:video
 */

/**
 * Strict YouTube Video ID validator.
 * YouTube video IDs are strictly 11 characters containing alphanumeric characters, dashes, and underscores.
 */
const YOUTUBE_ID_REGEX = /^[a-zA-Z0-9_-]{11}$/;

/**
 * Parses a YouTube video ID from various YouTube URL formats or a raw 11-char ID.
 * Returns null if the URL is not a valid YouTube video.
 * Prevents arbitrary domain injection or unrestricted iframe security vulnerabilities.
 */
export function parseYouTubeVideoId(input?: string | null): string | null {
  if (!input || typeof input !== "string") return null;
  const raw = input.trim();
  if (!raw) return null;

  // 1. If the input is already a raw 11-character video ID
  if (YOUTUBE_ID_REGEX.test(raw)) {
    return raw;
  }

  try {
    const parsed = new URL(
      raw.startsWith("http://") || raw.startsWith("https://") ? raw : `https://${raw}`
    );
    const host = parsed.hostname.toLowerCase();

    // Verify it is a legitimate YouTube hostname
    const isYtHost =
      host === "youtu.be" ||
      host.endsWith(".youtu.be") ||
      host === "youtube.com" ||
      host.endsWith(".youtube.com") ||
      host === "youtube-nocookie.com" ||
      host.endsWith(".youtube-nocookie.com");

    if (isYtHost) {
      // Format A: youtu.be/<id>
      if (host === "youtu.be" || host.endsWith(".youtu.be")) {
        const id = parsed.pathname.slice(1).split("/")[0]?.split("?")[0];
        if (id && YOUTUBE_ID_REGEX.test(id)) {
          return id;
        }
      }

      // Format B: youtube.com/watch?v=<id> (regardless of query param order)
      const vParam = parsed.searchParams.get("v");
      if (vParam && YOUTUBE_ID_REGEX.test(vParam)) {
        return vParam;
      }

      // Format C: /embed/<id>, /shorts/<id>, /live/<id>, /v/<id>, /e/<id>
      const segments = parsed.pathname.split("/").filter(Boolean);
      const prefix = segments[0]?.toLowerCase();
      if (["embed", "shorts", "live", "v", "e"].includes(prefix)) {
        const id = segments[1]?.split("?")[0];
        if (id && YOUTUBE_ID_REGEX.test(id)) {
          return id;
        }
      }
    }
  } catch {
    // If URL parsing fails, proceed to fallback regex
  }

  // Robust fallback regex for non-standard strings, encoded chars, or share links
  const regexMatch = raw.match(
    /(?:youtu\.be\/|youtube(?:-nocookie)?\.com\/(?:embed\/|v\/|shorts\/|live\/|e\/|watch\?(?:.*&)?v=))([a-zA-Z0-9_-]{11})/i
  );
  if (regexMatch && regexMatch[1] && YOUTUBE_ID_REGEX.test(regexMatch[1])) {
    return regexMatch[1];
  }

  return null;
}

/**
 * Parses start time (in seconds) from YouTube URL parameters (e.g., t=90, t=1m30s, start=90).
 */
export function parseYouTubeStartTime(input?: string | null): number | undefined {
  if (!input || typeof input !== "string") return undefined;
  try {
    const raw = input.trim();
    const url = new URL(
      raw.startsWith("http://") || raw.startsWith("https://") ? raw : `https://${raw}`
    );
    const t = url.searchParams.get("t") || url.searchParams.get("start");
    if (!t) return undefined;

    // Pure seconds format: e.g. "90" or "90s"
    if (/^\d+s?$/i.test(t)) {
      const secs = parseInt(t, 10);
      return !isNaN(secs) && secs > 0 ? secs : undefined;
    }

    // Compound time format: e.g. "1h2m3s", "2m30s"
    let totalSeconds = 0;
    const hours = t.match(/(\d+)h/i);
    const mins = t.match(/(\d+)m/i);
    const secs = t.match(/(\d+)s/i);

    if (hours) totalSeconds += parseInt(hours[1], 10) * 3600;
    if (mins) totalSeconds += parseInt(mins[1], 10) * 60;
    if (secs) totalSeconds += parseInt(secs[1], 10);

    return totalSeconds > 0 ? totalSeconds : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Checks whether the given string is a valid YouTube video link.
 */
export function isYouTubeUrl(input?: string | null): boolean {
  return parseYouTubeVideoId(input) !== null;
}

/**
 * Checks whether the given string points to a direct playable HTML5 video source.
 */
export function isDirectVideoUrl(input?: string | null): boolean {
  if (!input || typeof input !== "string") return false;
  const lower = input.trim().toLowerCase();
  return (
    lower.startsWith("data:video/") ||
    lower.endsWith(".mp4") ||
    lower.endsWith(".webm") ||
    lower.endsWith(".mov") ||
    lower.endsWith(".mkv") ||
    lower.endsWith(".m4v") ||
    lower.endsWith(".ogv") ||
    lower.includes(".mp4?") ||
    lower.includes(".webm?")
  );
}

/**
 * Converts any valid YouTube URL into a secure, standard embed URL:
 * https://www.youtube.com/embed/VIDEO_ID
 * 
 * Includes student-friendly parameters:
 * - rel=0 (avoids recommending external random videos after playback)
 * - modestbranding=1
 * - playsinline=1 (critical for Android / mobile WebView playback)
 * - enablejsapi=1
 */
export function getYouTubeEmbedUrl(
  input?: string | null,
  options?: {
    autoplay?: boolean;
    start?: number;
  }
): string | null {
  const videoId = parseYouTubeVideoId(input);
  if (!videoId) return null;

  const start = options?.start ?? parseYouTubeStartTime(input);

  const params = new URLSearchParams();
  params.set("rel", "0");
  params.set("modestbranding", "1");
  params.set("playsinline", "1");
  params.set("enablejsapi", "1");

  if (options?.autoplay) {
    params.set("autoplay", "1");
  }

  if (typeof start === "number" && start > 0) {
    params.set("start", start.toString());
  }

  return `https://www.youtube.com/embed/${videoId}?${params.toString()}`;
}

/**
 * Generates the official YouTube watch URL for opening directly in the YouTube app or browser.
 */
export function getYouTubeWatchUrl(input?: string | null): string {
  const videoId = parseYouTubeVideoId(input);
  if (!videoId) return input || "";

  const start = parseYouTubeStartTime(input);
  if (typeof start === "number" && start > 0) {
    return `https://www.youtube.com/watch?v=${videoId}&t=${start}s`;
  }

  return `https://www.youtube.com/watch?v=${videoId}`;
}

/**
 * Generates the official YouTube thumbnail image URL.
 * Quality options:
 * - 'high': hqdefault (480x360) - recommended for cards
 * - 'maxres': maxresdefault (1280x720) - for high-res hero
 * - 'medium': mqdefault (320x180)
 * - 'default': default (120x90)
 */
export function getYouTubeThumbnailUrl(
  input?: string | null,
  quality: "default" | "medium" | "high" | "maxres" = "high"
): string | null {
  const videoId = parseYouTubeVideoId(input);
  if (!videoId) return null;

  const qualityFile = {
    default: "default.jpg",
    medium: "mqdefault.jpg",
    high: "hqdefault.jpg",
    maxres: "maxresdefault.jpg",
  }[quality];

  return `https://img.youtube.com/vi/${videoId}/${qualityFile}`;
}
