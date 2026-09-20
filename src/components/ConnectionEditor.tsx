'use client';

import { useEffect, useState } from 'react';
import type { NavHotspot, TourScene } from '@/types';
import { createEditingPreview } from '@/lib/authoring/imageDerivatives';

interface Props {
  scene: TourScene;
  links: NavHotspot[];
  draft: NavHotspot | null;
  onDraft(value: NavHotspot): void;
  onSave(value: NavHotspot): Promise<void>;
}
export function ConnectionEditor({ scene, links, draft, onDraft, onSave }: Props) {
  const [preview, setPreview] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    let disposed = false; let url = '';
    void fetch(scene.image).then(response => response.blob()).then(createEditingPreview).then(result => {
      if (disposed) return;
      url = URL.createObjectURL(result.blob); setPreview(url);
    }).catch(() => { if (!disposed) setError('Could not prepare the editing preview.'); });
    return () => { disposed = true; if (url) URL.revokeObjectURL(url); };
  }, [scene.image]);
  const selected = draft ?? links[0];
  const change = (value: NavHotspot) => { setSaved(false); onDraft(value); };
  return <aside className="connection-editor" aria-label="Live connection editor">
    <h2>Place your connections</h2>
    <p>Choose a ring, then tap the small panorama to move it. The full view updates immediately.</p>
    <label>Destination<select value={selected?.id ?? ''} disabled={saving} onChange={event => { const found = links.find(h => h.id === event.target.value); if (found) change(found); }}>
      {links.map(link => <option key={link.id} value={link.id}>{link.label}</option>)}
    </select></label>
    {selected && <>
      <div className="placement-map" role="button" tabIndex={0} aria-label="Place selected ring in panorama preview"
        onClick={event => { if (saving) return; const rect = event.currentTarget.getBoundingClientRect(); change({ ...selected, position: { ...selected.position, heading: ((event.clientX - rect.left) / rect.width) * 360 - 180, pitch: 90 - ((event.clientY - rect.top) / rect.height) * 180 } }); }}
        onKeyDown={event => { const steps: Record<string, [number, number]> = { ArrowLeft: [-1,0], ArrowRight: [1,0], ArrowUp: [0,1], ArrowDown: [0,-1] }; const step = steps[event.key]; if (!step || saving) return; event.preventDefault(); change({ ...selected, position: { ...selected.position, heading: Math.max(-180, Math.min(179.9, selected.position.heading + step[0])), pitch: Math.max(-89, Math.min(89, selected.position.pitch + step[1])) } }); }}
        style={{ backgroundImage: preview ? `url("${preview}")` : scene.thumbnail ? `url("${scene.thumbnail}")` : undefined }}>
        {links.map(link => { const item = selected.id === link.id ? selected : link; return <span key={item.id} className={`map-point ${item.id === selected.id ? 'active' : ''}`} style={{ left: `${(item.position.heading + 180) / 360 * 100}%`, top: `${(90 - item.position.pitch) / 180 * 100}%` }} />; })}
      </div>
      <div className="connection-fields">
        <label>Yaw<input type="number" min={-180} max={179.9} step={0.5} disabled={saving} value={Number(selected.position.heading.toFixed(1))} onChange={event => change({ ...selected, position: { ...selected.position, heading: Math.max(-180, Math.min(179.9, Number(event.target.value))) } })} /></label>
        <label>Pitch<input type="number" min={-89} max={89} step={0.5} disabled={saving} value={Number(selected.position.pitch.toFixed(1))} onChange={event => change({ ...selected, position: { ...selected.position, pitch: Math.max(-89, Math.min(89, Number(event.target.value))) } })} /></label>
        <label>Surface<select value={selected.surface ?? 'floor'} disabled={saving} onChange={event => change({ ...selected, surface: event.target.value as 'floor' | 'wall' })}><option value="floor">Floor ring</option><option value="wall">Wall circle</option></select></label>
      </div>
      <button className="save-connection" disabled={!draft || saving} onClick={async () => { setSaving(true); setError(''); try { await onSave(selected); setSaved(true); } catch (failure) { setError(failure instanceof Error ? failure.message : 'Save failed. Try again.'); } finally { setSaving(false); } }}>{saving ? 'Saving…' : 'Save position'}</button>
      {saved && <p role="status">Position saved on this device.</p>}
    </>}
    {error && <p role="alert">{error}</p>}
  </aside>;
}
