import type { ChatMessage, NexaModel, Signal } from '@/types';
import { uid } from './utils';

/**
 * Nexa persistence.
 *
 * Primary store is localStorage so the app is fully functional offline and on a
 * pure static host (GitHub Pages). When the optional Node API is reachable the
 * same records are mirrored to a JSON-file database, and reads prefer the server
 * copy so a signal submitted on one device shows up on another.
 */

const NS = 'nexa';
const K = {
  signals: `${NS}.signals`,
  settings: `${NS}.settings`,
  chats: `${NS}.chats`,
  seen: `${NS}.seen`,
  apiKey: `${NS}.geminiKey`,
} as const;

export interface Settings {
  lang: 'en' | 'ne';
  model: string | 'auto';
  reduceMotion: boolean;
  soundOff: boolean;
  autoSync: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  lang: 'en',
  model: 'auto',
  reduceMotion: false,
  soundOff: true,
  autoSync: true,
};

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* quota or private mode — the app degrades to in-memory only */
  }
}

/* ────────────────────────────── settings ────────────────────────────── */

export function loadSettings(): Settings {
  return { ...DEFAULT_SETTINGS, ...read<Partial<Settings>>(K.settings, {}) };
}

export function saveSettings(s: Settings): void {
  write(K.settings, s);
}

/* ─────────────────────────────── signals ────────────────────────────── */

export function loadSignals(): Signal[] {
  const local = read<Signal[]>(K.signals, []);
  return local.sort((a, b) => b.createdAt - a.createdAt);
}

export function saveSignals(list: Signal[]): void {
  write(K.signals, list);
}

export function addSignal(sig: Omit<Signal, 'id' | 'createdAt' | 'synced'>): Signal {
  const full: Signal = { ...sig, id: uid('sig'), createdAt: Date.now(), synced: false };
  saveSignals([full, ...loadSignals()]);
  void pushSignal(full);
  return full;
}

export function removeSignal(id: string): void {
  saveSignals(loadSignals().filter((s) => s.id !== id));
  void fetch(`/api/signals/${id}`, { method: 'DELETE' }).catch(() => {});
}

export function updateSignal(id: string, patch: Partial<Signal>): void {
  const next = loadSignals().map((s) => (s.id === id ? { ...s, ...patch } : s));
  saveSignals(next);
}

/* ───────────────────────────── chat history ─────────────────────────── */

export interface ChatThread {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messages: ChatMessage[];
}

export function loadThreads(): ChatThread[] {
  const list = read<ChatThread[]>(K.chats, []);
  return list.sort((a, b) => b.updatedAt - a.updatedAt);
}

export function saveThread(t: ChatThread): void {
  const list = loadThreads().filter((x) => x.id !== t.id);
  list.unshift(t);
  write(K.chats, list.slice(0, 40));
}

export function deleteThread(id: string): void {
  write(
    K.chats,
    loadThreads().filter((t) => t.id !== id),
  );
}

/* ─────────────────────────── api key (browser) ──────────────────────── */

export function loadApiKey(): string {
  try {
    return localStorage.getItem(K.apiKey) ?? '';
  } catch {
    return '';
  }
}

export function saveApiKey(v: string): void {
  try {
    if (v) localStorage.setItem(K.apiKey, v);
    else localStorage.removeItem(K.apiKey);
  } catch {
    /* ignore */
  }
}

/* ───────────────────────────── first-run ────────────────────────────── */

export function markSeen(): void {
  write(K.seen, Date.now());
}

export function hasSeen(): boolean {
  return read<number | null>(K.seen, null) !== null;
}

/* ───────────────────────── backend availability ─────────────────────── */

export type Backend = { up: boolean; models: NexaModel[]; mode: 'server' | 'browser' | 'none' };

let backendCache: Backend | null = null;

export async function detectBackend(): Promise<Backend> {
  if (backendCache) return backendCache;
  try {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 2500);
    const res = await fetch('/api/health', { signal: ctl.signal });
    clearTimeout(timer);
    if (!res.ok) throw new Error(String(res.status));
    const data = (await res.json()) as { ok?: boolean; models?: NexaModel[]; hasKey?: boolean };
    backendCache = {
      up: Boolean(data.ok),
      models: data.models ?? [],
      mode: data.hasKey ? 'server' : 'none',
    };
  } catch {
    backendCache = { up: false, models: [], mode: 'none' };
  }
  return backendCache;
}

export function cachedBackend(): Backend | null {
  return backendCache;
}

/** Forces the next detectBackend() call to re-probe /api/health. */
export function resetBackendCache(): void {
  backendCache = null;
}

/**
 * Push one signal to the optional Node backend.
 *
 * On a static host (GitHub Pages) there is no /api at all. Probing first keeps
 * the console clean instead of logging a failed request for every report, and
 * the signal is already safely persisted to localStorage either way.
 */
async function pushSignal(sig: Signal): Promise<void> {
  const backend = await detectBackend();
  if (!backend.up) return;
  try {
    const res = await fetch('/api/signals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(sig),
    });
    if (!res.ok) return;
    updateSignal(sig.id, { synced: true });
  } catch {
    /* offline: stays local, will be retried on the next manual sync */
  }
}

export async function syncAll(): Promise<{ pushed: number; pulled: Signal[] }> {
  const empty = { pushed: 0, pulled: [] as Signal[] };
  if (!(await detectBackend()).up) return empty;
  try {
    const local = loadSignals();
    const res = await fetch('/api/signals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ signals: local }),
    });
    if (!res.ok) return { pushed: 0, pulled: [] };
    const data = (await res.json()) as { ok?: boolean; signals?: Signal[] };
    const pulled = data.signals ?? [];
    const merged = new Map<string, Signal>();
    for (const s of [...pulled, ...local]) merged.set(s.id, s);
    saveSignals([...merged.values()].sort((a, b) => b.createdAt - a.createdAt));
    return { pushed: local.length, pulled };
  } catch {
    return empty;
  }
}
