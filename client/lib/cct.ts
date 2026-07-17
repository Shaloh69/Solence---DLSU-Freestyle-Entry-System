/**
 * CCT (Kelvin) → RGB for tinting fixture light sources (§9.1a room
 * mood). Tanner Helland's blackbody approximation — plenty accurate for
 * visualization; not a colorimetric instrument.
 */
export function cctToRGB(kelvin: number): { r: number; g: number; b: number } {
  const t = Math.max(1000, Math.min(10000, kelvin)) / 100;

  let r: number;
  let g: number;
  let b: number;

  if (t <= 66) {
    r = 255;
    g = 99.4708025861 * Math.log(t) - 161.1195681661;
    b = t <= 19 ? 0 : 138.5177312231 * Math.log(t - 10) - 305.0447927307;
  } else {
    r = 329.698727446 * Math.pow(t - 60, -0.1332047592);
    g = 288.1221695283 * Math.pow(t - 60, -0.0755148492);
    b = 255;
  }

  const clamp = (v: number) => Math.max(0, Math.min(255, v)) / 255;

  return { r: clamp(r), g: clamp(g), b: clamp(b) };
}

/** CSS hex for a CCT — for swatches and Three.js color strings. */
export function cctToHex(kelvin: number): string {
  const { r, g, b } = cctToRGB(kelvin);
  const toByte = (v: number) =>
    Math.round(v * 255)
      .toString(16)
      .padStart(2, "0");

  return `#${toByte(r)}${toByte(g)}${toByte(b)}`;
}
