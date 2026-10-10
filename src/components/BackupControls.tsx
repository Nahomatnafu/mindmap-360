'use client';

import { useRef, useState } from 'react';
import { useTourContext } from '@/context/TourContext';

export function BackupControls() {
  const { activeTour, exportTour, restoreTour } = useTourContext();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  async function download() {
    if (!activeTour || busy) return;
    setBusy('Preparing backup…'); setError(''); setMessage('');
    try {
      const blob = await exportTour(activeTour.id);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url; link.download = `${activeTour.name.replace(/[^a-z0-9-]/gi, '-').slice(0, 60)}.mindpalace.zip`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
      setMessage('Backup download started. Keep this ZIP to restore your photos and memories on another device.');
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'Backup failed.'); }
    finally { setBusy(''); }
  }
  async function restore(file: File) {
    if (busy) return;
    setBusy('Checking and restoring images…'); setError(''); setMessage('');
    try { await restoreTour(file); setMessage('Restored as a new palace. Your existing spaces are unchanged.'); }
    catch (failure) { setError(failure instanceof Error ? failure.message : 'Restore failed.'); }
    finally { setBusy(''); }
  }
  return <div className="space-y-2 border-t p-4 text-xs" style={{ borderColor: 'var(--border)' }}>
    <div className="flex gap-2">
      <button disabled={!activeTour || Boolean(busy)} onClick={() => void download()} className="min-h-11 flex-1 rounded-lg border px-2 disabled:opacity-40" style={{ borderColor: 'var(--border)' }}>Export ZIP</button>
      <button disabled={Boolean(busy)} onClick={() => input.current?.click()} className="min-h-11 flex-1 rounded-lg border px-2 disabled:opacity-40" style={{ borderColor: 'var(--border)' }}>Restore ZIP</button>
      <input ref={input} hidden type="file" accept=".zip,application/zip" onChange={event => { const file = event.target.files?.[0]; event.target.value = ''; if (file) void restore(file); }} />
    </div>
    {busy && <p role="status">{busy}</p>}
    {message && <p role="status" className="leading-relaxed">{message}</p>}
    {error && <p role="alert" className="leading-relaxed" style={{ color: 'var(--danger)' }}>{error}</p>}
    <p className="leading-relaxed" style={{ color: 'var(--text-dim)' }}>Stored on this device. Export to back up or transfer. Demo backups support up to 99 MB of images.</p>
  </div>;
}
