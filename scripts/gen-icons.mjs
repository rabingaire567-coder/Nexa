/**
 * Generates Nexa's raster brand assets with no image dependencies.
 *
 * Run: node scripts/gen-icons.mjs
 * Writes: public/icon-192.png, icon-512.png, icon-maskable-512.png,
 *         apple-touch-icon.png, og-image.png
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PUBLIC = path.join(ROOT, 'public');

/* ───────────────────────────── PNG encoder ────────────────────────────── */

const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function encodePng(width, height, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0; // filter: none
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/* ──────────────────────────────── drawing ─────────────────────────────── */

const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const CRIMSON = hex('#9b1b3f');
const NAVY = hex('#16224a');
const SAFFRON = hex('#f0a500');
const CYAN = hex('#35c6e8');
const SNOW = hex('#f7f9fc');

const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

function inTri(px, py, [ax, ay], [bx, by], [cx, cy]) {
  const d = (by - cy) * (ax - cx) + (cx - bx) * (ay - cy);
  if (Math.abs(d) < 1e-9) return false;
  const a = ((by - cy) * (px - cx) + (cx - bx) * (py - cy)) / d;
  const b = ((cy - ay) * (px - cx) + (ax - cx) * (py - cy)) / d;
  const c = 1 - a - b;
  return a >= 0 && b >= 0 && c >= 0;
}

const inCircle = (px, py, cx, cy, r) => (px - cx) ** 2 + (py - cy) ** 2 <= r * r;

/**
 * The Nexa mark: a Himalayan ridge under a rising sun.
 * `mark` is the sub-rectangle (0-1, relative to the canvas) the mark occupies.
 */
function markPixel(u, v, mark) {
  const [mx, my, ms] = mark;
  const x = (u - mx) / ms;
  const y = (v - my) / ms;
  if (x < 0 || x > 1 || y < 0 || y > 1) return null;

  // ridge: two peaks
  const p1 = inTri(x, y, [0.5, 0.36], [0.14, 0.84], [0.64, 0.84]);
  const p2 = inTri(x, y, [0.74, 0.5], [0.5, 0.84], [0.9, 0.84]);
  if (p1 || p2) {
    const apex = p1 ? 0.36 : 0.5;
    // snow cap near the summit, shaded face below
    if (y < apex + 0.08) return SNOW;
    return mix(SNOW, NAVY, Math.min(0.42, (y - apex) * 0.9));
  }

  // rising sun
  if (inCircle(x, y, 0.5, 0.2, 0.085)) return CYAN;
  return null;
}

function roundedInside(u, v, radius) {
  const cx = Math.min(Math.max(u, radius), 1 - radius);
  const cy = Math.min(Math.max(v, radius), 1 - radius);
  return (u - cx) ** 2 + (v - cy) ** 2 <= radius * radius || (u >= radius && u <= 1 - radius) || (v >= radius && v <= 1 - radius);
}

function renderIcon(size, { maskable = false } = {}) {
  const buf = Buffer.alloc(size * size * 4);
  const pad = maskable ? 0.14 : 0.06;
  const radius = maskable ? 0 : 0.235;
  const mark = [pad, pad + 0.01, 1 - pad * 2];

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = (x + 0.5) / size;
      const v = (y + 0.5) / size;
      const i = (y * size + x) * 4;

      if (radius > 0 && !roundedInside(u, v, radius)) continue; // transparent outside

      // diagonal gradient background: crimson (top-left) → navy (bottom-right)
      const t = Math.min(1, (u * 0.45 + v * 0.75));
      let [r, g, b] = mix(CRIMSON, NAVY, t);
      // warm glow behind the sun
      const d = Math.hypot(u - 0.5, v - 0.26);
      if (d < 0.42) [r, g, b] = mix([r, g, b], SAFFRON, 0.16 * (1 - d / 0.42) ** 2);

      const m = markPixel(u, v, mark);
      if (m) [r, g, b] = m;

      buf[i] = Math.round(r);
      buf[i + 1] = Math.round(g);
      buf[i + 2] = Math.round(b);
      buf[i + 3] = radius > 0 || roundedInside(u, v, radius) ? 255 : 0;
    }
  }
  return encodePng(size, size, buf);
}

function renderOg() {
  const w = 1200;
  const h = 630;
  const buf = Buffer.alloc(w * h * 4);

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const u = x / w;
      const v = y / h;
      const i = (y * w + x) * 4;
      const t = Math.min(1, u * 0.35 + v * 0.8);
      let [r, g, b] = mix(hex('#7d1233'), hex('#0d1533'), t);
      // faint diagonal light streak
      if (Math.abs((u + v) - 0.85) < 0.035) [r, g, b] = mix([r, g, b], CYAN, 0.1);

      // mark, left third
      const m = markPixel(u, v, [0.07, 0.16, 0.5]);
      if (m) [r, g, b] = m;

      // abstract "indicator bars" on the right
      const bx = 0.66;
      const bars = [
        { y: 0.42, h: 0.34, c: CRIMSON },
        { y: 0.54, h: 0.22, c: SAFFRON },
        { y: 0.62, h: 0.14, c: CYAN },
      ];
      for (const bar of bars) {
        if (u > bx && u < bx + 0.26 && v > bar.y && v < bar.y + bar.h) {
          [r, g, b] = bar.c;
        }
      }
      // baseline rule
      if (v > 0.79 && v < 0.795 && u > 0.66 && u < 0.92) [r, g, b] = SNOW;

      buf[i] = Math.round(r);
      buf[i + 1] = Math.round(g);
      buf[i + 2] = Math.round(b);
      buf[i + 3] = 255;
    }
  }
  return encodePng(w, h, buf);
}

/* ────────────────────────────────── run ───────────────────────────────── */

await fs.mkdir(PUBLIC, { recursive: true });

const jobs = [
  ['icon-192.png', renderIcon(192)],
  ['icon-512.png', renderIcon(512)],
  ['icon-maskable-512.png', renderIcon(512, { maskable: true })],
  ['apple-touch-icon.png', renderIcon(180)],
  ['og-image.png', renderOg()],
];

for (const [name, data] of jobs) {
  await fs.writeFile(path.join(PUBLIC, name), data);
  console.log(`${name.padEnd(24)} ${(data.length / 1024).toFixed(1)} kB`);
}
console.log('done.');