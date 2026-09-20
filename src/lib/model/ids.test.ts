import { afterEach, expect, it, vi } from 'vitest';
import { createId } from './ids';

afterEach(() => vi.unstubAllGlobals());

it('creates distinct UUIDs on a local HTTP origin without randomUUID', () => {
  const getRandomValues = crypto.getRandomValues.bind(crypto);
  vi.stubGlobal('crypto', { getRandomValues });
  const first = createId();
  const second = createId();
  expect(first).toMatch(/^[\da-f]{8}-[\da-f]{4}-4[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/);
  expect(first).not.toBe(second);
});
