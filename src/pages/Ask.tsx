import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Icon } from '@/components/Icon';
import { NexaError, ask, districtOpener, newConversationId, type AskOptions } from '@/lib/ai';
import { answerFromKb } from '@/lib/kb';
import { deleteThread, type ChatThread } from '@/lib/db';
import { districtById, sectorById, cityById } from '@/lib/nepal';
import { useNexa } from '@/store/AppContext';
import type { ChatMessage } from '@/types';
import { cx, renderMarkdown, timeAgo } from '@/lib/utils';

const SUGGESTIONS = [
  'How bad is air pollution in Kathmandu Valley compared to the WHO guideline?',
  'Which districts are most exposed to GLOF and riverine flood?',
  'Why does the Terai flood every monsoon, mechanically?',
  'What would it cost a ward in Biratnagar to fix chronic waterlogging?',
  'Compare Chitwan and Jumla on healthcare access.',
  'Why is digital literacy the binding constraint, not internet coverage?',
];

const NEPALI_SUGGESTIONS = [
  'काठमाडौंको वायु प्रदूषण कति छतर हो?',
  'कुन जिल्लाहरूमा बाढीको जोखिम सबैभन्दा बढी छ?',
  'पहाडमा स्वास्थ्य सेवा किन पहुँच छैन?',
  'प्लास्टिक फोहोर व्यवस्थापनका वास्तविक उपायहरू के हुन्?',
];

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Yields the accumulated text a few words at a time so Knowledge Mode reads like
 * a streamed model response instead of snapping in all at once.
 */
async function* streamWords(text: string): AsyncGenerator<string> {
  const words = text.split(/(\s+)/);
  let acc = '';
  for (const w of words) {
    acc += w;
    yield acc;
    if (!/^\s+$/.test(w)) await sleep(9);
  }
}

