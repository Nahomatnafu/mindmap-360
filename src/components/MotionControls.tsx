'use client';

import { useEffect, useRef, useState, type RefObject } from 'react';
import { MotionController, type MotionState, type MotionViewer } from '@/lib/viewer/motionController';

interface Viewer extends MotionViewer {
  on(event: string, callback: () => void): void;
  off(event: string, callback: () => void): void;
  lookAt(pitch: number, yaw: number, hfov?: number, duration?: number): void;
}

export function MotionControls({ viewer, ready, paused, pitch, yaw }: {
  viewer: RefObject<Viewer | null>; ready: number; paused: boolean; pitch: number; yaw: number;
}) {
  const controller = useRef<MotionController | null>(null);
  const [state, setState] = useState<MotionState>({ status: 'off', message: '' });
  useEffect(() => {
    const engine = viewer.current;
    if (!engine || !ready) return;
    const orientation = window.DeviceOrientationEvent as (typeof DeviceOrientationEvent & { requestPermission?: () => Promise<string> }) | undefined;
    const next = new MotionController(engine, {
      secure: window.isSecureContext,
      supported: Boolean(orientation),
      events: window,
      requestPermission: orientation?.requestPermission ? () => orientation.requestPermission!() : undefined,
    }, setState);
    controller.current = next;
    next.stop();
    const stop = () => next.stop();
    const hidden = () => { if (document.hidden) next.stop(); };
    engine.on('mousedown', stop); engine.on('touchstart', stop); engine.on('scenechange', stop);
    document.addEventListener('visibilitychange', hidden);
    return () => {
      next.dispose(); controller.current = null;
      engine.off('mousedown', stop); engine.off('touchstart', stop); engine.off('scenechange', stop);
      document.removeEventListener('visibilitychange', hidden);
    };
  }, [ready, viewer]);

  useEffect(() => { if (paused) controller.current?.stop(); }, [paused, ready]);
  const active = state.status === 'on';
  const starting = state.status === 'permission' || state.status === 'waiting';
  return <div className="motion-controls">
    <button className="motion-toggle" aria-pressed={active} disabled={!ready || paused} onClick={() => {
      if (active || starting) controller.current?.stop(); else void controller.current?.start();
    }}>{active ? 'Motion on' : starting ? 'Cancel motion' : 'Motion view'}</button>
    {active && <button className="motion-recenter" onClick={() => {
      controller.current?.stop(); viewer.current?.lookAt(pitch, yaw, undefined, 0); void controller.current?.start();
    }}>Recenter</button>}
    {state.message && <div className="motion-message" role={state.status === 'error' ? 'alert' : 'status'}>
      <span>{state.message}</span><button aria-label="Dismiss motion message" onClick={() => controller.current?.stop()}>×</button>
    </div>}
  </div>;
}
