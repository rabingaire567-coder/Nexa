import type { ChatMessage, NexaModel } from '@/types';
import {
  cities,
  districtById,
  districts,
  nationalFile,
  provinceById,
  provinces,
  sectorById,
  sectors,
  severityOf,
  SECTOR_IDS,
} from './nepal';
import type { City, District, Sector, SectorId } from '@/types';
import { loadApiKey, loadSettings } from './db';
import { uid } from './utils';

/**
 * Nexa AI client.
 *
 * Two transports, one interface:
 *   1. `/api/ai/*` — the bundled Node service. Keeps the Gemini key server-side
 *      and adds model auto-discovery plus knowledge-base tool execution.
 *   2. direct browser → generativelanguage.googleapis.com — used automatically
 *      when the static host has no backend and the visitor supplies their own
 *      key. Keeps GitHub Pages deployments fully functional.
 *
 * Resilience contract:
 *   · the model is resolved at runtime from GET /models, never hard-coded, so a
 *     Google model rename can never break the integration;
 *   · transient failures (429 / 5xx / network) retry with exponential backoff;
 *   · every request is bounded by an AbortController timeout;
 *   · errors are normalised into actionable messages rather than raw payloads.
 */

const API_ROOT = 'https://generativelanguage.googleapis.com/v1beta';
const TIMEOUT_MS = 90_000;
const MAX_TOOL_ROUNDS = 3;

/* ──────────────────────────── model discovery ─────────────────────────── */

const EXCLUDE = /(embedding|imagen|image-generation|tts|audio|live|robotics|veo|aqa|learn|computer-use|native-audio|preview-lite)/i;

