export interface Association { label: string; reason: string; imagePrompt: string }

export function parseAssociations(value: unknown): Association[] {
  if (!value || typeof value !== 'object' || !('suggestions' in value) || !Array.isArray(value.suggestions) || value.suggestions.length !== 3) throw new Error('The model did not return three associations. Try again or enter your own.');
  const result = value.suggestions.map((item: unknown) => {
    if (!item || typeof item !== 'object') throw new Error('Invalid association response.');
    const row = item as Record<string, unknown>;
    for (const [key, limit] of [['label', 100], ['reason', 400], ['imagePrompt', 1000]] as const) {
      if (typeof row[key] !== 'string' || !row[key].trim() || row[key].length > limit) throw new Error('Invalid association response.');
    }
    return { label: String(row.label).trim(), reason: String(row.reason).trim(), imagePrompt: String(row.imagePrompt).trim() };
  });
  if (new Set(result.map(s => s.label.toLowerCase())).size !== 3) throw new Error('The suggestions were duplicates. Try again.');
  return result;
}

export const associationSchema = {
  type: 'object', additionalProperties: false, required: ['suggestions'],
  properties: { suggestions: { type: 'array', minItems: 3, maxItems: 3, items: {
    type: 'object', additionalProperties: false, required: ['label', 'reason', 'imagePrompt'],
    properties: { label: { type: 'string' }, reason: { type: 'string' }, imagePrompt: { type: 'string' } },
  } } },
};
