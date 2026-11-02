/**
 * Centralized Image Compression & Optimization Utility
 * 
 * Provides automated client-side image compression for student & user profile photos:
 * - Resizes images to standard profile resolution (max 600x600 square crop)
 * - Auto-converts to WebP when supported, with JPEG fallback
 * - Targets optimal size (~100-200 KB) for high quality + instant loading
 * - Avoids re-compressing already optimized images
 * - Validates file types and sizes up to 15MB
 * - Graceful fallback on canvas failure
 */

export interface CompressionOptions {
  /** Maximum width in pixels (default: 600) */
  maxWidth?: number;
  /** Maximum height in pixels (default: 600) */
  maxHeight?: number;
  /** Compression quality between 0.1 and 1.0 (default: 0.85) */
  quality?: number;
  /** Preferred MIME type (defaults to 'image/webp' with 'image/jpeg' fallback) */
  mimeType?: 'image/webp' | 'image/jpeg' | 'image/png';
}

export interface CompressedImageResult {
  /** Lightweight File ready for FormData / cloud upload */
  file: File;
  /** Compact base64 Data URL for instant previews or database fallback */
  dataUrl: string;
  /** Final image width */
  width: number;
  /** Final image height */
  height: number;
  /** Final file size in bytes */
  size: number;
}

const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
];

const MAX_INPUT_SIZE = 15 * 1024 * 1024; // 15 MB

/**
 * Checks if the browser canvas supports exporting as WebP.
 */
function supportsWebP(): boolean {
  if (typeof document === 'undefined') return false;
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    return canvas.toDataURL('image/webp').startsWith('data:image/webp');
  } catch {
    return false;
  }
}

/**
 * Validates an image file before processing.
 */
export function validateImageFile(file: File): { valid: boolean; error?: string } {
  if (!file) {
    return { valid: false, error: 'No file selected.' };
  }
  if (file.size > MAX_INPUT_SIZE) {
    return { valid: false, error: 'File size must be under 15 MB.' };
  }
  const type = file.type?.toLowerCase();
  const name = file.name?.toLowerCase();
  const isAllowed =
    ALLOWED_MIME_TYPES.some((t) => type === t) ||
    /\.(jpe?g|png|webp|heic|heif)$/i.test(name);

  if (!isAllowed) {
    return {
      valid: false,
      error: 'Unsupported image format. Please select a JPG, PNG, or WebP photo.',
    };
  }
  return { valid: true };
}

/**
 * Validates and cleans any profile photo string.
 * Rejects dead Render ephemeral URLs, nulls, and blanks.
 */
export function isValidProfilePhoto(url?: string | null): boolean {
  if (!url || typeof url !== 'string') return false;
  const trimmed = url.trim();
  if (
    !trimmed ||
    trimmed === 'null' ||
    trimmed === 'undefined' ||
    trimmed === '""' ||
    trimmed === 'none'
  ) {
    return false;
  }
  // Filter out dead ephemeral Render uploads that 404
  if (trimmed.includes('bright-8uji.onrender.com/uploads/')) {
    return false;
  }
  return true;
}

/**
 * Compresses an image File or Blob using HTML5 Canvas.
 * Automatically downsamples to maximum 600x600 centered crop,
 * encodes to WebP/JPEG, and returns both File and Data URL.
 */
export async function compressImage(
  input: File | Blob | string,
  options: CompressionOptions = {}
): Promise<CompressedImageResult> {
  const {
    maxWidth = 600,
    maxHeight = 600,
    quality = 0.85,
  } = options;

  const targetMime: 'image/webp' | 'image/jpeg' =
    options.mimeType === 'image/jpeg'
      ? 'image/jpeg'
      : supportsWebP()
      ? 'image/webp'
      : 'image/jpeg';

  return new Promise((resolve, reject) => {
    let src = '';
    let originalName = 'profile-photo.jpg';

    if (typeof input === 'string') {
      src = input;
    } else {
      if (input instanceof File) {
        originalName = input.name;
        // Optimization: if file is already optimized WebP/JPEG under 150KB, we can skip heavy canvas operations
        if (
          (input.type === 'image/webp' || input.type === 'image/jpeg') &&
          input.size <= 150 * 1024
        ) {
          // Read to dataUrl and resolve directly
          const reader = new FileReader();
          reader.onload = () => {
            resolve({
              file: input,
              dataUrl: reader.result as string,
              width: maxWidth,
              height: maxHeight,
              size: input.size,
            });
          };
          reader.onerror = () => reject(new Error('Failed to read image file'));
          reader.readAsDataURL(input);
          return;
        }
      }
      src = URL.createObjectURL(input);
    }

    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      if (typeof input !== 'string') {
        URL.revokeObjectURL(src);
      }

      const origWidth = img.naturalWidth || img.width;
      const origHeight = img.naturalHeight || img.height;

      if (!origWidth || !origHeight) {
        reject(new Error('Invalid image dimensions'));
        return;
      }

      // Center square crop calculations
      const minDimension = Math.min(origWidth, origHeight);
      const cropX = (origWidth - minDimension) / 2;
      const cropY = (origHeight - minDimension) / 2;

      // Bound to target dimensions (max 600x600)
      const targetSize = Math.min(maxWidth, maxHeight, minDimension);

      const canvas = document.createElement('canvas');
      canvas.width = targetSize;
      canvas.height = targetSize;

      const ctx = canvas.getContext('2d', { willReadFrequently: false });
      if (!ctx) {
        reject(new Error('Canvas 2D context unavailable'));
        return;
      }

      // High-quality downsampling filters
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';

      // Centered square crop draw
      ctx.drawImage(
        img,
        cropX,
        cropY,
        minDimension,
        minDimension,
        0,
        0,
        targetSize,
        targetSize
      );

      const dataUrl = canvas.toDataURL(targetMime, quality);

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error('Canvas toBlob conversion failed'));
            return;
          }

          const baseName = originalName.replace(/\.[^/.]+$/, '');
          const extension = targetMime === 'image/webp' ? 'webp' : 'jpg';
          const compressedFile = new File([blob], `${baseName}.${extension}`, {
            type: targetMime,
            lastModified: Date.now(),
          });

          resolve({
            file: compressedFile,
            dataUrl,
            width: targetSize,
            height: targetSize,
            size: blob.size,
          });
        },
        targetMime,
        quality
      );
    };

    img.onerror = () => {
      if (typeof input !== 'string') {
        URL.revokeObjectURL(src);
      }
      reject(new Error('Failed to load image for compression'));
    };

    img.src = src;
  });
}
