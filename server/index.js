/**
 * Nexa optional API — a thin, dependency-light Node service.
 *
 * Two jobs only:
 *   1. Hold the Gemini key server-side and proxy streaming calls to
 *      generativelanguage.googleapis.com, so a browser key is never required.
 *   2. Optionally persist citizen signals as JSON, so several devices/browsers
 *      can contribute to one shared (unverified) dataset.
 *
 * Everything degrades gracefully: the static site is fully functional without
 * this service running.
 */

import express from 'express';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DATA_DIR = path.join(ROOT, 'data');
const SIGNALS_FILE = path.join(DATA_DIR, 'signals.json');

/** Minimal .env loader so local dev needs no dotenv dependency. */
async function loadEnv() {
  try {
    const raw = await fs.readFile(path.join(ROOT, '.env'), 'utf8');
    for (const line of raw.split('\n')) {
      const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i.exec(line);
      if (!m || line.trim().startsWith('#')) continue;
      const value = m[2].replace(/^["']|["']$/g, '');
      if (process.env[m[1]] === undefined) process.env[m[1]] = value;
    }
  } catch {
    /* no .env — rely on the real environment */
  }
}
await loadEnv();

const PORT = Number(process.env.PORT) || 8787;
const HOST = process.env.HOST || '0.0.0.0';
const GEMINI_KEY = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '';
const GEMINI_ROOT = 'https://generativelanguage.googleapis.com/v1beta';
const MAX_SIGNALS = 5000;
const SIGNAL_TTL_MS = 1000 * 60 * 60 * 24 * 90; // 90 days

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '1mb' }));

/* ────────────────────────────── tiny logger ───────────────────────────── */

const started = Date.now();
const log = (...args) => console.log(`[nexa ${new Date().toISOString().slice(11, 19)}]`, ...args);

/* ───────────────────────────── model registry ─────────────────────────── */

let modelCache = null;
let modelCacheAt = 0;
const MODEL_TTL_MS = 1000 * 60 * 30;

/** Preference order by capability family, newest generation first. */
const PREFERRED = [/gemini-3/, /gemini-2\.5-flash/, /gemini-2\.5-pro/, /gemini-2\.0-flash/, /gemini-flash/];

