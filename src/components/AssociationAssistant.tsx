'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { parseAssociations, type Association } from '@/lib/ai/contracts';

interface Props {
  term: string;
  disabled: boolean;
  onChoose: (association: Association) => void;
  onImage: (blob: Blob) => void;
  onBusyChange: (busy: boolean) => void;
}

export function AssociationAssistant({ term, disabled, onChoose, onImage, onBusyChange }: Props) {
  const id = useId();
  const [suggestions, setSuggestions] = useState<Association[]>([]);
  const [suggestedTerm, setSuggestedTerm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [accessCode, setAccessCode] = useState('');
  const [requiresCode, setRequiresCode] = useState(false);
  const [configuration, setConfiguration] = useState('');
  const [description, setDescription] = useState('');
  const [chosen, setChosen] = useState<Association | null>(null);
  const [generating, setGenerating] = useState(false);
  const [generated, setGenerated] = useState<Blob | null>(null);
  const [generatedUrl, setGeneratedUrl] = useState('');
  const controller = useRef<AbortController | null>(null);

  useEffect(() => { onBusyChange(busy || generating); }, [busy, generating, onBusyChange]);
  useEffect(() => {
    const url = generated ? URL.createObjectURL(generated) : '';
    setGeneratedUrl(url);
    return () => { if (url) URL.revokeObjectURL(url); };
  }, [generated]);

  async function generate() {
    if (controller.current || !description.trim()) return;
    const abort = new AbortController(); controller.current = abort;
    setGenerating(true); setError('');
    try {
      const response = await fetch('/api/memory-image', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-demo-access-code': accessCode }, body: JSON.stringify({ description: description.trim() }), signal: abort.signal });
      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || 'Image generation failed.');
      }
      if (!response.headers.get('content-type')?.startsWith('image/png')) throw new Error('The server did not return an image.');
      setGenerated(await response.blob());
    } catch (failure) {
      if (!abort.signal.aborted) setError(failure instanceof Error ? failure.message : 'Image generation failed.');
    } finally { if (!abort.signal.aborted) { setGenerating(false); controller.current = null; } }
  }

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
    <p className="mt-1 text-xs leading-relaxed" style={{ color: 'var(--text-dim)' }}>Get three associations or describe your own. AI receives your concept and image description; your room photos stay on this device.</p>
    {requiresCode && <label className="mt-3 block text-sm" htmlFor={`${id}-code`}>Demo access code
      <input id={`${id}-code`} type="password" autoComplete="off" value={accessCode} onChange={event => setAccessCode(event.target.value)} className="mt-1 w-full rounded-lg border bg-transparent p-3" />
    </label>}
    <button type="button" onClick={() => void suggest()} disabled={disabled || busy || generating || !term.trim() || Boolean(configuration) || (requiresCode && !accessCode)} className="mt-3 min-h-11 w-full rounded-xl bg-white/10 px-3 text-sm disabled:opacity-40">{busy ? 'Finding associations…' : 'Suggest 3 associations'}</button>
    {configuration && <p className="mt-2 text-xs">{configuration}</p>}
    {error && <p className="mt-2 text-sm" role="alert" style={{ color: 'var(--danger)' }}>{error}</p>}
    {suggestions.length > 0 && suggestedTerm !== term.trim() && <p className="mt-2 text-xs">Concept changed. Get new suggestions for this concept.</p>}
    {suggestedTerm === term.trim() && <div className="mt-3 grid gap-2">{suggestions.map(suggestion => <button key={suggestion.label} type="button" disabled={disabled || busy || generating} aria-pressed={chosen?.label === suggestion.label} className="rounded-xl border p-3 text-left disabled:opacity-40 hover:bg-white/5" style={{ borderColor: chosen?.label === suggestion.label ? 'var(--gold)' : 'var(--border)' }} onClick={() => { setChosen(suggestion); setDescription(suggestion.imagePrompt); setGenerated(null); }}>
      <strong className="block text-sm">{suggestion.label}</strong><span className="mt-1 block text-xs leading-relaxed" style={{ color: 'var(--text-dim)' }}>{suggestion.reason}</span>
    </button>)}</div>}
    <label htmlFor={`${id}-description`} className="mt-4 block text-sm">Image to create</label>
    <textarea id={`${id}-description`} rows={2} maxLength={1000} value={description} disabled={disabled || busy || generating}
      onChange={event => { setDescription(event.target.value); setChosen(null); setGenerated(null); }}
      placeholder="For example: a gold bracelet, or a friendly white dog in a red cape"
      className="mt-2 w-full rounded-xl border bg-transparent p-3 text-base" style={{ borderColor: 'var(--border)' }} />
    <button type="button" disabled={disabled || busy || generating || !description.trim() || Boolean(configuration) || (requiresCode && !accessCode)} onClick={() => void generate()}
      className="mt-2 min-h-11 w-full rounded-xl px-3 text-sm disabled:opacity-40" style={{ background: 'var(--gold)', color: 'var(--bg)' }}>{generating ? 'Creating your image…' : generated ? 'Generate another image' : 'Generate image'}</button>
    <p className="mt-2 text-xs leading-relaxed" style={{ color: 'var(--text-dim)' }}>{generating ? 'This can take up to 2½ minutes. Keep this editor open; your note is still here.' : 'Uses OpenRouter credits for one Flare image. Uploading your own image is free.'}</p>
    {generatedUrl && <div className="mt-3 rounded-xl bg-white/5 p-3">
      {/* eslint-disable-next-line @next/next/no-img-element -- local generated image Blob */}
      <img src={generatedUrl} alt="Generated association preview" className="mx-auto h-40 w-40 object-contain" />
      <button type="button" disabled={disabled || busy || generating} className="mt-3 min-h-11 w-full rounded-lg border text-sm" onClick={() => {
        if (!generated) return;
        onImage(generated);
        onChoose(chosen ?? { label: description, reason: 'My visual association.', imagePrompt: description });
        setGenerated(null);
      }}>Use this image</button>
    </div>}
  </section>;
}