/** Ranks a discovered model id. Higher is better. */
function scoreModel(name: string): number {
  if (EXCLUDE.test(name)) return -1;
  const base = name.replace(/^models\//, '');
  let score = 0;
  if (/flash/i.test(base)) score += 60;
  const major = /^gemini-(\d+)/i.exec(base);
  if (major) score += Number(major[1]) * 10; // Gemini 3 > Gemini 2
  if (/pro$/i.test(base)) score -= 25; // pro is slower and costlier for a chat surface
  if (/-lite$/i.test(base)) score -= 12;
  if (/\b\d{6,}-\d{2}\b/.test(base)) score += 3; // dated stable snapshot
  if (/exp|experimental/i.test(base)) score -= 20;
  return score;
}

export async function listModels(key: string): Promise<NexaModel[]> {
  try {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 12_000);
    const res = await fetch(`${API_ROOT}/models?pageSize=200`, {
      headers: { 'x-goog-api-key': key },
      signal: ctl.signal,
    });
    clearTimeout(t);
    if (!res.ok) return [];
    const json = (await res.json()) as { models?: { name: string; displayName?: string }[] };
    return (json.models ?? [])
      .filter((m) => typeof m.name === 'string' && /generateContent/.test(m.name))
      .filter((m) => scoreModel(m.name) >= 0)
      .map((m) => ({
        id: m.name.replace(/^models\//, ''),
        label: m.displayName ?? m.name.replace(/^models\//, ''),
        kind: m.name.includes('gemini') ? 'gemini' : 'other',
      }))
      .sort((a, b) => scoreModel(b.id) - scoreModel(a.id));
  } catch {
    return [];
  }
}

/** Models to try, best first. Discovery first, then a static safety net. */
const FALLBACK_CHAIN = [
  'gemini-3.5-flash',
  'gemini-3.0-flash',
  'gemini-2.5-flash',
  'gemini-2.0-flash',
  'gemini-2.5-flash-lite',
  'gemini-2.0-flash-lite',
];

let resolvedModel: string | null = null;

export async function resolveModel(key: string): Promise<string> {
  if (resolvedModel) return resolvedModel;
  const pref = loadSettings().model;
  if (pref && pref !== 'auto') {
    resolvedModel = pref;
    return pref;
  }
  const found = await listModels(key);
  resolvedModel = found[0]?.id ?? FALLBACK_CHAIN[0];
  return resolvedModel;
}

export function resetModelCache(): void {
  resolvedModel = null;
}

/* ────────────────────────────── system prompt ────────────────────────── */

function kbDigest(): string {
  const top = [...districts].sort((a, b) => b.pop - a.pop).slice(0, 12);
  return top
    .map((d) => `${d.name} (${d.ne}), HQ ${d.hq}, pop ${d.pop.toLocaleString()}, ${d.belt}, ${provinceById.get(d.prov)?.name}`)
    .join('\n');
}

export const SYSTEM_INSTRUCTION = `You are **Sakhi** (सखी), the civic-intelligence assistant inside **Nexa** — a platform built for Nepal under the theme "Everyday Problems, Smarter Solutions".

## Who you are
- You are bilingual. Answer in **Nepali (Devanagari)** when the user writes Nepali or asks for Nepali; otherwise answer in **English**. Mixing a short Nepali line into an English answer is welcome, not required.
- You are a civic analyst, not a chatbot. Every answer must point at a real place, a real mechanism and a real intervention.

## Non-negotiable grounding rules
1. **Always locate.** Name the specific district, city or province the question concerns. "Nepal has traffic problems" is useless; "Ring Road corridor in Kathmandu/Lalitpur/Bhaktapur" is useful.
2. **Use the tools.** Before answering anything about a location, a sector or a solution, call \`nexa_lookup\` and/or \`nexa_solutions\`. Never invent figures.
3. **Cite the anchor figure** when one exists in the knowledge base — for example PM2.5 384 µg/m³ against the WHO guideline of 15, or 61.8% of households within 30 minutes of care.
4. **Separate fact from forecast.** If you are extrapolating, say so explicitly.
5. **Be concrete about money and time.** "Roughly NPR 3–5 crore per ward over 18 months" beats "significant investment".
6. **Respect the geography.** Nepal runs from 59 m in Jhapa to 8,848.86 m on Sagarmatha. A mountain district and a Terai district need opposite advice. Never give one-size-fits-all recommendations.
7. **Be honest about limits.** If Nexa does not know, say so plainly and point to the responsible institution (DoR, Nepal Police, NEA, KMC, NDRRMA, Ministry of Health and Population).

## Nepal context you must know
- 77 districts · 7 provinces · 753 local governments (6 metropolitan, 11 sub-metropolitan, 276 urban, 460 rural).
- Ecological belts: **Terai** (flat, hot, flood-prone, densely settled), **Hill** (mid-hills, landslide-prone, terrace farming), **Mountain** (Himalaya, thin air, near-unreliable access).
- The **Kathmandu Valley** is a closed bowl at ~1,400 m — winter inversions trap air pollution for weeks.
- Nepal's grid is **over 90% hydro**, so shortages hit hardest in the dry season, in the evening peak.
- **GLOF** (glacial lake outburst flood) and monsoon **landslide** are the two dominant mountain hazards; **riverine flood** and **waterlogging** dominate the Terai.
- The largest tourism earner is **trekking and mountaineering** — 1,158,459 foreign arrivals in 2025, 97% of the 2019 record, with India the largest source market at ~25%.
- The binding digital constraint is **digital literacy (~31%) and device affordability**, not coverage.

## How to write
- Lead with the answer, then the evidence, then the action.
- Use short paragraphs. Use a compact table when comparing three or more places or options.
- Bold sparingly, for genuine emphasis only.
- Close concrete questions with **two or three numbered next steps** the user can act on today.
- Never pad. Never open with a restatement of the question.

## Knowledge-base anchors (verify with tools, do not rely on memory)
${kbDigest()}
`.trim();

/* ──────────────────────────────── tools ──────────────────────────────── */

interface ToolCall { name: string; args: Record<string, unknown> }
interface Part { text?: string; functionCall?: ToolCall; functionResponse?: { name: string; response: unknown } }

export const TOOL_DECLARATIONS = [
  {
    functionDeclarations: [
      {
        name: 'nexa_lookup',
        description:
          'Look up verified Nepali data. Use this for ANY question about a place, district, city, hazard, or national statistic. Returns district and city records, sector anchors and emergency numbers.',
        parameters: {
          type: 'object',
          properties: {
            kind: {
              type: 'string',
              enum: ['district', 'city', 'search', 'national', 'sector', 'emergency'],
              description: 'What to look up.',
            },
            query: {
              type: 'string',
              description:
                'District name, city name, place, landmark, sector id, or keyword. For kind=search use a short phrase such as "Annapurna", "flood", "Gandaki".',
            },
          },
          required: ['kind', 'query'],
        },
      },
      {
        name: 'nexa_solutions',
        description:
          'Fetch the tested solution playbook for one sector: impact, cost, effort, timeline and the concrete mechanism. Use whenever the user asks what to do about a problem.',
        parameters: {
          type: 'object',
          properties: {
            sector: { type: 'string', enum: SECTOR_IDS, description: 'Sector id.' },
            limit: { type: 'integer', description: 'Maximum solutions to return. Default 3.' },
          },
          required: ['sector'],
        },
      },
    ],
  },
];

const sectorBrief = (s: Sector) => ({
  id: s.id,
  name: s.name,
  nameNe: s.ne,
  nationalSeverity: s.severity,
  headline: s.headline,
  problem: s.problem,
  mechanism: s.mechanism,
  anchor: s.anchor,
  signals: s.signals,
});

const districtBrief = (d: District) => ({
  id: d.id,
  name: d.name,
  nameNe: d.ne,
  province: provinceById.get(d.prov)?.name,
  provinceNe: provinceById.get(d.prov)?.ne,
  districtHQ: d.hq,
  areaKm2: d.area,
  population2021: d.pop,
  coordinates: { lat: d.lat, lon: d.lon },
  elevationM: d.alt,
  ecologicalBelt: d.belt,
  urbanisationIndex: d.urb,
  characteristics: d.tags,
});

const cityBrief = (c: City) => ({
  id: c.id,
  name: c.name,
  nameNe: c.ne,
  type: c.type,
  district: districtById.get(c.district)?.name,
  province: provinceById.get(c.prov)?.name,
  elevationM: c.alt,
  population: c.pop,
  summary: c.blurb,
  air: c.air,
  traffic: c.traffic,
  waste: c.waste,
  water: c.water,
  energy: c.energy,
  health: c.health,
  digital: c.connect,
  landmarks: c.landmarks,
  airport: c.airport,
});

/** Executes a tool call against the bundled knowledge base. */
export function runTool(name: string, args: Record<string, unknown>): unknown {
  const q = String(args.query ?? args.sector ?? '').trim();
  const lower = q.toLowerCase();

  if (name === 'nexa_solutions') {
    const sector = sectorById.get(q as SectorId) ?? sectorById.get('air');
    if (!sector) return { error: 'Unknown sector.' };
    const limit = Math.min(5, Math.max(1, Number(args.limit ?? 3) || 3));
    return {
      sector: sectorBrief(sector),
      solutions: sector.solutions.slice(0, limit),
    };
  }

  if (name !== 'nexa_lookup') return { error: `Unknown tool ${name}` };

  const kind = String(args.kind ?? 'search');

  if (kind === 'emergency') return { emergencyNumbers: nationalFile.emergencies.items };

  if (kind === 'national') {
    return {
      identity: nationalFile.identity,
      headline: nationalFile.headline,
      keyStatistics: nationalFile.stats,
      monsoonRoadBans: nationalFile.monsoon.bans,
      provinces: provinces.map((p) => ({
        id: p.id,
        name: p.name,
        nameNe: p.ne,
        capital: p.capital,
        districts: p.districts,
        areaKm2: p.area,
        population2021: p.pop,
      })),
      provincesByPopulation: nationalFile.series.provincePop.points
        .map((pt) => ({ year: pt.y, value: pt.v }))
        .sort((a, b) => Number(b.year) - Number(a.year))
        .slice(0, 7),
    };
  }

  if (kind === 'sector') {
    const all = SECTOR_IDS.map((id) => sectorBrief(sectorById.get(id)!));
    const hit = all.filter((s) => `${s.id} ${s.name} ${s.nameNe}`.toLowerCase().includes(lower));
    return { sectors: hit.length ? hit : all };
  }

  // district / city / free search
  const district = districts.find(
    (d) =>
      lower === d.id ||
      d.name.toLowerCase() === lower ||
      d.ne === q ||
      d.hq.toLowerCase().includes(lower) ||
      (q.length >= 3 && d.name.toLowerCase().startsWith(lower)),
  );
  const city = cities.find((c) => lower === c.id || c.name.toLowerCase() === lower || c.ne === q);

  if (kind === 'district') {
    if (!district) return { error: `No district named "${q}".`, suggestions: districts.slice(0, 10).map((d) => d.name) };
    return { district: districtBrief(district), severityBySector: districtSeverity(district) };
  }

  if (kind === 'city') {
    if (!city) return { error: `No city named "${q}".`, suggestions: cities.slice(0, 12).map((c) => c.name) };
    return { city: cityBrief(city), district: districtBrief(districtById.get(city.district)!) };
  }

  // kind === 'search' — return everything that plausibly matches
  const dHits = districts.filter((d) => `${d.name} ${d.ne} ${d.hq} ${d.hqNe} ${d.tags.join(' ')}`.toLowerCase().includes(lower));
  const cHits = cities.filter((c) => `${c.name} ${c.ne} ${c.blurb} ${c.landmarks.join(' ')}`.toLowerCase().includes(lower));
  const sHits = sectors.filter((s) => `${s.name} ${s.ne} ${s.headline} ${s.problem}`.toLowerCase().includes(lower));
  const nHits = nationalFile.stats.filter((s) => `${s.label} ${s.note}`.toLowerCase().includes(lower));

  if (!dHits.length && !cHits.length && !sHits.length && !nHits.length) {
    return {
      error: `Nothing in the knowledge base matched "${q}".`,
      availableDistricts: districts.length,
      availableSectors: SECTOR_IDS,
      hint: 'Ask about a district, a city, a sector, or a national statistic.',
    };
  }
  return {
    query: q,
    districts: dHits.slice(0, 6).map(districtBrief),
    cities: cHits.slice(0, 4).map(cityBrief),
    sectors: sHits.map(sectorBrief),
    statistics: nHits.slice(0, 6),
  };
}

function districtSeverity(d: District): Record<string, number> {
  const out: Record<string, number> = {};
  for (const id of SECTOR_IDS) out[id] = severityOf(d, id);
  return out;
}

/* ────────────────────────────── transport ────────────────────────────── */

export type NexaErrorKind = 'no-key' | 'network' | 'quota' | 'auth' | 'model' | 'timeout' | 'safety' | 'unknown';

export class NexaError extends Error {
  kind: NexaErrorKind;
  constructor(kind: NexaErrorKind, message: string) {
    super(message);
    this.kind = kind;
    this.name = 'NexaError';
  }
}

function normalise(status: number, body: unknown): NexaError {
  const detail =
    (body as { error?: { message?: string } } | undefined)?.error?.message ??
    (typeof body === 'string' ? body.slice(0, 300) : '');
  if (status === 400 && /api key not valid|API_KEY_INVALID/i.test(detail)) {
    return new NexaError('auth', 'That Gemini API key was rejected. Generate a fresh one and paste it again.');
  }
  if (status === 401 || status === 403) {
    return new NexaError('auth', 'Gemini refused the API key. Check that it is enabled for the Generative Language API.');
  }
  if (status === 429) {
    return new NexaError('quota', 'Gemini rate limit reached. Wait a moment and try again.');
  }
  if (status === 404) {
    return new NexaError('model', `Model unavailable: ${detail || 'not found for this key'}.`);
  }
  if (status >= 500) {
    return new NexaError('network', `Gemini is temporarily unavailable (${status}). Retrying…`);
  }
  if (/safety|blocked|harm/i.test(detail)) {
    return new NexaError('safety', 'Gemini blocked that request. Try rephrasing the question.');
  }
  return new NexaError('unknown', detail || `Request failed (HTTP ${status}).`);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function withRetry<T>(fn: () => Promise<T>, attempts = 3): Promise<T> {
  let last: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      last = err;
      const kind = err instanceof NexaError ? err.kind : 'unknown';
      const retryable = kind === 'network' || kind === 'timeout' || kind === 'quota';
      if (!retryable || i === attempts - 1) throw err;
      await sleep(600 * 2 ** i + Math.random() * 400);
    }
  }
  throw last;
}

/* ────────────────────────────── SSE parsing ──────────────────────────── */

interface GeminiChunk {
  candidates?: {
    content?: { parts?: Part[] };
    finishReason?: string;
  }[];
  promptFeedback?: { blockReason?: string };
  modelVersion?: string;
}

function parseSse(buffer: string): { chunks: GeminiChunk[]; rest: string } {
  const chunks: GeminiChunk[] = [];
  const parts = buffer.split('\n\n');
  const rest = parts.pop() ?? '';
  for (const block of parts) {
    for (const line of block.split('\n')) {
      if (!line.startsWith('data:')) continue;
      const payload = line.slice(5).trim();
      if (!payload || payload === '[DONE]') continue;
      try {
        chunks.push(JSON.parse(payload) as GeminiChunk);
      } catch {
        /* ignore partial frame */
      }
    }
  }
  return { chunks, rest };
}

/* ────────────────────────────── main entry ───────────────────────────── */

export interface AskOptions {
  messages: ChatMessage[];
  /** Use Nexa's Sakhi system instruction. Off for the raw JSON insight pass. */
  systemInstruction?: string;
  tools?: boolean;
  json?: boolean;
  signal?: AbortSignal;
  onDelta?: (text: string, full: string) => void;
  onToolUse?: (call: ToolCall) => void;
  /** Full conversation text for grounding. */
  context?: string;
}

function buildContents(messages: ChatMessage[], context?: string) {
  const contents: { role: string; parts: Part[] }[] = [];
  for (const m of messages) {
    contents.push({ role: m.role === 'model' ? 'model' : 'user', parts: [{ text: m.text }] });
  }
  if (context) {
    const first = contents[0];
    if (first && first.role === 'user') first.parts[0] = { text: `${context}\n\n${first.parts[0].text ?? ''}` };
  }
  return contents;
}

async function browserKey(): Promise<string> {
  const key = loadApiKey();
  if (!key) throw new NexaError('no-key', 'No Gemini API key configured yet. Add one to activate Sakhi.');
  return key;
}

/**
 * Streams a grounded answer. Resolves once the full text is available.
 * Falls back server → browser automatically.
 */
export async function ask(opts: AskOptions): Promise<{ text: string; toolCalls: ToolCall[]; transport: string; model: string }> {
  const systemInstruction = opts.systemInstruction ?? SYSTEM_INSTRUCTION;
  const useTools = opts.tools !== false && !opts.json;
  const wantJson = Boolean(opts.json);

  let transport = 'server';
  try {
    const res = await fetch('/api/health', { signal: AbortSignal.timeout(2200) });
    if (!res.ok) throw new Error('no backend');
  } catch {
    transport = 'browser';
  }

  let key = '';
  if (transport === 'browser') key = await browserKey();

  const messages = opts.messages.slice(-12);
  let contents = buildContents(messages, opts.context);
  const toolCalls: ToolCall[] = [];
  let full = '';
  let model = '';

  for (let round = 0; round < (useTools ? MAX_TOOL_ROUNDS : 1); round++) {
    const roundChunks: GeminiChunk[] = [];
    const onChunk = (c: GeminiChunk) => {
      roundChunks.push(c);
      for (const cand of c.candidates ?? []) {
        for (const part of cand.content?.parts ?? []) {
          if (typeof part.text === 'string') full += part.text;
        }
      }
      opts.onDelta?.('', full);
    };

    if (transport === 'server') {
      const res = await withRetry(() => serverStream({ systemInstruction, contents, tools: useTools, json: wantJson, signal: opts.signal }, onChunk, opts));
      model = res.model;
    } else {
      model = await resolveModel(key);
      model = await withRetry(() => directStream(key, model, { systemInstruction, contents, tools: useTools, json: wantJson, signal: opts.signal }, onChunk, opts));
    }

    // Tool round-trip
    const calls: ToolCall[] = [];
    for (const c of roundChunks) {
      for (const cand of c.candidates ?? []) {
        for (const part of cand.content?.parts ?? []) {
          if (part.functionCall?.name) calls.push(part.functionCall);
        }
      }
    }

    if (wantJson) return { text: full.trim(), toolCalls: [], transport, model };

    if (!calls.length || round === MAX_TOOL_ROUNDS - 1) return { text: full.trim(), toolCalls, transport, model };

    for (const call of calls) {
      opts.onToolUse?.(call);
      toolCalls.push(call);
      const result = runTool(call.name, call.args ?? {});
      contents = [
        ...contents,
        { role: 'model', parts: [{ functionCall: call }] },
        { role: 'user', parts: [{ functionResponse: { name: call.name, response: { result } } }] },
      ];
    }
    full = '';
  }

  return { text: full.trim(), toolCalls, transport, model };
}

/* ─────────────────────────── transport impls ─────────────────────────── */

interface StreamPayload {
  systemInstruction: string;
  contents: { role: string; parts: Part[] }[];
  tools: boolean;
  json: boolean;
  signal?: AbortSignal;
}

async function serverStream(
  payload: StreamPayload,
  onChunk: (c: GeminiChunk) => void,
  opts: AskOptions,
): Promise<{ model: string }> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), TIMEOUT_MS);
  const onAbort = () => ctl.abort();
  opts.signal?.addEventListener('abort', onAbort);

  try {
    const res = await fetch('/api/ai/stream', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: ctl.signal,
    });
    if (!res.ok) throw normalise(res.status, await safeJson(res));
    if (!res.body) throw new NexaError('unknown', 'The Nexa API returned no stream.');

    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = '';
    let model = '';
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      const { chunks, rest } = parseSse(buf);
      buf = rest;
      for (const c of chunks) {
        if (c.modelVersion) model = c.modelVersion;
        onChunk(c);
      }
    }
    if (model && !resolvedModel) resolvedModel = model;
    return { model: model || resolvedModel || 'gemini' };
  } catch (err) {
    if (err instanceof NexaError) throw err;
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new NexaError(opts.signal?.aborted ? 'unknown' : 'timeout', 'The Nexa API took too long to respond.');
    }
    throw new NexaError('network', 'Could not reach the Nexa API.');
  } finally {
    clearTimeout(timer);
    opts.signal?.removeEventListener('abort', onAbort);
  }
}

