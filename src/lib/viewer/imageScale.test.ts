import { describe, expect, it } from 'vitest';
import { imageZoomScale } from './imageScale';
describe('image perspective size', () => {
  it('matches panorama perspective magnification rather than staying fixed on screen', () => {
    expect(imageZoomScale(95)).toBeCloseTo(1);
    expect(imageZoomScale(115)).toBeLessThan(1);
    expect(imageZoomScale(45)).toBeGreaterThan(2);
    const projectedObjectSize = (hfov: number) => 500 / Math.tan(hfov * Math.PI / 360);
    const ratio = 40 * imageZoomScale(95) / projectedObjectSize(95);
    for (const hfov of [45, 60, 83, 107, 115]) expect(40 * imageZoomScale(hfov) / projectedObjectSize(hfov)).toBeCloseTo(ratio);
  });
});
