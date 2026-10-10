import { describe, expect, it } from 'vitest';
import sharp from 'sharp';
import { decodeGeneratedImage } from './generatedImage.server';

describe('generated image decoding', () => {
  it('rejects missing, vector, and corrupt provider images', async () => {
    await expect(decodeGeneratedImage({ data: [] })).rejects.toThrow(/usable image/);
    await expect(decodeGeneratedImage({ data: [{ b64_json: 'PHN2Zz4=', media_type: 'image/svg+xml' }] })).rejects.toThrow(/format/);
    await expect(decodeGeneratedImage({ data: [{ b64_json: 'bm90IGFuIGltYWdl', media_type: 'image/png' }] })).rejects.toThrow(/decoded/);
  });
  it('compresses an image without losing its transparent channel', async () => {
    const png = await sharp({ create: { width: 1024, height: 1024, channels: 4, background: { r: 255, g: 200, b: 10, alpha: 0.5 } } }).png().toBuffer();
    const output = await decodeGeneratedImage({ data: [{ b64_json: png.toString('base64'), media_type: 'image/png' }] });
    const metadata = await sharp(output).metadata();
    expect(metadata).toMatchObject({ width: 768, height: 768, hasAlpha: true, format: 'png' });
  });
});
