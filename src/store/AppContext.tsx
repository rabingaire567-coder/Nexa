import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { Signal } from '@/types';
import {
  DEFAULT_SETTINGS,
  detectBackend,
  loadApiKey,
  loadSettings,
  loadSignals,
  loadThreads,
  markSeen,
  saveApiKey,
  saveSettings,
  saveThread,
  type Backend,
  type ChatThread,
  type Settings,
} from '@/lib/db';
import { uid } from '@/lib/utils';

export type Lang = 'en' | 'ne';
export type ToastKind = 'ok' | 'warn' | 'err' | 'info';

export interface Toast {
  id: string;
  kind: ToastKind;
  text: string;
}

interface NexaCtx {
  settings: Settings;
  update: (patch: Partial<Settings>) => void;
  theme: 'dark' | 'light';
  toggleTheme: () => void;

  signals: Signal[];
  setSignals: (s: Signal[]) => void;

  threads: ChatThread[];
  upsertThread: (t: ChatThread) => void;

  hasKey: boolean;
  apiKey: string;
  saveKey: (v: string) => void;

  backend: Backend | null;
  refreshBackend: () => Promise<void>;

  lang: Lang;
  setLang: (l: Lang) => void;

  toasts: Toast[];
  toast: (kind: ToastKind, text: string) => void;
  dismiss: (id: string) => void;

  ready: boolean;
}

const Ctx = createContext<NexaCtx | null>(null);

function readTheme(): 'dark' | 'light' {
  if (typeof document === 'undefined') return 'dark';
  return document.documentElement.dataset.theme === 'light' ? 'light' : 'dark';
}

export function NexaProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [signals, setSignals] = useState<Signal[]>([]);
  const [threads, setThreads] = useState<ChatThread[]>([]);
  const [apiKey, setApiKey] = useState('');
  const [backend, setBackend] = useState<Backend | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const s = loadSettings();
    setSettings(s);
    setTheme(readTheme());
    setSignals(loadSignals());
    setThreads(loadThreads());
    setApiKey(loadApiKey());
    markSeen();
    document.getElementById('nexa-boot')?.remove();
    setReady(true);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', theme === 'light' ? '#f6f3ec' : '#070b14');
    try {
      localStorage.setItem('nexa.theme', theme);
    } catch {
      /* ignore */
    }
  }, [theme]);

  useEffect(() => {
    if (settings.reduceMotion) document.documentElement.classList.add('reduce-motion');
    else document.documentElement.classList.remove('reduce-motion');
  }, [settings.reduceMotion]);

  const update = useCallback((patch: Partial<Settings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      saveSettings(next);
      return next;
    });
  }, []);

  const toast = useCallback((kind: ToastKind, text: string) => {
    const id = uid('t');
    setToasts((prev) => [...prev.slice(-3), { id, kind, text }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4600);
  }, []);

  const dismiss = useCallback((id: string) => setToasts((prev) => prev.filter((t) => t.id !== id)), []);

  const refreshBackend = useCallback(async () => {
    const b = await detectBackend();
    setBackend(b);
  }, []);

  useEffect(() => {
    void refreshBackend();
  }, [refreshBackend]);

  const upsertThread = useCallback((t: ChatThread) => {
    saveThread(t);
    setThreads(loadThreads());
  }, []);

  const setLang = useCallback((l: Lang) => update({ lang: l }), [update]);

  /**
   * Persists the key and mirrors it into context state in one step. Settings used
   * to call saveApiKey directly, which left `hasKey` stale for the rest of the
   * session: adding a key and navigating back to Ask still showed "No key" and
   * silently kept using Knowledge Mode.
   */
  const saveKey = useCallback((v: string) => {
    const next = v.trim();
    saveApiKey(next);
    setApiKey(next);
    void refreshBackend();
  }, [refreshBackend]);

  const value = useMemo<NexaCtx>(
    () => ({
      settings,
      update,
      theme,
      toggleTheme: () => setTheme((t) => (t === 'dark' ? 'light' : 'dark')),
      signals,
      setSignals,
      threads,
      upsertThread,
      hasKey: apiKey.length > 0,
      apiKey,
      saveKey,
      backend,
      refreshBackend,
      lang: settings.lang,
      setLang,
      toasts,
      toast,
      dismiss,
      ready,
    }),
    [settings, update, theme, signals, threads, upsertThread, apiKey, saveKey, backend, refreshBackend, setLang, toasts, toast, dismiss, ready],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useNexa(): NexaCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error('useNexa must be used inside <NexaProvider>');
  return c;
}
