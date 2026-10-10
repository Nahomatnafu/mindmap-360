'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { parseAssociations, type Association } from '@/lib/ai/contracts';

interface Props {
  term: string;
  disabled: boolean;
  onChoose: (association: Association) => void;
}

export function AssociationAssistant({ term, disabled, onChoose }: Props) {
  const id = useId();
  const [suggestions, setSuggestions] = useState<Association[]>([]);
  const [suggestedTerm, setSuggestedTerm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [accessCode, setAccessCode] = useState('');
  const [requiresCode, setRequiresCode] = useState(false);
  const [configuration, setConfiguration] = useState('');
  const controller = useRef<AbortController | null>(null);

  useEffect(() => {
    let active = true;
    void fetch('/api/ai/config').then(r => r.json()).then(config => {
      if (!active) return;
      setRequiresCode(config.requiresAccessCode);
      setConfiguration(!config.configured ? 'AI is not configured. You can still upload your own image.' : config.deploymentLocked ? 'AI needs a demo access code configured on the server.' : '');
    }).catch(() => { if (active) setConfiguration('AI is unavailable at this preview address. You can still upload an image.'); });
    return () => { active = false; controller.current?.abort(); };
  }, []);

  async function suggest() {
    if (controller.current || !term.trim()) return;
    const abort = new AbortController(); controller.current = abort;
    setBusy(true); setError(''); setSuggestions([]);
    const concept = term.trim();
    try {
      const response = await fetch('/api/associations', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-demo-access-code': accessCode }, body: JSON.stringify({ term: concept }), signal: abort.signal });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Suggestions are unavailable.');
      setSuggestions(parseAssociations(result)); setSuggestedTerm(concept);
    } catch (failure) {
      if (!abort.signal.aborted) setError(failure instanceof Error ? failure.message : 'Suggestions are unavailable.');
    } finally { if (!abort.signal.aborted) { setBusy(false); controller.current = null; } }
  }

  return <section className="rounded-xl border p-4" style={{ borderColor: 'var(--border)' }} aria-label="Association assistant">
    <h3 className="text-sm font-medium">Find a memorable image</h3>
    <p className="mt-1 text-xs leading-relaxed" style={{ color: 'var(--text-dim)' }}>Get three visual associations, then choose one. Only the concept is sent to AI.</p>
    {requiresCode && <label className="mt-3 block text-sm" htmlFor={`${id}-code`}>Demo access code
      <input id={`${id}-code`} type="password" autoComplete="off" value={accessCode} onChange={event => setAccessCode(event.target.value)} className="mt-1 w-full rounded-lg border bg-transparent p-3" />
    </label>}
    <button type="button" onClick={() => void suggest()} disabled={disabled || busy || !term.trim() || Boolean(configuration) || (requiresCode && !accessCode)} className="mt-3 min-h-11 w-full rounded-xl bg-white/10 px-3 text-sm disabled:opacity-40">{busy ? 'Finding associations…' : 'Suggest 3 associations'}</button>
    {configuration && <p className="mt-2 text-xs">{configuration}</p>}
    {error && <p className="mt-2 text-sm" role="alert" style={{ color: 'var(--danger)' }}>{error}</p>}
    {suggestions.length > 0 && suggestedTerm !== term.trim() && <p className="mt-2 text-xs">Concept changed. Get new suggestions for this concept.</p>}
    {suggestedTerm === term.trim() && <div className="mt-3 grid gap-2">{suggestions.map(suggestion => <button key={suggestion.label} type="button" disabled={disabled || busy} className="rounded-xl border p-3 text-left disabled:opacity-40 hover:bg-white/5" style={{ borderColor: 'var(--border)' }} onClick={() => onChoose(suggestion)}>
      <strong className="block text-sm">{suggestion.label}</strong><span className="mt-1 block text-xs leading-relaxed" style={{ color: 'var(--text-dim)' }}>{suggestion.reason}</span>
    </button>)}</div>}
  </section>;
}