export default function Ask() {
  const [params] = useSearchParams();
  const { hasKey, backend, toast, threads, upsertThread, settings } = useNexa();

  const [threadId, setThreadId] = useState<string>(() => newConversationId());
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [streaming, setStreaming] = useState('');
  const [liveTools, setLiveTools] = useState<{ name: string; args: Record<string, unknown> }[]>([]);
  const [transport, setTransport] = useState<string>('');
  const [modelUsed, setModelUsed] = useState<string>('');
  const [showSide, setShowSide] = useState(false);

  const logRef = useRef<HTMLDivElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  /* Seed the draft from deep links: /ask?d=<district> /?s=<sector> /?c=<city> */
  useEffect(() => {
    const d = params.get('d');
    const s = params.get('s');
    const c = params.get('c');
    let seed = '';
    if (d && districtById.has(d)) seed = districtOpener(d);
    else if (c && cityById.has(c)) seed = `Tell me about everyday problems in ${cityById.get(c)!.name}.`;
    else if (s && sectorById.has(s as never)) seed = `Explain the ${sectorById.get(s as never)!.name.toLowerCase()} problem in Nepal and what actually fixes it.`;
    if (seed) setDraft(seed);
  }, [params]);

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, streaming]);

  useEffect(() => {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = `${Math.min(ta.scrollHeight, 168)}px`;
  }, [draft]);

  const openThread = useCallback(
    (t: ChatThread) => {
      abortRef.current?.abort();
      setThreadId(t.id);
      setMessages(t.messages);
      setStreaming('');
      setLiveTools([]);
      setShowSide(false);
    },
    [],
  );

  const startNew = useCallback(() => {
    abortRef.current?.abort();
    setThreadId(newConversationId());
    setMessages([]);
    setStreaming('');
    setLiveTools([]);
    setShowSide(false);
    taRef.current?.focus();
  }, []);

  async function send(text?: string): Promise<void> {
    const prompt = (text ?? draft).trim();
    if (!prompt || busy) return;

    const userMsg: ChatMessage = { role: 'user', text: prompt, at: Date.now() };
    const next = [...messages, userMsg];
    setMessages(next);
    setDraft('');
    setBusy(true);
    setStreaming('');
    setLiveTools([]);

    const ctl = new AbortController();
    abortRef.current = ctl;

    const commit = (out: ChatMessage, transport: string, model: string) => {
      const final = [...next, out];
      setMessages(final);
      setStreaming('');
      setTransport(transport);
      setModelUsed(model);
      upsertThread({
        id: threadId,
        title: final.find((m) => m.role === 'user')?.text.slice(0, 60) ?? 'New conversation',
        createdAt: final[0].at,
        updatedAt: Date.now(),
        messages: final,
      });
    };

    // Knowledge Mode: no key configured, so answer from the bundled dataset
    // instead of showing a dead composer. Retrieval is instant, but it is
    // streamed word-by-word so the reading experience matches the live model.
    if (!hasKey && !backend?.up) {
      const answer = answerFromKb(prompt);
      setLiveTools(answer.tools);
      try {
        for await (const chunk of streamWords(answer.text)) {
          if (ctl.signal.aborted) break;
          setStreaming(chunk);
          await sleep(11);
        }
      } catch {
        /* aborted mid-stream */
      }
      setLiveTools([]);
      if (!ctl.signal.aborted) {
        commit({ role: 'model', text: answer.text, at: Date.now(), tools: answer.tools }, 'knowledge', 'Nexa Knowledge Base');
      }
      setBusy(false);
      abortRef.current = null;
      return;
    }

    const opts: AskOptions = {
      messages: next,
      signal: ctl.signal,
      onDelta: (_t, full) => setStreaming(full),
      onToolUse: (call) => setLiveTools((prev) => [...prev, { name: call.name, args: call.args }]),
    };

    try {
      const res = await ask(opts);
      commit({ role: 'model', text: res.text || '(empty response)', at: Date.now(), tools: res.toolCalls }, res.transport, res.model);
    } catch (err) {
      const message = err instanceof NexaError ? err.message : 'Something went wrong talking to Sakhi.';
      setMessages([...next, { role: 'model', text: message, at: Date.now(), error: true }]);
      setStreaming('');
      if (err instanceof NexaError && err.kind === 'no-key') toast('warn', message);
    } finally {
      setBusy(false);
      abortRef.current = null;
      setLiveTools([]);
    }
  }

  function stop(): void {
    abortRef.current?.abort();
    setBusy(false);
    setStreaming('');
  }

  /**
   * Knowledge Mode is available without a key, so the composer stays live.
   * Only a running request is locked.
   */
  const needsKey = false;
  const suggestions = settings.lang === 'ne' ? NEPALI_SUGGESTIONS : SUGGESTIONS;

  return (
    <div className={cx('chat-shell', showSide && 'show-side')}>
      {/* Thread sidebar */}
      <aside className="chat-side">
        <div style={{ padding: 'var(--sp-4)', borderBottom: '1px solid var(--line)' }}>
          <button className="btn btn-ai btn-block" onClick={startNew}>
            <Icon name="plus" size={15} /> New conversation
          </button>
        </div>

        <div className="scroll-x" style={{ padding: '0.7rem var(--sp-4)', gap: 5, borderBottom: '1px solid var(--line)' }}>
          <span className={`badge ${backend?.up ? 'badge-low' : hasKey ? 'badge-ai' : ''}`}>
            <span className="dot" />
            {backend?.up ? 'Server' : hasKey ? 'Browser' : 'No key'}
          </span>
          {modelUsed && <span className="badge mono" style={{ textTransform: 'none' }}>{modelUsed}</span>}
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '0.7rem' }}>
          {threads.length === 0 ? (
            <p className="tiny muted" style={{ padding: '0.6rem', lineHeight: 1.6 }}>
              Your conversations are saved in this browser. New threads appear here.
            </p>
          ) : (
            <div className="stack" style={{ gap: 2 }}>
              {threads.map((t) => (
                <div key={t.id} className="row" style={{ gap: 2, alignItems: 'stretch' }}>
                  <button className={cx('thread-item', t.id === threadId && 'on')} onClick={() => openThread(t)} style={{ flex: 1 }}>
                    <span className="truncate" style={{ display: 'block', fontWeight: 540 }}>{t.title}</span>
                    <span className="tiny muted">
                      {t.messages.length} message{t.messages.length === 1 ? '' : 's'} · {timeAgo(t.updatedAt)}
                    </span>
                  </button>
                  <button
                    className="btn-icon"
                    style={{ width: 28, height: 28, flexShrink: 0 }}
                    onClick={() => { deleteThread(t.id); toast('info', 'Conversation deleted.'); }}
                    aria-label={`Delete ${t.title}`}
                  >
                    <Icon name="trash" size={13} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ padding: 'var(--sp-4)', borderTop: '1px solid var(--line)' }}>
          <Link className="btn btn-ghost btn-sm btn-block" to="/settings">
            <Icon name="key" size={13} /> {hasKey ? 'Manage API key' : 'Add API key'}
          </Link>
        </div>
      </aside>

      {/* Chat main */}
      <div className="chat-main">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '0.55rem clamp(1rem, 4vw, 2.5rem)', borderBottom: '1px solid var(--line)' }}>
          <button className="btn-icon chat-side-toggle" onClick={() => setShowSide((v) => !v)} aria-label="Toggle conversations">
            <Icon name="menu" size={15} />
          </button>
          <span className="row" style={{ gap: 8, minWidth: 0 }}>
            <span className="badge badge-ai">
              <span className="dot dot-live" /> Sakhi
            </span>
            <span className="tiny muted truncate">Nepal civic intelligence</span>
          </span>
          <span className="row" style={{ gap: 6 }}>
            {transport && <span className="badge mono" style={{ textTransform: 'none' }}>{transport}</span>}
            <Link className="btn btn-ghost btn-sm" to="/atlas">
              <Icon name="map" size={13} /> Atlas
            </Link>
          </span>
        </div>

        <div className="chat-log" ref={logRef}>
          <div className="wrap-narrow" style={{ padding: 0 }}>
            {messages.length === 0 && !streaming ? (
              <Welcome live={hasKey || Boolean(backend?.up)} suggestions={suggestions} onSuggest={(s) => void send(s)} />
            ) : (
              messages.map((m, i) => (
                <Bubble key={i} msg={m} />
              ))
            )}

            {busy && (
              <div className="msg msg-model">
                <span className="msg-av">स</span>
                <div className="msg-body">
                  {liveTools.length > 0 && (
                    <div className="tool-strip">
                      {liveTools.map((t, i) => (
                        <span key={i} className="tool-pill">
                          <Icon name="cpu" size={11} />
                          {t.name}({String(t.args.kind ?? t.args.sector ?? t.args.query ?? '')})
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="bubble">
                    {streaming ? (
                      <>
                        <div dangerouslySetInnerHTML={{ __html: renderMarkdown(streaming) }} />
                        <span className="caret" />
                      </>
                    ) : (
                      <span className="row muted small" style={{ gap: 8 }}>
                        <span className="spinner" />
                        {liveTools.length ? 'Reading the knowledge base…' : 'Thinking…'}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="chat-composer">
          <div className="wrap-narrow" style={{ padding: 0, margin: '0 auto' }}>
            <div className="composer-box">
              <textarea
                ref={taRef}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    void send();
                  }
                }}
                placeholder={needsKey ? 'Add a Gemini API key in Settings to start…' : 'Ask about any district, city or sector in Nepal…  (Enter to send, Shift+Enter for a new line)'}
                rows={1}
                aria-label="Message Sakhi"
                disabled={needsKey}
              />
              {busy ? (
                <button className="btn-icon" onClick={stop} aria-label="Stop generating">
                  <Icon name="close" size={15} />
                </button>
              ) : (
                <button className="btn btn-ai btn-icon" onClick={() => void send()} disabled={!draft.trim() || needsKey} aria-label="Send message">
                  <Icon name="send" size={15} />
                </button>
              )}
            </div>

            <p className="tiny muted" style={{ textAlign: 'center', marginTop: '0.55rem' }}>
              Sakhi grounds every answer in the Nexa knowledge base.{' '}
              <Link to="/about" style={{ color: 'var(--glacier)' }}>How it works</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function Welcome({ live, suggestions, onSuggest }: { live: boolean; suggestions: string[]; onSuggest: (s: string) => void }) {
  return (
    <div style={{ padding: 'clamp(1.5rem, 5vw, 3.4rem) 0', textAlign: 'center' }}>
      <span
        className="msg-av"
        style={{
          width: 52,
          height: 52,
          margin: '0 auto 1.1rem',
          background: 'var(--grad-glacier)',
          color: '#06121f',
          fontSize: '1.3rem',
          animation: 'pop-in 500ms var(--ease-spring) both',
        }}
      >
        स
      </span>

      <h1 className="h2 grad-ink" style={{ marginBottom: '0.6rem' }}>Ask Sakhi</h1>
      <p className="lede" style={{ margin: '0 auto 1.6rem' }}>
        A civic analyst for Nepal. Ask about a district, a city, a sector or a national figure — Sakhi reads the
        same knowledge base the atlas uses, so nothing is invented.
      </p>

      {!live && (
        <div className="card card-accent a-up" style={{ ['--accent' as string]: 'var(--grad-gold)', maxWidth: 560, margin: '0 auto 1.6rem', textAlign: 'left' }}>
          <div className="row" style={{ gap: 9, alignItems: 'flex-start' }}>
            <Icon name="sparkle" size={18} style={{ color: 'var(--gold)', flexShrink: 0, marginTop: 2 }} />
            <div>
              <strong style={{ fontSize: 'var(--fs-sm)', display: 'block', marginBottom: 4 }}>
                Running in Knowledge Mode
              </strong>
              <p className="small muted" style={{ marginBottom: '0.8rem' }}>
                Sakhi is answering straight from the bundled Nexa dataset — 77 districts, 7 provinces and 9 sectors,
                with every figure traceable to its source. Add a free Gemini API key to switch to the live model,
                which reasons in Nepali and English and calls the same tools over the conversation.
              </p>
              <div className="row" style={{ gap: '0.5rem', flexWrap: 'wrap' }}>
                <Link className="btn btn-primary btn-sm" to="/settings">
                  <Icon name="key" size={13} /> Add API key
                </Link>
                <a
                  className="btn btn-ghost btn-sm"
                  href="https://aistudio.google.com/apikey"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Get a free key <Icon name="external" size={13} />
                </a>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(272px, 1fr))', textAlign: 'left', maxWidth: 900, margin: '0 auto' }}>
        {suggestions.map((s, i) => (
          <button key={s} className="suggest" style={{ animationDelay: `${i * 60}ms` }} onClick={() => onSuggest(s)}>
            <Icon name="sparkle" size={13} style={{ color: 'var(--glacier)', marginRight: 6, verticalAlign: -2 }} />
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}

function Bubble({ msg }: { msg: ChatMessage }) {
  const isUser = msg.role === 'user';
  return (
    <div className={cx('msg', isUser ? 'msg-user' : 'msg-model')}>
      <span className="msg-av">{isUser ? 'You' : 'स'}</span>
      <div className="msg-body">
        {!isUser && msg.tools && msg.tools.length > 0 && (
          <div className="tool-strip">
            {msg.tools.map((t, i) => (
              <span key={i} className="tool-pill">
                <Icon name="cpu" size={11} />
                {t.name}({String(t.args.kind ?? t.args.sector ?? t.args.query ?? '')})
              </span>
            ))}
          </div>
        )}
        <div className="bubble" style={msg.error ? { color: 'var(--crimson)' } : undefined}>
          <div dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.text) }} />
        </div>
      </div>
    </div>
  );
}