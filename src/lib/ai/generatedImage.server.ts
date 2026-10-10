import sharp from 'sharp';
import { AiError } from './openrouter.server';

export async function decodeGeneratedImage(result: Record<string, unknown>) {
  const first = Array.isArray(result.data) ? result.data[0] as { b64_json?: unknown; media_type?: unknown } : undefined;
  if (!first || typeof first.b64_json !== 'string' || !first.b64_json || first.b64_json.length > 16_000_000) throw new AiError('The model did not return a usable image. Try a different association or upload a picture.', 502);
  if (first.media_type && !['image/png', 'image/jpeg', 'image/webp'].includes(String(first.media_type))) throw new AiError('The model returned an unsupported image format.', 502);
  const bytes = Buffer.from(first.b64_json, 'base64');
  try {
    const metadata = await sharp(bytes, { limitInputPixels: 16_000_000 }).metadata();
    if (!['png', 'jpeg', 'webp'].includes(metadata.format ?? '')) throw new Error('Unsupported image');
    const output = await sharp(bytes, { limitInputPixels: 16_000_000 }).rotate().resize({ width: 768, height: 768, fit: 'inside', withoutEnlargement: true }).png().toBuffer();
    return output;
  } catch { throw new AiError('The generated image could not be decoded. Your existing image is unchanged.', 502); }
}