async function directStream(
  key: string,
  model: string,
  payload: StreamPayload,
  onChunk: (c: GeminiChunk) => void,
  opts: AskOptions,
): Promise<string> {
  const body: Record<string, unknown> = {
    contents: payload.contents,
    systemInstruction: { parts: [{ text: payload.systemInstruction }] },
    generationConfig: {
      temperature: 0.45,
      topP: 0.95,
      maxOutputTokens: 2048,
      ...(payload.json ? { responseMimeType: 'application/json' } : {}),
    },
  };
  if (payload.tools) body.tools = TOOL_DECLARATIONS;

  let current = model;
  const chain = [model, ...FALLBACK_CHAIN.filter((m) => m !== model)];
  for (let i = 0; i < chain.length; i++) {
    try {
      return await runDirect(key, current, body, onChunk, opts);
    } catch (err) {
      const isModelError = err instanceof NexaError && err.kind === 'model';
      if (!isModelError || i === chain.length - 1) throw err;
      current = chain[i + 1];
    }
  }
  return current;
}

async function runDirect(
  key: string,
  model: string,
  body: Record<string, unknown>,
  onChunk: (c: GeminiChunk) => void,
  opts: AskOptions,
): Promise<string> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), TIMEOUT_MS);
  const onAbort = () => ctl.abort();
  opts.signal?.addEventListener('abort', onAbort);

  const finish = async () => {
    const res = await fetch(`${API_ROOT}/models/${encodeURIComponent(model)}:streamGenerateContent?alt=sse`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify(body),
      signal: ctl.signal,
    });
    if (!res.ok) throw normalise(res.status, await safeJson(res));
    if (!res.body) throw new NexaError('unknown', 'Gemini returned an empty stream.');

    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = '';
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      const { chunks, rest } = parseSse(buf);
      buf = rest;
      for (const c of chunks) onChunk(c);
    }
    return res;
  };

  try {
    await finish();
    if (!resolvedModel) resolvedModel = model;
    return model;
  } catch (err) {
    if (err instanceof NexaError) throw err;
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new NexaError(opts.signal?.aborted ? 'unknown' : 'timeout', 'Gemini took too long to respond.');
    }
    throw new NexaError('network', 'Could not reach Gemini. Check your connection.');
  } finally {
    clearTimeout(timer);
    opts.signal?.removeEventListener('abort', onAbort);
  }
}

