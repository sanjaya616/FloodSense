/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type SupportedImageMime = 'image/jpeg' | 'image/png' | 'image/webp';

/**
 * Inspects leading file bytes to verify JPEG, PNG, or WEBP magic signatures.
 */
export async function detectImageMagicMime(file: Blob): Promise<SupportedImageMime | null> {
  const slice = file.slice(0, 12);
  const buffer = await slice.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  if (bytes.length < 12) return null;

  // JPEG: FF D8 FF
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'image/jpeg';
  }
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return 'image/png';
  }
  // WEBP: RIFF....WEBP
  const header = String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3]);
  const format = String.fromCharCode(bytes[8], bytes[9], bytes[10], bytes[11]);
  if (header === 'RIFF' && format === 'WEBP') {
    return 'image/webp';
  }
  return null;
}

export interface SanitizedImageResult {
  file: File;
  dataUrl: string;
  mimeType: SupportedImageMime;
  exifStripped: boolean;
  sizeLabel: string;
}

/**
 * Validates binary magic bytes, strips EXIF/GPS metadata by drawing onto an
 * HTML5 canvas, and re-encodes as a size-bounded image file + base64 Data URL.
 */
export async function validateAndSanitizeImageFile(
  file: File,
  maxBytes = 5 * 1024 * 1024
): Promise<SanitizedImageResult> {
  if (file.size > maxBytes) {
    throw new Error('File size exceeds the 5MB upload limit.');
  }

  const detectedMime = await detectImageMagicMime(file);
  if (!detectedMime) {
    throw new Error(
      'Invalid image binary header. Please select an authentic JPG, PNG, or WEBP photograph.'
    );
  }

  const rawDataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Failed to read selected image file.'));
    reader.readAsDataURL(file);
  });

  // Canvas re-encode strips EXIF metadata (camera serial, embedded GPS, thumbnails)
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error('Image decoding failed.'));
      image.src = rawDataUrl;
    });

    const maxDim = 1600;
    let width = img.naturalWidth || img.width;
    let height = img.naturalHeight || img.height;
    if (width > maxDim || height > maxDim) {
      const scale = Math.min(maxDim / width, maxDim / height);
      width = Math.max(1, Math.round(width * scale));
      height = Math.max(1, Math.round(height * scale));
    }

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Canvas 2D context unavailable.');
    }
    ctx.drawImage(img, 0, 0, width, height);

    const outputMime: SupportedImageMime = detectedMime === 'image/png' ? 'image/png' : 'image/jpeg';
    const quality = outputMime === 'image/jpeg' ? 0.88 : undefined;

    const cleanBlob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob);
          else reject(new Error('Canvas encoding returned empty blob.'));
        },
        outputMime,
        quality
      );
    });

    if (cleanBlob.size > maxBytes) {
      throw new Error('Processed image still exceeds the 5MB upload limit.');
    }

    const cleanDataUrl = await new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result || ''));
      r.onerror = () => reject(new Error('Failed to serialize cleaned image.'));
      r.readAsDataURL(cleanBlob);
    });

    const baseName = file.name.replace(/\.[^/.]+$/, '') || 'flood_evidence';
    const ext = outputMime === 'image/png' ? 'png' : 'jpg';
    const cleanFile = new File([cleanBlob], `${baseName}_sanitized.${ext}`, {
      type: outputMime,
    });

    return {
      file: cleanFile,
      dataUrl: cleanDataUrl,
      mimeType: outputMime,
      exifStripped: true,
      sizeLabel: `${(cleanFile.size / (1024 * 1024)).toFixed(2)} MB`,
    };
  } catch (err: any) {
    // Only reject if file itself was invalid/corrupt rather than canvas unavailable
    if (err?.message?.includes('5MB') || err?.message?.includes('decoding')) {
      throw err;
    }
    return {
      file,
      dataUrl: rawDataUrl,
      mimeType: detectedMime,
      exifStripped: false,
      sizeLabel: `${(file.size / (1024 * 1024)).toFixed(2)} MB`,
    };
  }
}

export function createSubmissionRequestId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `req_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}
