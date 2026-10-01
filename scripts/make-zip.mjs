/**
 * Packs the project into Nexa.zip using Node's built-in deflate.
 * Run: npm run zip
 *
 * Keeps the archive human-readable and portable: no node_modules, no build
 * output, no git metadata, no secrets.
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import process from 'node:process';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'Nexa.zip');

/**
 * `preview/` is kept even though it is only screenshots, because README.md
 * embeds those images and the archive should render standalone. It costs 6 files
 * and still leaves the project far under the 100-file ceiling.
 */
const SKIP_DIRS = new Set(['node_modules', 'dist', '.git', '.cache', '.vscode', '.idea', 'coverage', '.vercel']);
const SKIP_FILES = new Set(['Nexa.zip', 'signals.json', '.env', '.env.local', 'tsconfig.tsbuildinfo']);
const MAX_FILES = 100;

async function walk(dir, rel = '') {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const abs = path.join(dir, entry.name);
    const relPath = rel ? `${rel}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      files.push(...(await walk(abs, relPath)));
    } else if (entry.isFile()) {
      if (SKIP_FILES.has(entry.name) || entry.name.endsWith('.log') || entry.name.endsWith('.tsbuildinfo') || entry.name.endsWith('.tmp.mjs')) continue;
      files.push({ abs, rel: relPath });
    }
  }
  return files;
}

/* ─────────────────────────────── ZIP writer ───────────────────────────── */

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

function dosDateTime(date) {
  const time = ((date.getHours() & 31) << 11) | ((date.getMinutes() & 63) << 5) | ((date.getSeconds() / 2) & 31);
  const day = (((date.getFullYear() - 1980) & 127) << 9) | (((date.getMonth() + 1) & 15) << 5) | (date.getDate() & 31);
  return { time, day };
}

const files = await walk(ROOT);
files.sort((a, b) => a.rel.localeCompare(b.rel));

if (files.length >= MAX_FILES) {
  console.error(`Refusing to zip: ${files.length} files reaches the ${MAX_FILES}-file limit (must stay under it).`);
  process.exit(1);
}

const now = new Date();
const { time, day } = dosDateTime(now);
const locals = [];
const centrals = [];
let offset = 0;

for (const f of files) {
  const nameBuf = Buffer.from(`Nexa/${f.rel}`, 'utf8');
  const raw = await fs.readFile(f.abs);
  const deflated = zlib.deflateRawSync(raw, { level: 9 });
  const useDeflate = deflated.length < raw.length;
  const data = useDeflate ? deflated : raw;
  const method = useDeflate ? 8 : 0;
  const crc = crc32(raw);

  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50, 0);
  local.writeUInt16LE(20, 4); // version needed
  local.writeUInt16LE(0x0800, 6); // UTF-8 names
  local.writeUInt16LE(method, 8);
  local.writeUInt16LE(time, 10);
  local.writeUInt16LE(day, 12);
  local.writeUInt32LE(crc, 14);
  local.writeUInt32LE(data.length, 18);
  local.writeUInt32LE(raw.length, 22);
  local.writeUInt16LE(nameBuf.length, 26);
  local.writeUInt16LE(0, 28);

  locals.push(local, nameBuf, data);

  const central = Buffer.alloc(46);
  central.writeUInt32LE(0x02014b50, 0);
  central.writeUInt16LE(20, 4); // version made by
  central.writeUInt16LE(20, 6); // version needed
  central.writeUInt16LE(0x0800, 8);
  central.writeUInt16LE(method, 10);
  central.writeUInt16LE(time, 12);
  central.writeUInt16LE(day, 14);
  central.writeUInt32LE(crc, 16);
  central.writeUInt32LE(data.length, 20);
  central.writeUInt32LE(raw.length, 24);
  central.writeUInt16LE(nameBuf.length, 28);
  central.writeUInt32LE(offset, 42);

  centrals.push(central, nameBuf);
  offset += local.length + nameBuf.length + data.length;
}

const centralBuf = Buffer.concat(centrals);
const end = Buffer.alloc(22);
end.writeUInt32LE(0x06054b50, 0);
end.writeUInt16LE(files.length, 8);
end.writeUInt16LE(files.length, 10);
end.writeUInt32LE(centralBuf.length, 12);
end.writeUInt32LE(offset, 16);

await fs.writeFile(OUT, Buffer.concat([...locals, centralBuf, end]));
const { size } = await fs.stat(OUT);

console.log(`Nexa.zip written — ${files.length} files, ${(size / 1024).toFixed(1)} kB`);

if (process.platform === 'win32') {
  spawn('explorer.exe', [OUT], { detached: true, stdio: 'ignore' }).unref();
} else {
  console.log(OUT);
}