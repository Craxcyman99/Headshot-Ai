/**
 * File upload security: magic byte validation, filename sanitization,
 * and random name generation.
 */

// Magic bytes for common image formats (first bytes of valid files)
const IMAGE_SIGNATURES: { bytes: number[]; mime: string }[] = [
  { bytes: [0xff, 0xd8, 0xff], mime: 'image/jpeg' },          // JPEG
  { bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], mime: 'image/png' }, // PNG
  { bytes: [0x52, 0x49, 0x46, 0x46], mime: 'image/webp' },     // WebP (RIFF header)
  { bytes: [0x47, 0x49, 0x46, 0x38, 0x37, 0x61], mime: 'image/gif' }, // GIF87a
  { bytes: [0x47, 0x49, 0x46, 0x38, 0x39, 0x61], mime: 'image/gif' }, // GIF89a
];

const ALLOWED_MIMES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export interface FileValidationResult {
  valid: boolean;
  error?: string;
  detectedMime?: string;
}

/**
 * Validate file by checking magic bytes (not just extension/mime type).
 */
export async function validateImageFile(file: File): Promise<FileValidationResult> {
  if (file.size > MAX_FILE_SIZE) {
    return { valid: false, error: `File too large: max ${MAX_FILE_SIZE / 1024 / 1024}MB` };
  }

  if (file.size === 0) {
    return { valid: false, error: 'Empty file' };
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const header = Array.from(buffer.subarray(0, 8));

  for (const sig of IMAGE_SIGNATURES) {
    const match = sig.bytes.every((b, i) => header[i] === b);
    if (match) {
      // For WebP, also check for WEBP marker at offset 8
      if (sig.mime === 'image/webp') {
        if (buffer.length < 12) return { valid: false, error: 'Invalid WebP file' };
        const webpMarker = buffer.subarray(8, 12).toString('ascii');
        if (webpMarker !== 'WEBP') return { valid: false, error: 'Invalid WebP file' };
      }
      if (!ALLOWED_MIMES.has(sig.mime)) {
        return { valid: false, error: `Unsupported image type: ${sig.mime}` };
      }
      return { valid: true, detectedMime: sig.mime };
    }
  }

  return { valid: false, error: 'File is not a valid image (magic byte check failed)' };
}

/**
 * Sanitize filename to prevent path traversal and special characters.
 */
export function sanitizeFilename(name: string): string {
  return name
    .replace(/[^a-zA-Z0-9._-]/g, '_')    // Replace special chars
    .replace(/\.{2,}/g, '.')              // Remove consecutive dots (path traversal)
    .replace(/^\.+/, '')                  // Remove leading dots
    .slice(0, 200);                        // Truncate
}

/**
 * Generate a random storage path with UUID, not original filename.
 */
export function generateStoragePath(
  userId: string,
  jobId: string,
  index: number,
  detectedMime: string
): string {
  const ext = detectedMime === 'image/jpeg' ? 'jpg' :
              detectedMime === 'image/png' ? 'png' :
              detectedMime === 'image/webp' ? 'webp' :
              detectedMime === 'image/gif' ? 'gif' : 'jpg';
  const uuid = crypto.randomUUID();
  return `${userId}/${jobId}/${uuid}_${index}.${ext}`;
}
