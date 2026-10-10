import { timingSafeEqual } from 'node:crypto';

export class AiError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}

export function aiConfiguration() {
  return {
    configured: Boolean(process.env.OPENROUTER_API_KEY?.trim()),
    requiresAccessCode: Boolean(process.env.AI_DEMO_ACCESS_CODE),
    deploymentLocked: process.env.NODE_ENV === 'production' && !process.env.AI_DEMO_ACCESS_CODE,
  };
}

export function authorizeAi(request: Request) {
  const config = aiConfiguration();
  if (!config.configured) throw new AiError('AI is not configured yet. Add OPENROUTER_API_KEY to .env.local and restart the app. Image uploads still work.', 503);
  if (config.deploymentLocked) throw new AiError('Set a server-side AI_DEMO_ACCESS_CODE before enabling AI on this production deployment.', 503);
  const expected = process.env.AI_DEMO_ACCESS_CODE;
  if (expected) {
    const actual = request.headers.get('x-demo-access-code') ?? '';
    const left = Buffer.from(actual), right = Buffer.from(expected);
    if (left.length !== right.length || !timingSafeEqual(left, right)) throw new AiError('Enter the demo access code to use AI.', 401);
  }
  const origin = request.headers.get('origin');
  // Next can normalize request.url to localhost even when the browser used 127.0.0.1.
  const host = request.headers.get('host') || new URL(request.url).host;
  if (origin && origin !== process.env.AI_ALLOWED_ORIGIN) {
    let sameHost = false;
    try { sameHost = new URL(origin).host === host; } catch { /* Malformed Origin is rejected. */ }
    if (!sameHost) throw new AiError('Open the app directly to use AI.', 403);
  }
}

export async function readJson(request: Request): Promise<Record<string, unknown>> {
  if (!request.headers.get('content-type')?.includes('application/json')) throw new AiError('Send a JSON request.');
  if (!request.body) throw new AiError('Request is empty.');
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > 8192) { await reader.cancel(); throw new AiError('Your request is too long.', 413); }
      chunks.push(value);
    }
    const parsed: unknown = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Invalid object');
    return parsed as Record<string, unknown>;
  } catch (error) {
    if (error instanceof AiError) throw error;
    throw new AiError('Invalid JSON request.');
  } finally { reader.releaseLock(); }
}

export function inputText(value: unknown, label: string, max: number) {
  if (typeof value !== 'string' || !value.trim() || value.length > max) throw new AiError(`${label} must contain 1–${max} characters.`);
  return value.trim();
}

// Bounded per-process safeguards, not a distributed billing cap. Also cap the provider key.
const budgets = new Map<string, { start: number; used: number; active: number }>();
export function acquireBudget(kind: 'suggestions' | 'images') {
  const now = Date.now();
  let bucket = budgets.get(kind);
  if (!bucket || (now - bucket.start > 3_600_000 && bucket.active === 0)) { bucket = { start: now, used: 0, active: 0 }; budgets.set(kind, bucket); }
  if (bucket.active >= (kind === 'images' ? 1 : 3)) throw new AiError('Another request is running. Please wait before trying again.', 429);
  if (bucket.used >= (kind === 'images' ? 30 : 100)) throw new AiError('The demo AI limit has been reached for this hour. You can still upload images.', 429);
  bucket.used++; bucket.active++;
  return () => { bucket.active--; };
}

export async function openRouter(path: 'chat/completions' | 'images', body: unknown, timeoutMs = 30_000): Promise<Record<string, unknown>> {
  let response: Response;
  try {
    response = await fetch(`https://openrouter.ai/api/v1/${path}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`, 'Content-Type': 'application/json', 'X-Title': 'Mind Palace 360' },
      body: JSON.stringify(body), signal: AbortSignal.timeout(timeoutMs), cache: 'no-store',
    });
  } catch { throw new AiError('The AI service did not respond in time. Your draft is safe. Try again or upload an image.', 504); }
  if (!response.ok) {
    await response.body?.cancel();
    const messages: Record<number, string> = {
      401: 'OpenRouter rejected the server API key. Check its configuration.',
      402: 'OpenRouter credits or the key spending limit have been exhausted.',
      403: 'OpenRouter could not allow this request. Try another association or upload an image.',
      404: 'The configured model is unavailable on OpenRouter.',
      429: 'OpenRouter is busy or rate-limited. Please try again shortly.',
    };
    throw new AiError(messages[response.status] ?? 'OpenRouter could not complete this request. Try again or upload an image.', response.status === 429 ? 429 : 502);
  }
  try { return await response.json(); }
  catch { throw new AiError('OpenRouter returned an unreadable response. Please try again.', 502); }
}

export function aiFailure(error: unknown) {
  return Response.json({ error: error instanceof AiError ? error.message : 'AI could not complete this request. Your draft is safe; try again or use a manual image.' }, { status: error instanceof AiError ? error.status : 502, headers: { 'Cache-Control': 'no-store' } });
}
