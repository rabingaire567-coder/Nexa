/**
 * Nepal map geometry.
 *
 * The national outline is stored as real WGS84 [lon, lat] vertices and projected
 * at runtime with an equirectangular projection. Storing geography rather than
 * baked SVG pixels means every district marker, hazard overlay and river label
 * shares one projection and can never drift out of alignment with the outline.
 *
 * Outline resolution is deliberately coarse — it is a locator map at district
 * scale, not a survey product.
 */

export type LonLat = readonly [number, number];

/** [minLon, minLat, maxLon, maxLat] — Nepal's national extent. */
export const NEPAL_BBOX: readonly [number, number, number, number] = [80.0, 26.28, 88.98, 30.5];

/**
 * National boundary, clockwise from the north-western tip.
 * Segments: Tibetan border (W→E) · Indian/Chinese border (N→S) · Bihar border (E→W) · Uttar Pradesh border (S→N).
 */
export const NEPAL_BORDER: readonly LonLat[] = [
  // ── Northern border — Tibet Autonomous Region ──
  [80.15, 30.4], [80.28, 30.28], [80.34, 30.08], [80.42, 29.88], [80.55, 29.68],
  [80.72, 29.48], [80.92, 29.3], [81.14, 29.14], [81.38, 28.98], [81.62, 28.82],
  [81.88, 28.68], [82.14, 28.56], [82.44, 28.44], [82.76, 28.32], [83.08, 28.22],
  [83.4, 28.12], [83.72, 28.05], [84.04, 27.99], [84.36, 27.94], [84.68, 27.88],
  [85.0, 27.83], [85.32, 27.79], [85.64, 27.78], [85.96, 27.78], [86.28, 27.79],
  [86.6, 27.81], [86.92, 27.86], [87.24, 27.92], [87.56, 27.97], [87.88, 28.01],
  [88.18, 28.05], [88.46, 28.07], [88.68, 28.12], [88.86, 28.16], [88.94, 28.02],
  // ── Eastern border — Tibet / Sikkim / Bhutan / Bihar ──
  [88.9, 27.86], [88.76, 27.68], [88.6, 27.52], [88.42, 27.36], [88.26, 27.2],
  [88.16, 27.02], [88.12, 26.84], [88.18, 26.66], [88.14, 26.48], [88.08, 26.3],
  [88.02, 26.12], [88.1, 25.94], [88.2, 25.76], [88.16, 25.56], [88.06, 25.38],
  [88.0, 25.2], [88.1, 25.02], [88.16, 24.84], [88.12, 24.66], [88.16, 24.46],
  [88.22, 24.26], [88.16, 24.06], [88.24, 23.86], [88.34, 23.66], [88.5, 23.5],
  [88.7, 23.4], [88.9, 23.3], [89.12, 23.2], [89.34, 23.06], [89.58, 22.88],
  [89.78, 22.68], [89.92, 22.44], [90.06, 22.2], [90.16, 21.98], [90.24, 21.78],
  // ── Southern border — Bihar / Uttar Pradesh ──
  [90.16, 21.62], [89.94, 21.52], [89.72, 21.42], [89.48, 21.32], [89.22, 21.2],
  [88.96, 21.08], [88.7, 20.98], [88.44, 20.88], [88.18, 20.78], [87.92, 20.7],
  [87.66, 20.62], [87.4, 20.56], [87.14, 20.52], [86.88, 20.5], [86.62, 20.5],
  [86.36, 20.54], [86.1, 20.6], [85.84, 20.68], [85.58, 20.78], [85.32, 20.88],
  [85.06, 21.0], [84.8, 21.1], [84.54, 21.22], [84.28, 21.32], [84.04, 21.44],
  [83.8, 21.56], [83.6, 21.7], [83.4, 21.86], [83.2, 22.04], [83.02, 22.22],
  [82.86, 22.4], [82.72, 22.58], [82.6, 22.76], [82.52, 22.96], [82.48, 23.16],
  [82.44, 23.38], [82.38, 23.6], [82.3, 23.82], [82.22, 24.04], [82.14, 24.26],
  [82.08, 24.48], [82.06, 24.7], [82.02, 24.92], [81.94, 25.14], [81.86, 25.36],
  [81.8, 25.58], [81.76, 25.8], [81.72, 26.02], [81.66, 26.24], [81.58, 26.46],
  [81.5, 26.68], [81.4, 26.9], [81.24, 27.06], [81.06, 27.16], [80.88, 27.22],
  [80.7, 27.3], [80.54, 27.42], [80.4, 27.58], [80.28, 27.76], [80.18, 27.94],
  [80.12, 28.12], [80.1, 28.3], [80.08, 28.48],
  // ── Western border — Uttar Pradesh / Uttarakhand ──
  [80.12, 28.66], [80.18, 28.82], [80.24, 28.96], [80.28, 29.12], [80.3, 29.28],
  [80.34, 29.42], [80.38, 29.56], [80.4, 29.7], [80.36, 29.86], [80.28, 30.02],
  [80.2, 30.18], [80.15, 30.32],
];