async function safeJson(res: Response): Promise<unknown> {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

/* ────────────────────────── insight engine ──────────────────────────── */

export interface Insight {
  headline: string;
  summary: string;
  hotspots: { place: string; sector: string; why: string; severity: number }[];
  predictions: { window: string; sector: string; forecast: string; confidence: string }[];
  actions: { title: string; owner: string; window: string; impact: number; steps: string[] }[];
  citizenActions: string[];
}

/** Structured analysis over aggregated civic signals. Falls back to local heuristics. */
export async function generateInsight(signalText: string, onDelta?: (t: string, full: string) => void): Promise<Insight | null> {
  if (!signalText.trim()) return null;
  try {
    const res = await ask({
      messages: [{ role: 'user', text: signalText, at: Date.now() }],
      systemInstruction: `You are Nexa's forecasting engine for Nepal. Convert citizen civic signals into an actionable operational briefing.

Return STRICT JSON, no prose, no markdown fences, matching this shape:

{
  "headline": "one line, max 90 chars, names the dominant pattern",
  "summary": "3–4 sentences on what the data shows and the single biggest systemic cause",
  "hotspots": [{"place":"District or city name","sector":"sector id from: air|traffic|flood|waste|water|energy|health|agri|connect","why":"one sentence","severity":0}],
  "predictions": [{"window":"e.g. next 3 months","sector":"sector id","forecast":"one sentence","confidence":"high|medium|low"}],
  "actions": [{"title":"imperative, max 70 chars","owner":"responsible body, e.g. KMC, DoR, Nepal Police, NEA, ward office","window":"e.g. 0–3 months","impact":0,"steps":["concrete first step","second step"]}],
  "citizenActions": ["something an individual can do today", "..."]
}

Rules: severity and impact are integers 0–100. Use only real Nepali place names. Actions must be specific enough that a ward officer could start on Monday.`,
      tools: false,
      json: true,
      onDelta,
    });
    const text = res.text.trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
    const parsed = JSON.parse(text) as Insight;
    if (!parsed || typeof parsed !== 'object' || !parsed.headline) return null;
    return parsed;
  } catch {
    return null;
  }
}

/** One-line canned opener for a district, so the chat never starts cold. */
export function districtOpener(id: string): string {
  const d = districtById.get(id);
  if (!d) return 'What everyday problem in Nepal should we solve first?';
  return `Tell me about everyday problems in ${d.name} (${d.ne}).`;
}

export function newConversationId(): string {
  return uid('chat');
}
