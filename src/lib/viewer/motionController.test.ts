import { afterEach, describe, expect, it, vi } from 'vitest';
import { MotionController, type MotionEnvironment, type MotionState } from './motionController';

function setup(overrides: Partial<MotionEnvironment> = {}) {
  const events = new EventTarget();
  const viewer = { startOrientation: vi.fn(), stopOrientation: vi.fn(), isOrientationSupported: () => true, isOrientationActive: () => true };
  const states: MotionState[] = [];
  const controller = new MotionController(viewer, { secure: true, supported: true, events, ...overrides }, state => states.push(state));
  const sample = (alpha: number | null = 10) => {
    const event = new Event('deviceorientation');
    Object.assign(event, { alpha, beta: 90, gamma: 0 });
    events.dispatchEvent(event);
  };
  return { controller, viewer, states, sample };
}

afterEach(() => vi.useRealTimers());
describe('motion consent and sensor lifecycle', () => {
  it('explains HTTP restrictions without starting sensors or requesting permission', async () => {
    const requestPermission = vi.fn();
    const { controller, viewer, states } = setup({ secure: false, requestPermission });
    await controller.start();
    expect(viewer.startOrientation).not.toHaveBeenCalled();
    expect(requestPermission).not.toHaveBeenCalled();
    expect(states.at(-1)?.message).toContain('HTTPS');
  });
  it('does not claim motion is on before calibrated valid readings arrive', async () => {
    const { controller, states, sample } = setup();
    await controller.start();
    for (let i = 0; i < 20; i++) sample(null);
    expect(states.at(-1)?.status).toBe('waiting');
    for (let i = 0; i < 12; i++) sample();
    expect(states.at(-1)?.status).toBe('on');
    controller.dispose();
  });
  it('reports denied permission without enabling the engine', async () => {
    const { controller, viewer, states } = setup({ requestPermission: async () => 'denied' });
    await controller.start();
    expect(viewer.startOrientation).not.toHaveBeenCalled();
    expect(states.at(-1)?.message).toContain('denied');
  });
  it('does not restart after a permission request resolves following cancellation', async () => {
    let grant!: (value: string) => void;
    const { controller, viewer, states } = setup({ requestPermission: () => new Promise(resolve => { grant = resolve; }) });
    const pending = controller.start();
    controller.stop(); grant('granted'); await pending;
    expect(viewer.startOrientation).not.toHaveBeenCalled();
    expect(states.at(-1)?.status).toBe('off');
  });
  it('times out missing sensors and ignores readings after disposal', async () => {
    vi.useFakeTimers();
    const { controller, viewer, states, sample } = setup();
    await controller.start();
    vi.advanceTimersByTime(8000);
    expect(states.at(-1)?.status).toBe('error');
    expect(viewer.stopOrientation).toHaveBeenCalled();
    controller.dispose();
    const count = states.length;
    for (let i = 0; i < 20; i++) sample();
    expect(states).toHaveLength(count);
  });
});