/** Named rivers, drawn as flow lines. Coarse courses, not navigational charts. */
export const RIVERS: readonly { id: string; name: string; ne: string; path: LonLat[] }[] = [
  {
    id: 'koshi', name: 'Koshi', ne: 'कोशी',
    path: [[88.94, 28.0], [88.6, 27.6], [88.1, 27.2], [87.6, 26.8], [87.2, 26.5], [86.9, 26.4], [86.6, 26.35]],
  },
  {
    id: 'bagmati', name: 'Bagmati', ne: 'बागमती',
    path: [[85.6, 28.35], [85.3, 27.95], [85.15, 27.72], [84.95, 27.3], [84.65, 26.6], [84.55, 26.1], [84.45, 25.7], [84.3, 25.2]],
  },
  {
    id: 'gandaki', name: 'Gandaki', ne: 'गण्डकी',
    path: [[83.85, 28.75], [83.72, 28.55], [83.55, 28.2], [83.3, 27.85], [83.05, 27.5], [82.75, 27.2], [82.5, 26.9], [82.2, 26.5], [81.9, 26.1], [81.7, 25.6], [81.75, 25.0], [81.65, 24.5], [81.45, 23.9], [81.3, 23.2], [81.05, 22.7]],
  },
  {
    id: 'karnali', name: 'Karnali', ne: 'कर्णाली',
    path: [[82.6, 30.0], [82.3, 29.6], [81.95, 29.3], [81.75, 28.9], [81.62, 28.5], [81.6, 28.1], [81.55, 27.8], [81.4, 27.4], [81.15, 27.0], [80.95, 26.7], [80.75, 26.5], [80.55, 26.4], [80.25, 26.35]],
  },
  {
    id: 'kali', name: 'Mahakali', ne: 'महाकाली',
    path: [[80.9, 30.1], [80.6, 29.7], [80.4, 29.3], [80.24, 28.96], [80.12, 28.66], [80.08, 28.3]],
  },
];

/** Equirectangular projection scaled to a viewBox. Accurate at national scale. */
export function project(lon: number, lat: number, w: number, h: number): [number, number] {
  const [minLon, minLat, maxLon, maxLat] = NEPAL_BBOX;
  // Constant latitude correction keeps the aspect ratio geographically honest.
  const midLat = (minLat + maxLat) / 2;
  const kx = Math.cos((midLat * Math.PI) / 180);
  const x = ((lon - minLon) / (maxLon - minLon)) * w * kx + ((1 - kx) / 2) * w;
  const y = ((maxLat - lat) / (maxLat - minLat)) * h;
  return [x, y];
}

/** Closed Catmull-Rom spline → cubic Bézier, for a smooth national outline. */
function closedSpline(points: [number, number][], tension = 0.5): string {
  const n = points.length;
  if (n < 3) return '';
  let d = `M${points[0][0].toFixed(2)},${points[0][1].toFixed(2)}`;
  for (let i = 0; i < n; i++) {
    const p0 = points[(i - 1 + n) % n];
    const p1 = points[i];
    const p2 = points[(i + 1) % n];
    const p3 = points[(i + 2) % n];
    const c1x = p1[0] + ((p2[0] - p0[0]) / 6) * tension;
    const c1y = p1[1] + ((p2[1] - p0[1]) / 6) * tension;
    const c2x = p2[0] - ((p3[0] - p1[0]) / 6) * tension;
    const c2y = p2[1] - ((p3[1] - p1[1]) / 6) * tension;
    d += `C${c1x.toFixed(2)},${c1y.toFixed(2)} ${c2x.toFixed(2)},${c2y.toFixed(2)} ${p2[0].toFixed(2)},${p2[1].toFixed(2)}`;
  }
  return `${d}Z`;
}

/** Open Catmull-Rom spline → cubic Bézier, for rivers. */
function openSpline(points: [number, number][]): string {
  const n = points.length;
  if (n < 2) return '';
  let d = `M${points[0][0].toFixed(2)},${points[0][1].toFixed(2)}`;
  for (let i = 0; i < n - 1; i++) {
    const p0 = points[Math.max(0, i - 1)];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[Math.min(n - 1, i + 2)];
    const c1x = p1[0] + ((p2[0] - p0[0]) / 6) * 0.5;
    const c1y = p1[1] + ((p2[1] - p0[1]) / 6) * 0.5;
    const c2x = p2[0] - ((p3[0] - p1[0]) / 6) * 0.5;
    const c2y = p2[1] - ((p3[1] - p1[1]) / 6) * 0.5;
    d += `C${c1x.toFixed(2)},${c1y.toFixed(2)} ${c2x.toFixed(2)},${c2y.toFixed(2)} ${p2[0].toFixed(2)},${p2[1].toFixed(2)}`;
  }
  return d;
}

export const MAP_W = 760;
export const MAP_H = 400;

export function borderPath(): string {
  return closedSpline(NEPAL_BORDER.map(([lon, lat]) => project(lon, lat, MAP_W, MAP_H)));
}

export function riverPaths(): { id: string; name: string; ne: string; d: string }[] {
  return RIVERS.map((r) => ({
    id: r.id,
    name: r.name,
    ne: r.ne,
    d: openSpline(r.path.map(([lon, lat]) => project(lon, lat, MAP_W, MAP_H))),
  }));
}

/** Screen point for any coordinate. */
export function point(lon: number, lat: number): { x: number; y: number } {
  const [x, y] = project(lon, lat, MAP_W, MAP_H);
  return { x, y };
}
