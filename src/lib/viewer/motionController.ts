export interface MotionViewer {
  startOrientation(): void;
  stopOrientation(): void;
  isOrientationSupported(): boolean;
  isOrientationActive(): boolean;
}
export type MotionState = { status: 'off' | 'permission' | 'waiting' | 'on' | 'error'; message: string };
export interface MotionEnvironment {
  secure: boolean;
  supported: boolean;
  events: Pick<Window, 'addEventListener' | 'removeEventListener'>;
  requestPermission?: () => Promise<string>;
}

/** Manages consent, sensor readiness, and cancellation around the viewer's rotation math. */
export class MotionController {
  private generation = 0;
  private timer?: ReturnType<typeof setTimeout>;
  private listener?: EventListener;
  constructor(private viewer: MotionViewer, private env: MotionEnvironment, private changed: (state: MotionState) => void) {}

  private release() {
    if (this.timer) clearTimeout(this.timer);
    if (this.listener) this.env.events.removeEventListener('deviceorientation', this.listener);
    this.timer = undefined;
    this.listener = undefined;
    this.viewer.stopOrientation();
  }

  stop(message = '') {
    this.generation++;
    this.release();
    this.changed({ status: 'off', message });
  }

  async start() {
    this.release();
    const generation = ++this.generation;
    const fail = (message: string) => {
      if (generation !== this.generation) return;
      this.release();
      this.changed({ status: 'error', message });
    };
    if (!this.env.secure) {
      fail('Motion view needs a trusted HTTPS link. Chrome blocks phone sensors on this HTTP Wi-Fi preview. Dragging still works.');
      return;
    }
    if (!this.env.supported || !this.viewer.isOrientationSupported()) {
      fail('Motion sensors are unavailable in this browser. Open the HTTPS preview directly in Chrome or Safari on your phone.');
      return;
    }
    try {
      if (this.env.requestPermission) {
        this.changed({ status: 'permission', message: 'Allow motion access in your browser.' });
        const result = await this.env.requestPermission();
        if (generation !== this.generation) return;
        if (result !== 'granted') { fail('Motion access was denied. You can enable it in this site’s browser permissions, then try again.'); return; }
      }
      if (generation !== this.generation) return;
      this.changed({ status: 'waiting', message: 'Hold your phone upright and move it gently…' });
      let samples = 0;
      this.listener = ((event: DeviceOrientationEvent) => {
        if (![event.alpha, event.beta, event.gamma].every(value => typeof value === 'number' && Number.isFinite(value))) return;
        // Pannellum discards the first ten events when calibrating the starting heading.
        if (++samples < 12 || !this.viewer.isOrientationActive()) return;
        if (this.timer) clearTimeout(this.timer);
        this.timer = undefined;
        if (this.listener) this.env.events.removeEventListener('deviceorientation', this.listener);
        this.listener = undefined;
        this.changed({ status: 'on', message: '' });
      }) as EventListener;
      this.env.events.addEventListener('deviceorientation', this.listener);
      this.timer = setTimeout(() => fail('No motion readings arrived. In Chrome, check Site settings → Motion sensors, then try again.'), 8000);
      this.viewer.startOrientation();
    } catch {
      fail('Motion access could not start. Check the browser’s motion permission and try again.');
    }
  }

  dispose() { this.generation++; this.release(); }
}