function scoreModel(name) {
  const id = name.replace(/^models\//, '');
  let score = 0;
  for (let i = 0; i < PREFERRED.length; i++) {
    if (PREFERRED[i].test(id)) {
      score += (PREFERRED.length - i) * 10;
      break;
    }
  }
  if (/flash-lite/.test(id)) score -= 6;
  if (/embedding|vision-only|aqa|imagen|veo/.test(id)) score -= 100;
  if (/(latest|exp)/.test(id)) score += 1;
  return score;
}

async function listModels() {
  if (!GEMINI_KEY) return [];
  if (modelCache && Date.now() - modelCacheAt < MODEL_TTL_MS) return modelCache;
  try {
    const res = await fetch(`${GEMINI_ROOT}/models?key=${encodeURIComponent(GEMINI_KEY)}`, {
      headers: { 'x-goog-api-key': GEMINI_KEY },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    modelCache = (data.models ?? [])
      .filter((m) => /generateContent|streamGenerateContent/.test(m.supportedGenerationMethods ?? []).join(','))
      .map((m) => ({
        id: m.name,
        label: m.displayName ?? m.name.replace(/^models\//, ''),
        kind: (m.version ?? 'gemini').split('-')[0],
        score: scoreModel(m.name),
      }))
      .sort((a, b) => b.score - a.score)
      .map(({ id, label, kind }) => ({ id, label, kind }));
    modelCacheAt = Date.now();
    log('models discovered:', modelCache.length);
    return modelCache;
  } catch (err) {
    log('model discovery failed:', err.message);
    return [];
  }
}

/* ──────────────────────────────── routes ──────────────────────────────── */

app.get('/api/health', async (_req, res) => {
  res.json({
    ok: true,
    hasKey: Boolean(GEMINI_KEY),
    models: await listModels(),
    version: '1.0.0',
    uptime: Math.round((Date.now() - started) / 1000),
    signals: (await readSignals()).length,
  });
});

/**
 * POST /api/ai/stream
 * body: { systemInstruction, contents, tools, json }
 * Streams Gemini's SSE straight through, adding modelVersion to each chunk so
 * the client can display which model answered.
 */
app.post('/api/ai/stream', async (req, res) => {
  if (!GEMINI_KEY) return fail(res, 503, 'no-key', 'GEMINI_API_KEY is not set on the server.');

  const { systemInstruction = '', contents = [], tools = false, json = false } = req.body ?? {};
  if (!Array.isArray(contents) || contents.length === 0) {
    return fail(res, 400, 'bad-request', 'contents[] is required.');
  }

  const models = await listModels();
  const chain = models.length ? models.map((m) => m.id) : [];
  if (chain.length === 0) chain.push('models/gemini-2.5-flash');

  res.set({
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.flushHeaders?.();

  let lastError = null;
  for (const model of chain) {
    try {
      const generationConfig = {
        temperature: 0.55,
        topP: 0.92,
        maxOutputTokens: 2048,
      };
      if (json) {
        generationConfig.responseMimeType = 'application/json';
        generationConfig.temperature = 0.2;
      }

      const body = {
        systemInstruction: { parts: [{ text: String(systemInstruction) }] },
        contents: contents.map((c) => ({
          role: c.role === 'model' ? 'model' : 'user',
          parts: (c.parts ?? []).filter((p) => typeof p.text === 'string' || p.functionCall),
        })),
        generationConfig,
      };
      if (tools) {
        body.tools = [
          {
            functionDeclarations: [
              { name: 'get_district', description: 'Full civic profile for one of Nepal\'s 77 districts.', parameters: { type: 'OBJECT', properties: { id: { type: 'STRING', description: 'District slug, e.g. bhaktapur' } }, required: ['id'] } },
              { name: 'list_districts', description: 'Districts ranked by a given index, worst first.', parameters: { type: 'OBJECT', properties: { metric: { type: 'STRING', description: 'Index name, e.g. floodRisk' }, province: { type: 'STRING' }, limit: { type: 'INTEGER' } }, required: ['metric'] } },
              { name: 'get_sector', description: 'Definition, indicators and solutions for one of the nine sectors.', parameters: { type: 'OBJECT', properties: { id: { type: 'STRING' } }, required: ['id'] } },
              { name: 'national_overview', description: 'National indicators, monsoon risks and emergency numbers.', parameters: { type: 'OBJECT', properties: {} } },
            ],
          },
        ];
        body.toolConfig = { functionCallingConfig: { mode: 'AUTO' } };
      }

      const url = `${GEMINI_ROOT}/${model}:streamGenerateContent?alt=sse&key=${encodeURIComponent(GEMINI_KEY)}`;
      const upstream = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': GEMINI_KEY },
        body: JSON.stringify(body),
        signal: req.signal,
      });

      if (!upstream.ok || !upstream.body) {
        const detail = await upstream.text().catch(() => '');
        lastError = `HTTP ${upstream.status} ${detail.slice(0, 200)}`;
        log(`${model} → ${lastError}`);
        continue; // try the next model in the chain
      }

      log(`${model} → streaming`);
      const reader = upstream.body.getReader();
      const decoder = new TextDecoder();
      let wrote = false;
      let produced = false;

      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        const frame = decoder.decode(value, { stream: true });
        for (const line of frame.split('\n')) {
          if (!line.startsWith('data:')) continue;
          const payload = line.slice(5).trim();
          if (!payload || payload === '[DONE]') continue;
          try {
            const chunk = JSON.parse(payload);
            chunk.modelVersion = model.replace(/^models\//, '');
            const usable = chunk.candidates?.some((c) =>
              c.content?.parts?.some((p) => typeof p.text === 'string' || p.functionCall),
            );
            if (usable) produced = true;
            res.write(`data: ${JSON.stringify(chunk)}\n\n`);
            wrote = true;
          } catch {
            /* partial frame */
          }
        }
      }

      // A model that returned nothing usable is treated as a failed attempt.
      if (!produced && !wrote) {
        lastError = `${model} returned no usable content`;
        log(lastError);
        continue;
      }

      res.write('data: [DONE]\n\n');
      return res.end();
    } catch (err) {
      lastError = err.message;
      log(`${model} → ${err.message}`);
    }
  }

  if (!res.headersSent) return fail(res, 502, 'upstream', lastError ?? 'Gemini did not respond.');
  res.write('data: [DONE]\n\n');
  res.end();
});

/* ─────────────────────────── signal persistence ────────────────────────── */

async function readSignals() {
  try {
    const raw = await fs.readFile(SIGNALS_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : Array.isArray(parsed.signals) ? parsed.signals : [];
  } catch {
    return [];
  }
}

let writeChain = Promise.resolve();
function writeSignals(all) {
  // Serialise writes so concurrent posts cannot interleave and corrupt the file.
  writeChain = writeChain.then(async () => {
    await fs.mkdir(DATA_DIR, { recursive: true });
    const trimmed = all.slice(0, MAX_SIGNALS);
    await fs.writeFile(SIGNALS_FILE, JSON.stringify({ updatedAt: Date.now(), signals: trimmed }, null, 2), 'utf8');
  }).catch((err) => log('write failed:', err.message));
  return writeChain;
}

function sanitiseSignal(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const title = String(raw.title ?? '').trim().slice(0, 140);
  const detail = String(raw.detail ?? '').trim().slice(0, 2000);
  if (title.length < 6 || detail.length < 12) return null;

  const severity = Math.min(5, Math.max(1, Number(raw.severity) || 3));
  const lat = Number(raw.lat);
  const lon = Number(raw.lon);

  return {
    id: String(raw.id ?? '').slice(0, 64) || randomUUID(),
    sector: String(raw.sector ?? 'other').slice(0, 40),
    district: String(raw.district ?? '').slice(0, 60),
    city: raw.city ? String(raw.city).slice(0, 60) : undefined,
    title,
    detail,
    severity,
    lat: Number.isFinite(lat) ? lat : 27.7,
    lon: Number.isFinite(lon) ? lon : 85.32,
    createdAt: Number(raw.createdAt) || Date.now(),
    synced: true,
    aiSummary: raw.aiSummary ? String(raw.aiSummary).slice(0, 400) : undefined,
    aiActions: Array.isArray(raw.aiActions) ? raw.aiActions.slice(0, 6).map((a) => String(a).slice(0, 160)) : undefined,
  };
}

app.get('/api/signals', async (_req, res) => {
  const cutoff = Date.now() - SIGNAL_TTL_MS;
  res.json({ ok: true, signals: (await readSignals()).filter((s) => (s.createdAt ?? 0) > cutoff) });
});

app.post('/api/signals', async (req, res) => {
  const incoming = Array.isArray(req.body?.signals) ? req.body.signals : [req.body];
  const valid = incoming.map(sanitiseSignal).filter(Boolean);
  if (valid.length === 0) return fail(res, 400, 'bad-request', 'No valid signals received.');

  const existing = await readSignals();
  const merged = new Map();
  for (const s of [...existing, ...valid]) merged.set(s.id, s);

  const cutoff = Date.now() - SIGNAL_TTL_MS;
  const kept = [...merged.values()].filter((s) => (s.createdAt ?? 0) > cutoff).sort((a, b) => b.createdAt - a.createdAt);
  await writeSignals(kept);

  log(`signals: +${valid.length} → ${kept.length} total`);
  res.json({ ok: true, pushed: valid.length, signals: kept });
});

app.delete('/api/signals/:id', async (req, res) => {
  const kept = (await readSignals()).filter((s) => s.id !== req.params.id);
  await writeSignals(kept);
  res.json({ ok: true, signals: kept });
});

/* ───────────────────────────────── misc ───────────────────────────────── */

app.use('/api', (_req, res) => fail(res, 404, 'not-found', 'Unknown API route.'));

app.use((err, _req, res, _next) => {
  log('unhandled:', err.message);
  if (!res.headersSent) fail(res, 500, 'server', 'Unexpected server error.');
});

function fail(res, status, kind, message) {
  return res.status(status).json({ ok: false, error: { kind, message } });
}

const server = app.listen(PORT, HOST, () => {
  log(`Nexa API on http://localhost:${PORT}`);
  log(GEMINI_KEY ? 'Gemini key loaded (kept server-side).' : 'No GEMINI_API_KEY — /api/ai/stream will return 503.');
});

for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => {
    log(`${sig} received, closing.`);
    server.close(() => process.exit(0));
  });
}