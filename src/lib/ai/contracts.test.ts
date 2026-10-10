import { afterEach, describe, expect, it, vi } from 'vitest';
import { parseAssociations } from './contracts';
import { AiError, authorizeAi, inputText, openRouter, readJson } from './openrouter.server';

afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
describe('AI boundaries', () => {
  it('requires three unique, bounded suggestions', () => {
    const suggestions = ['Water', 'Balloon', 'Sun'].map(label => ({ label, reason: 'A visual association.', imagePrompt: `A ${label}` }));
    expect(parseAssociations({ suggestions })).toHaveLength(3);
    expect(() => parseAssociations({ suggestions: suggestions.slice(1) })).toThrow();
    expect(() => parseAssociations({ suggestions: [suggestions[0], suggestions[0], suggestions[0]] })).toThrow();
    expect(() => parseAssociations({ suggestions: [{ ...suggestions[0], imagePrompt: 'x'.repeat(1001) }, ...suggestions.slice(1)] })).toThrow();
  });
  it('fails closed for production without access control and rejects a wrong code', () => {
    vi.stubEnv('OPENROUTER_API_KEY', 'test-key'); vi.stubEnv('NODE_ENV', 'production'); vi.stubEnv('AI_DEMO_ACCESS_CODE', '');
    const request = new Request('https://palace.example/api/associations');
    expect(() => authorizeAi(request)).toThrow(/AI_DEMO_ACCESS_CODE/);
    vi.stubEnv('AI_DEMO_ACCESS_CODE', 'test-demo-code');
    expect(() => authorizeAi(request)).toThrow(/access code/);
    expect(() => authorizeAi(new Request(request, { headers: { 'x-demo-access-code': 'test-demo-code' } }))).not.toThrow();
  });
  it('rejects long, malformed and cross-origin requests', async () => {
    expect(() => inputText('x'.repeat(161), 'Concept', 160)).toThrow();
    const request = (body: string) => new Request('http://localhost/api', { method: 'POST', headers: { 'content-type': 'application/json' }, body });
    await expect(readJson(request('bad json'))).rejects.toBeInstanceOf(AiError);
    await expect(readJson(request('x'.repeat(9000)))).rejects.toMatchObject({ status: 413 });
    vi.stubEnv('OPENROUTER_API_KEY', 'test-key'); vi.stubEnv('NODE_ENV', 'development'); vi.stubEnv('AI_DEMO_ACCESS_CODE', '');
    expect(() => authorizeAi(new Request('http://localhost/api', { headers: { origin: 'https://untrusted.example' } }))).toThrow(/directly/);
    expect(() => authorizeAi(new Request('http://localhost:3000/api', { headers: { host: '127.0.0.1:3000', origin: 'http://127.0.0.1:3000' } }))).not.toThrow();
  });
  it('sanitizes provider errors and does not automatically repeat a paid request', async () => {
    vi.stubEnv('OPENROUTER_API_KEY', 'test-key');
    const fetchMock = vi.fn().mockResolvedValue(new Response('private provider diagnostic', { status: 402 })); vi.stubGlobal('fetch', fetchMock);
    await expect(openRouter('images', {})).rejects.toThrow(/credits/);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
