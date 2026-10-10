import { decodeGeneratedImage } from '@/lib/ai/generatedImage.server';
import { acquireBudget, aiFailure, authorizeAi, inputText, openRouter, readJson } from '@/lib/ai/openrouter.server';

export const runtime = 'nodejs';
export const maxDuration = 180;

export async function POST(request: Request) {
  let release: (() => void) | undefined;
  try {
    authorizeAi(request);
    const body = await readJson(request);
    const description = inputText(body.description, 'Image description', 1000);
    release = acquireBudget('images');
    const result = await openRouter('images', {
      model: process.env.OPENROUTER_IMAGE_MODEL || 'openai/gpt-image-2.5-flare',
      prompt: `Create one memorable, recognizable illustrated object for a memory palace. Subject: ${description}\nRender a single centered isolated cutout with a transparent background, clean silhouette, vivid natural colors, subtle three-dimensional shading, and enough margin that nothing is cropped. No letters, labels, watermark, border, room, scenery, or checkerboard pattern. It must remain recognizable at 64 pixels.`,
      n: 1, quality: 'low', aspect_ratio: '1:1', output_format: 'png', background: 'transparent',
    }, 150_000);
    const png = await decodeGeneratedImage(result);
    return new Response(new Uint8Array(png), { headers: { 'Content-Type': 'image/png', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });
  } catch (error) { return aiFailure(error); }
  finally { release?.(); }
}
