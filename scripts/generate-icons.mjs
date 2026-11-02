// Dev-only tool: renders the app icon as flat-color PNGs using a hand-rolled
// encoder (zlib for deflate, everything else is built-in) so icon generation
// needs no image-processing dependency. Re-run after changing the design below.
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, '..', 'icons');
mkdirSync(OUT_DIR, { recursive: true });

const VOID = [6, 10, 19, 255]; // --void (dark theme ground)
const MINT = [60, 240, 200, 255]; // --c-mint (the ring)
const AMBER = [255, 181, 71, 255]; // --c-amber (the data point)

function insideRoundedRect(x, y, x0, y0, x1, y1, r) {
  if (x < x0 || x > x1 || y < y0 || y > y1) return false;
  const inCornerX = x < x0 + r || x > x1 - r;
  const inCornerY = y < y0 + r || y > y1 - r;
  if (inCornerX && inCornerY) {
    const cx = x < x0 + r ? x0 + r : x1 - r;
    const cy = y < y0 + r ? y0 + r : y1 - r;
    const dx = x - cx;
    const dy = y - cy;
    return dx * dx + dy * dy <= r * r;
  }
  return true;
}

function insideCircle(x, y, cx, cy, r) {
  const dx = x - cx;
  const dy = y - cy;
  return dx * dx + dy * dy <= r * r;
}

function coverage(px, py, testFn, samples = 4) {
  let hits = 0;
  for (let sy = 0; sy < samples; sy++) {
    for (let sx = 0; sx < samples; sx++) {
      const x = px + (sx + 0.5) / samples;
      const y = py + (sy + 0.5) / samples;
      if (testFn(x, y)) hits++;
    }
  }
  return hits / (samples * samples);
}

function over(base, color, alpha) {
  const a = alpha;
  return [
    Math.round(color[0] * a + base[0] * (1 - a)),
    Math.round(color[1] * a + base[1] * (1 - a)),
    Math.round(color[2] * a + base[2] * (1 - a)),
    255,
  ];
}

// Oracle mark: an open mint "O" ring with round ends, and an amber data point
// sitting in the gap at the upper right: insight into your own numbers.
// Defined on a 512 baseline; everything stays inside the maskable safe zone
// (a centred circle of radius ~205).
const C = 256, R = 144, HALF_W = 27; // ring centre line radius and half stroke
const GAP_FROM = (12 * Math.PI) / 180, GAP_TO = (78 * Math.PI) / 180; // gap, math angles (y up)
const CAP = (a) => ({ x: C + R * Math.cos(a), y: C - R * Math.sin(a) });
const DOT = { ...CAP((45 * Math.PI) / 180), r: 38 };

function onRing(px, py) {
  const dx = px - C, dy = C - py;
  const d = Math.hypot(dx, dy);
  if (Math.abs(d - R) <= HALF_W) {
    let a = Math.atan2(dy, dx);
    if (a < 0) a += 2 * Math.PI;
    if (a < GAP_FROM || a > GAP_TO) return true;
  }
  // round caps at both ends of the gap
  return [GAP_FROM, GAP_TO].some((a) => insideCircle(px, py, CAP(a).x, CAP(a).y, HALF_W));
}

function pixelAt(x, y, size) {
  const k = 512 / size;
  const test = (fn) => coverage(x, y, (px, py) => fn(px * k, py * k));
  let color = VOID;
  const ring = test(onRing);
  if (ring > 0) color = over(color, MINT, ring);
  const dot = test((px, py) => insideCircle(px, py, DOT.x, DOT.y, DOT.r));
  if (dot > 0) color = over(color, AMBER, dot);
  return color;
}

// ---- minimal PNG encoder (RGBA8, no interlace) ----
const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}
function encodePng(width, height, getPixel) {
  const raw = Buffer.alloc((width * 4 + 1) * height);
  let o = 0;
  for (let y = 0; y < height; y++) {
    raw[o++] = 0;
    for (let x = 0; x < width; x++) {
      const [r, g, b, a] = getPixel(x, y);
      raw[o++] = r;
      raw[o++] = g;
      raw[o++] = b;
      raw[o++] = a;
    }
  }
  const idat = deflateSync(raw, { level: 9 });
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function renderIcon(size, filename) {
  const png = encodePng(size, size, (x, y) => pixelAt(x, y, size));
  writeFileSync(path.join(OUT_DIR, filename), png);
  console.log(`wrote icons/${filename} (${size}x${size}, ${(png.length / 1024).toFixed(1)} KB)`);
}

renderIcon(192, 'icon-192.png');
renderIcon(512, 'icon-512.png');
renderIcon(512, 'icon-maskable-512.png');
renderIcon(180, 'apple-touch-icon.png');
