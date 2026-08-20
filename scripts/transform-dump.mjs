import fs from 'node:fs';
import readline from 'node:readline';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';

const IN = process.argv[2] ?? 'data/case_tech_lead.sql';
const OUT = process.argv[3] ?? 'data/channel_events.csv';
const WINDOW_START = new Date(`${process.env.WINDOW_START ?? '2024-01-01'}T00:00:00Z`);
const WINDOW_MONTHS = Number(process.env.WINDOW_MONTHS ?? 24);

const ROW = /\((\d+),'([^']*)',(\d+)\)/;
const DAY_MS = 86400000;

const WINDOW_END = new Date(WINDOW_START);
WINDOW_END.setUTCMonth(WINDOW_END.getUTCMonth() + WINDOW_MONTHS);
const TOTAL_DAYS = Math.round((WINDOW_END - WINDOW_START) / DAY_MS);

const WEEKDAY_FACTOR = [0.35, 1.0, 1.08, 1.06, 1.04, 0.95, 0.45];
const HOUR_WEIGHTS = [
  4, 2, 1, 1, 1, 2, 6, 18, 38, 62, 78, 82,
  70, 66, 80, 84, 76, 58, 42, 34, 28, 20, 12, 7,
];

function buildCdf(weights) {
  const cdf = new Float64Array(weights.length);
  let acc = 0;
  for (let i = 0; i < weights.length; i++) cdf[i] = acc += weights[i];
  for (let i = 0; i < cdf.length; i++) cdf[i] /= acc;
  return cdf;
}

function dayWeights() {
  const w = new Float64Array(TOTAL_DAYS);
  for (let d = 0; d < TOTAL_DAYS; d++) {
    const date = new Date(WINDOW_START.getTime() + d * DAY_MS);
    const weekday = WEEKDAY_FACTOR[date.getUTCDay()];
    const season = 1 + 0.22 * Math.sin((2 * Math.PI * d) / 365.25 - Math.PI / 3);
    const growth = 1 + 0.55 * (d / TOTAL_DAYS);
    w[d] = weekday * season * growth;
  }
  return w;
}

const DAY_CDF = buildCdf(dayWeights());
const HOUR_CDF = buildCdf(HOUR_WEIGHTS);

function pickFromCdf(cdf, frac) {
  let lo = 0;
  let hi = cdf.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (cdf[mid] < frac) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

function mix32(n) {
  let h = n | 0;
  h = Math.imul(h ^ (h >>> 16), 0x21f0aaad);
  h = Math.imul(h ^ (h >>> 15), 0x735a2d97);
  return (h ^ (h >>> 15)) >>> 0;
}

function rankOf(sorted, id) {
  let lo = 0;
  let hi = sorted.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (sorted[mid] < id) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

async function* readRows(path) {
  const rl = readline.createInterface({
    input: fs.createReadStream(path, { highWaterMark: 1 << 22 }),
    crlfDelay: Infinity,
  });
  for await (const line of rl) {
    const m = ROW.exec(line);
    if (m) yield m;
  }
}

async function collectIds(path) {
  let cap = 1 << 20;
  let ids = new Float64Array(cap);
  let n = 0;
  for await (const m of readRows(path)) {
    if (n === cap) {
      cap *= 2;
      const next = new Float64Array(cap);
      next.set(ids);
      ids = next;
    }
    ids[n++] = Number(m[1]);
  }
  const out = ids.subarray(0, n);
  out.sort();
  return out;
}

async function* emitRows(path, sortedIds) {
  const total = sortedIds.length;
  let buf = '';
  let n = 0;
  for await (const m of readRows(path)) {
    const id = Number(m[1]);
    const channel = m[2].trim().toLowerCase();
    const statusId = m[3];

    const frac = (rankOf(sortedIds, id) + 0.5) / total;
    const day = pickFromCdf(DAY_CDF, frac);

    const seed = mix32(id);
    const hour = pickFromCdf(HOUR_CDF, (seed % 100000) / 100000);
    const minute = (seed >>> 7) % 60;
    const second = (seed >>> 13) % 60;

    const ts = new Date(
      WINDOW_START.getTime() + day * DAY_MS + hour * 3600000 + minute * 60000 + second * 1000,
    );

    buf += `${id},${channel},${statusId},${ts.toISOString()}\n`;
    if (++n % 20000 === 0) {
      yield buf;
      buf = '';
    }
  }
  if (buf) yield buf;
}

const t0 = Date.now();
process.stderr.write(`scanning ${IN}\n`);
const sortedIds = await collectIds(IN);
process.stderr.write(
  `rows=${sortedIds.length} id=[${sortedIds[0]}..${sortedIds[sortedIds.length - 1]}] ` +
    `days=${TOTAL_DAYS} window=${WINDOW_START.toISOString().slice(0, 10)}..${WINDOW_END.toISOString().slice(0, 10)} ` +
    `(${((Date.now() - t0) / 1000).toFixed(1)}s)\n`,
);

await pipeline(Readable.from(emitRows(IN, sortedIds)), fs.createWriteStream(OUT));
process.stderr.write(`wrote ${OUT} in ${((Date.now() - t0) / 1000).toFixed(1)}s\n`);
