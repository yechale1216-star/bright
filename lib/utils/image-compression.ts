/**
 * Utility for client-side image compression and resizing.
 * Optimizes profile photos before upload to ensure fast uploads,
 * minimal bandwidth, quick rendering in tables/lists, and stable storage.
 */

export interface CompressionOptions {
  /** Maximum width in pixels (default: 400) */
  maxWidth?: number;
  /** Maximum height in pixels (default: 400) */
  maxHeight?: number;
  /** Compression quality between 0.1 and 1.0 (default: 0.82) */
  quality?: number;
  /** Output MIME type (default: 'image/jpeg') */
  mimeType?: 'image/jpeg' | 'image/webp' | 'image/png';
}

export interface CompressedImageResult {
  /** Lightweight File ready for FormData / Supabase upload */
  file: File;
  /** Compact base64 Data URL for instant previews or fallback storage */
  dataUrl: string;
  /** Final image width */
  width: number;
  /** Final image height */
  height: number;
  /** Final file size in bytes */
  size: number;
}

/**
 * Compresses an image File or Blob using HTML5 Canvas.
 * Resizes keeping aspect ratio, centered crop, and re-encodes at target quality.
 */
export async function compressImage(
  input: File | Blob | string,
  options: CompressionOptions = {}
): Promise<CompressedImageResult> {
  const {
    maxWidth = 400,
    maxHeight = 400,
    quality = 0.82,
    mimeType = 'image/jpeg',
  } = options;

  return new Promise((resolve, reject) => {
    // If input is already a string (Data URL or URL)
    let src = '';
    let originalName = 'profile-photo.jpg';

    if (typeof input === 'string') {
      src = input;
    } else {
      if (input instanceof File) {
        originalName = input.name;
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

      // Calculate square center-crop coordinates and scaled dimensions for avatar
      const minDimension = Math.min(origWidth, origHeight);
      const cropX = (origWidth - minDimension) / 2;
      const cropY = (origHeight - minDimension) / 2;

      // Target size: constrained by maxWidth / maxHeight
      const targetSize = Math.min(maxWidth, maxHeight, minDimension);

      const canvas = document.createElement('canvas');
      canvas.width = targetSize;
      canvas.height = targetSize;

      const ctx = canvas.getContext('2d', { willReadFrequently: false });
      if (!ctx) {
        reject(new Error('Failed to create canvas context'));
        return;
      }

      // High-quality downsampling settings
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';

      // Draw centered square crop
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

      // Export as data URL
      const dataUrl = canvas.toDataURL(mimeType, quality);

      // Export as Blob -> File
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error('Canvas toBlob failed'));
            return;
          }

          const baseName = originalName.replace(/\.[^/.]+$/, '');
          const extension = mimeType === 'image/webp' ? 'webp' : mimeType === 'image/png' ? 'png' : 'jpg';
          const compressedFile = new File([blob], `${baseName}.${extension}`, {
            type: mimeType,
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
        mimeType,
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

