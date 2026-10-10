/** Reject renamed HTML/SVG before handing an upload to a browser image decoder. */
export async function assertRasterImage(blob: Blob): Promise<void> {
  const bytes = new Uint8Array(await blob.slice(0, 12).arrayBuffer());
  const matches = (start: number, values: number[]) => values.every((value, index) => bytes[start + index] === value);
  const valid = blob.type === 'image/png' ? matches(0, [137, 80, 78, 71, 13, 10, 26, 10])
    : blob.type === 'image/jpeg' ? matches(0, [255, 216, 255])
    : blob.type === 'image/webp' ? matches(0, [82, 73, 70, 70]) && matches(8, [87, 69, 66, 80]) : false;
  if (!valid) throw new Error('Choose a real PNG, JPEG, or WebP image. SVG and HTML are not supported.');
}
