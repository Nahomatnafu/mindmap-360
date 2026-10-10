/** Perspective scale relative to a 95-degree view. Keeps pictures proportional to the room. */
export function imageZoomScale(hfov: number): number {
  if (!Number.isFinite(hfov) || hfov <= 0 || hfov >= 180) return 1;
  return Math.tan(95 * Math.PI / 360) / Math.tan(hfov * Math.PI / 360);
}
export const DEFAULT_IMAGE_SIZE = 40;
