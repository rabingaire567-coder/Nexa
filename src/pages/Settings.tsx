import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '@/components/Icon';
import { Reveal, Section, SourceNote } from '@/components/ui';
import { loadApiKey, loadSignals, resetBackendCache, syncAll } from '@/lib/db';
import { listModels, resolveModel, resetModelCache } from '@/lib/ai';
import { useNexa } from '@/store/AppContext';
import type { NexaModel } from '@/types';
import { cx } from '@/lib/utils';

export default function Settings() {
  const { settings, update, theme, toggleTheme, backend, refreshBackend, toast, setSignals, lang, setLang, saveKey } = useNexa();
  const [key, setKey] = useState('');
  const [reveal, setReveal] = useState(false);
  const [models, setModels] = useState<NexaModel[]>([]);
  const [testing, setTesting] = useState(false);
  const [status, setStatus] = useState<'idle' | 'ok' | 'fail'>('idle');
  const [detail, setDetail] = useState('');
  const [signalCount, setSignalCount] = useState(0);

  useEffect(() => setKey(loadApiKey()), []);
  useEffect(() => setSignalCount(loadSignals().length), []);

  async function test(): Promise<void> {
    const k = key.trim() || loadApiKey();
    if (!k) {
      setStatus('fail');
      setDetail('Paste a key first.');
      return;
    }
    setTesting(true);
    setStatus('idle');
    setDetail('Contacting Google AI…');
    resetModelCache();
    try {
      const found = await listModels(k);
      if (found.length === 0) {
        setStatus('fail');
        setDetail('Google returned no Gemini models for this key. It may be invalid or the Generative Language API may not be enabled.');
        setModels([]);
      } else {
        const chosen = await resolveModel(k);
        setModels(found);
        setStatus('ok');
        setDetail(`Key works. ${found.length} model${found.length === 1 ? '' : 's'} available — Nexa will use “${chosen}”.`);
      }
    } catch {
      setStatus('fail');
      setDetail('Could not reach Google AI. Check your connection.');
    } finally {
      setTesting(false);
    }
  }

  function save(): void {
    const k = key.trim();
    if (!k) {
      toast('warn', 'Enter a key before saving.');
      return;
    }
    saveKey(k);
    resetModelCache();
    resetBackendCache();
    setStatus('ok');
    setDetail('Saved to this browser only.');
    toast('ok', 'Gemini key stored in this browser.');
  }

  function clear(): void {
    saveKey('');
    setKey('');
    setModels([]);
    setStatus('idle');
    setDetail('');
    resetModelCache();
    resetBackendCache();
    toast('info', 'API key removed from this browser.');
  }

  return (
    <>
      <Section tight>
        <div className="stack" style={{ gap: '0.5rem', maxWidth: '60ch' }}>
          <span className="eyebrow">Configuration</span>
          <h1 className="h1" style={{ fontSize: 'clamp(2rem, 4.6vw, 3rem)' }}>Settings</h1>
          <p className="lede">
            Nexa runs without any configuration. Everything here is optional and stored in this browser only.
          </p>
        </div>
      </Section>

      <Section tight>
        <div className="grid" style={{ gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 'var(--sp-5)', alignItems: 'start' }}>
          <div className="stack" style={{ gap: 'var(--sp-4)' }}>
            {/* API key */}
            <Reveal className="card card-accent" style={{ ['--accent' as string]: 'var(--grad-crimson)' }}>
              <div className="row-between" style={{ marginBottom: '0.4rem' }}>
                <span className="row" style={{ gap: 8 }}>
                  <Icon name="key" size={17} style={{ color: 'var(--crimson)' }} />
                  <h2 className="h3">Gemini API key</h2>
                </span>
                {backend?.up ? <span className="badge badge-low">server key</span> : null}
              </div>

              <p className="small muted" style={{ marginBottom: '1rem' }}>
                Only needed when no Nexa API is reachable. The key is kept in this browser's local storage and
                sent directly to Google from your device. It is never written to a Nexa server or included in
                the exported bundle.
              </p>

              <div className="field" style={{ marginBottom: '0.8rem' }}>
                <label htmlFor="key">Google AI Studio API key</label>
                <div className="row" style={{ gap: 6 }}>
                  <input
                    id="key"
                    className="input mono"
                    type={reveal ? 'text' : 'password'}
                    placeholder="AIza…"
                    value={key}
                    onChange={(e) => { setKey(e.target.value); setStatus('idle'); }}
                    autoComplete="off"
                    spellCheck={false}
                  />
                  <button className="btn-icon" onClick={() => setReveal((v) => !v)} aria-label={reveal ? 'Hide key' : 'Show key'}>
                    <Icon name={reveal ? 'close' : 'search'} size={15} />
                  </button>
                </div>
              </div>

              <div className="row" style={{ gap: '0.5rem', flexWrap: 'wrap' }}>
                <button className="btn btn-primary btn-sm" onClick={save}>
                  <Icon name="check" size={13} /> Save key
                </button>
                <button className="btn btn-ghost btn-sm" onClick={test} disabled={testing}>
                  {testing ? <span className="spinner" /> : <Icon name="zap" size={13} />}
                  Test connection
                </button>
                {key && (
                  <button className="btn btn-ghost btn-sm" onClick={clear}>
                    <Icon name="trash" size={13} /> Remove
                  </button>
                )}
                <a className="btn btn-ghost btn-sm" href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer">
                  Get a free key <Icon name="external" size={13} />
                </a>
              </div>

              {status !== 'idle' && (
                <div
                  className={cx('card', 'card-tight', 'a-up')}
                  style={{
                    marginTop: '0.9rem',
                    background: 'var(--surface)',
                    borderColor: status === 'ok' ? 'rgb(52 211 153 / 0.4)' : 'rgb(255 61 99 / 0.4)',
                  }}
                >
                  <div className="row" style={{ gap: 7, alignItems: 'flex-start' }}>
                    <span style={{ color: status === 'ok' ? 'var(--jade)' : 'var(--crimson)', marginTop: 2 }}>
                      <Icon name={status === 'ok' ? 'check' : 'alert'} size={14} />
                    </span>
                    <span className="tiny" style={{ color: 'var(--ink-2)' }}>{detail}</span>
                  </div>
                </div>
              )}

              {models.length > 0 && (
                <div style={{ marginTop: '1rem' }}>
                  <span className="stat-label" style={{ display: 'block', marginBottom: '0.5rem' }}>
                    Available models ({models.length})
                  </span>
                  <div className="row" style={{ gap: 4, flexWrap: 'wrap' }}>
                    {models.slice(0, 10).map((m) => (
                      <span key={m.id} className="badge mono" style={{ textTransform: 'none' }}>{m.id}</span>
                    ))}
                  </div>
                </div>
              )}
            </Reveal>

            {/* Appearance */}
            <Reveal delay={100} className="card">
              <div className="row" style={{ gap: 8, marginBottom: '1rem' }}>
                <Icon name={theme === 'dark' ? 'moon' : 'sun'} size={17} style={{ color: 'var(--gold)' }} />
                <h2 className="h3">Appearance</h2>
              </div>

              <div className="stack" style={{ gap: '1rem' }}>
                <div className="row-between">
                  <div className="stack" style={{ gap: 2 }}>
                    <strong style={{ fontSize: 'var(--fs-sm)' }}>Theme</strong>
                    <span className="tiny muted">Currently {theme === 'dark' ? 'dark' : 'light'}</span>
                  </div>
                  <button className="btn btn-ghost btn-sm" onClick={toggleTheme}>
                    Switch to {theme === 'dark' ? 'light' : 'dark'}
                  </button>
                </div>

                <hr className="hr" />

                <div className="row-between">
                  <div className="stack" style={{ gap: 2 }}>
                    <strong style={{ fontSize: 'var(--fs-sm)' }}>Language</strong>
                    <span className="tiny muted">Sets the default assistant language and label style</span>
                  </div>
                  <div className="seg">
                    <button className={lang === 'en' ? 'on' : ''} onClick={() => setLang('en')}>English</button>
                    <button className={lang === 'ne' ? 'on' : ''} onClick={() => setLang('ne')}>नेपाली</button>
                  </div>
                </div>

                <hr className="hr" />

                <div className="row-between">
                  <div className="stack" style={{ gap: 2 }}>
                    <strong style={{ fontSize: 'var(--fs-sm)' }}>Reduce motion</strong>
                    <span className="tiny muted">Disables all animation, including ambient loops</span>
                  </div>
                  <Toggle on={settings.reduceMotion} onChange={(v) => update({ reduceMotion: v })} label="Reduce motion" />
                </div>
              </div>
            </Reveal>
          </div>

          <div className="stack" style={{ gap: 'var(--sp-4)' }}>
            {/* Connection */}
            <Reveal delay={140} className="card">
              <div className="row" style={{ gap: 8, marginBottom: '1rem' }}>
                <Icon name="cpu" size={17} style={{ color: 'var(--glacier)' }} />
                <h2 className="h3">Connection</h2>
              </div>

              <dl className="kv">
                <dt>Nexa API</dt>
                <dd>{backend?.up ? 'reachable' : 'not reachable'}</dd>
                <dt>Transport</dt>
                <dd>{backend?.up ? 'server proxy' : 'direct from browser'}</dd>
                <dt>Browser key</dt>
                <dd>{key ? 'configured' : 'not set'}</dd>
                <dt>Models on server</dt>
                <dd>{backend?.models.length ?? 0}</dd>
              </dl>

              <button className="btn btn-ghost btn-sm btn-block" style={{ marginTop: '1rem' }} onClick={() => void refreshBackend()}>
                <Icon name="refresh" size={13} /> Re-check connection
              </button>

              <p className="tiny muted" style={{ marginTop: '0.8rem' }}>
                {backend?.up
                  ? 'Nexa is using the bundled Node API, which keeps its Gemini key server-side and adds model discovery.'
                  : 'Nexa is running as a pure static site. The optional Node API at /api is what enables server-side keys.'}
              </p>
            </Reveal>

            {/* Data */}
            <Reveal delay={200} className="card">
              <div className="row" style={{ gap: 8, marginBottom: '1rem' }}>
                <Icon name="file" size={17} style={{ color: 'var(--jade)' }} />
                <h2 className="h3">Local data</h2>
              </div>

              <dl className="kv">
                <dt>Citizen signals</dt>
                <dd>{signalCount}</dd>
                <dt>Conversations</dt>
                <dd>{(JSON.parse(localStorage.getItem('nexa.chats') ?? '[]') as unknown[]).length}</dd>
                <dt>Storage</dt>
                <dd>browser only</dd>
              </dl>

              <div className="row" style={{ gap: '0.5rem', marginTop: '1rem', flexWrap: 'wrap' }}>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={async () => {
                    const r = await syncAll();
                    setSignals(loadSignals());
                    toast(r.pushed ? 'ok' : 'warn', r.pushed ? 'Synced to the Nexa API.' : 'No API reachable.');
                  }}
                  disabled={!backend?.up}
                >
                  <Icon name="refresh" size={13} /> Sync now
                </button>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => {
                    localStorage.removeItem('nexa.signals');
                    setSignals([]);
                    setSignalCount(0);
                    toast('info', 'Local signals cleared.');
                  }}
                  disabled={!signalCount}
                >
                  <Icon name="trash" size={13} /> Clear signals
                </button>
              </div>
            </Reveal>

            {/* About */}
            <Reveal delay={260} className="card card-accent" style={{ ['--accent' as string]: 'var(--grad-glacier)' }}>
              <div className="row" style={{ gap: 8, marginBottom: '0.8rem' }}>
                <Icon name="info" size={17} style={{ color: 'var(--glacier)' }} />
                <h2 className="h3">About this build</h2>
              </div>
              <p className="small muted">
                Nexa is a static-first civic platform. It works with no backend, no account and no network
                connection — every figure on the atlas comes from the bundled knowledge base, and every index
                is computed in the browser so you can audit it.
              </p>
              <div className="row" style={{ gap: '0.5rem', marginTop: '1rem', flexWrap: 'wrap' }}>
                <Link className="btn btn-ghost btn-sm" to="/about">
                  <Icon name="book" size={13} /> Methodology
                </Link>
                <Link className="btn btn-ghost btn-sm" to="/ask">
                  <Icon name="sparkle" size={13} /> Ask Sakhi
                </Link>
              </div>
            </Reveal>
          </div>
        </div>

        <div style={{ marginTop: 'var(--sp-5)' }}>
          <SourceNote text="Nexa publishes indices, not measurements. Every composite is derived from published inputs and recomputable from the bundled dataset." />
        </div>
      </Section>
    </>
  );
}

function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={() => onChange(!on)}
      style={{
        width: 42,
        height: 24,
        borderRadius: 999,
        padding: 3,
        background: on ? 'var(--grad-crimson)' : 'var(--surface-2)',
        border: '1px solid var(--line)',
        display: 'flex',
        justifyContent: on ? 'flex-end' : 'flex-start',
        transition: 'background 200ms',
      }}
    >
      <span style={{ width: 18, height: 18, borderRadius: 999, background: '#fff', boxShadow: 'var(--sh-sm)' }} />
    </button>
  );
}