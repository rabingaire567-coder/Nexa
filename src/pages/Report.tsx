import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { SECTOR_ACCENT } from '@/components/NepalMap';
import { Icon, SECTOR_ICON } from '@/components/Icon';
import { Bar, Reveal, Section, SeverityBadge, SourceNote } from '@/components/ui';
import { cities, districts, districtById, sectors, severityOf } from '@/lib/nepal';
import { addSignal, loadSignals, removeSignal, syncAll } from '@/lib/db';
import { useNexa } from '@/store/AppContext';
import { NexaError, ask } from '@/lib/ai';
import type { SectorId, Signal } from '@/types';
import { cx, dateLabel, timeAgo } from '@/lib/utils';

const SEVERITY_WORDS = [
  { v: 1 as const, label: 'Noticeable', hint: 'Affects some people occasionally' },
  { v: 2 as const, label: 'Annoying', hint: 'Recurring daily friction' },
  { v: 3 as const, label: 'Disrupting', hint: 'Costs time or money regularly' },
  { v: 4 as const, label: 'Serious', hint: 'Blocks access, damages health or property' },
  { v: 5 as const, label: 'Critical', hint: 'Immediate safety or emergency risk' },
];

export default function Report() {
  const [params] = useSearchParams();
  const nav = useNavigate();
  const { signals, setSignals, hasKey, backend, toast } = useNexa();

  const [sector, setSector] = useState<SectorId>((params.get('s') as SectorId) ?? 'traffic');
  const [districtId, setDistrictId] = useState(params.get('d') ?? '');
  const [cityId, setCityId] = useState(params.get('c') ?? '');
  const [title, setTitle] = useState('');
  const [detail, setDetail] = useState('');
  const [severity, setSeverity] = useState<1 | 2 | 3 | 4 | 5>(3);
  const [pos, setPos] = useState<{ lat: number; lon: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<Signal | null>(null);
  const [triageBusy, setTriageBusy] = useState(false);
  const [tab, setTab] = useState<'report' | 'feed'>('report');

  useEffect(() => {
    setSignals(loadSignals());
  }, [setSignals]);

  const district = districtId ? districtById.get(districtId) : undefined;
  const cityOptions = useMemo(() => (districtId ? cities.filter((c) => c.district === districtId) : []), [districtId]);

  const districtSeverity = district ? severityOf(district, sector) : 0;
  const activeSector = sectors.find((s) => s.id === sector);

  function locate(): void {
    if (!navigator.geolocation) {
      toast('err', 'Geolocation is not available in this browser.');
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setPos({ lat: p.coords.latitude, lon: p.coords.longitude });
        setLocating(false);
        const near = nearestDistrict(p.coords.latitude, p.coords.longitude);
        if (near) {
          setDistrictId(near.id);
          toast('ok', `Matched to ${near.name} district from your GPS position.`);
        }
      },
      () => {
        setLocating(false);
        toast('warn', 'Location permission denied. Pick the district manually.');
      },
      { enableHighAccuracy: true, timeout: 9000 },
    );
  }

  async function submit(): Promise<void> {
    if (!districtId) return toast('err', 'Choose a district first.');
    if (title.trim().length < 6) return toast('err', 'Give the problem a short, specific title.');
    if (detail.trim().length < 12) return toast('err', 'Add a sentence or two of detail.');

    setSaving(true);
    const d = districtById.get(districtId)!;

    const sig = addSignal({
      sector,
      district: districtId,
      city: cityId || undefined,
      title: title.trim(),
      detail: detail.trim(),
      severity,
      lat: pos?.lat ?? d.lat,
      lon: pos?.lon ?? d.lon,
    });

    setSignals(loadSignals());
    setSaving(false);
    setSaved(sig);
    setTitle('');
    setDetail('');
    toast('ok', 'Signal recorded. It is now part of the local dataset.');
  }

  async function triage(sig: Signal): Promise<void> {
    setTriageBusy(true);
    const d = districtById.get(sig.district);
    const s = sectors.find((x) => x.id === sig.sector);
    const prompt = `A citizen in ${d?.name ?? sig.district}, ${d?.hq ?? 'Nepal'} reports a ${s?.name.toLowerCase() ?? sig.sector} problem.

Title: ${sig.title}
Severity (1–5): ${sig.severity}
Detail: ${sig.detail}

District context: belt ${d?.belt}, urbanisation ${d?.urb}/100, elevation ${d?.alt} m, population ${d?.pop}.
Sector national severity: ${s?.severity}/100. Anchor: ${s?.anchor.label} = ${s?.anchor.value}${s?.anchor.unit}.

Call nexa_lookup and/or nexa_solutions to ground your answer. Then give:
1. A one-sentence plain-language assessment of severity in this district specifically.
2. Two numbered actions a citizen can take this week, naming the responsible institution.
Keep it under 200 words.`;

    try {
      const res = await ask({ messages: [{ role: 'user', text: prompt, at: Date.now() }] });
      const actions = res.text
        .split('\n')
        .filter((l) => /^\s*\d+[.)]/.test(l))
        .map((l) => l.replace(/^\s*\d+[.)]\s*/, '').trim())
        .slice(0, 4);
      const patched = { aiSummary: res.text.trim(), aiActions: actions };
      const next = loadSignals().map((x) => (x.id === sig.id ? { ...x, ...patched } : x));
      localStorage.setItem('nexa.signals', JSON.stringify(next));
      setSignals(next);
      toast('ok', 'Sakhi triaged the signal.');
    } catch (err) {
      toast('err', err instanceof NexaError ? err.message : 'Could not triage this signal.');
    } finally {
      setTriageBusy(false);
    }
  }

  async function doSync(): Promise<void> {
    const r = await syncAll();
    setSignals(loadSignals());
    toast(r.pushed ? 'ok' : 'warn', r.pushed ? `Synced ${r.pushed} signals to the Nexa API.` : 'No API reachable — signals stay on this device.');
  }

  return (
    <>
      <Section tight>
        <div className="row-between" style={{ alignItems: 'flex-end' }}>
          <div className="stack" style={{ gap: '0.5rem', maxWidth: '60ch' }}>
            <span className="eyebrow">Citizen reporting</span>
            <h1 className="h1" style={{ fontSize: 'clamp(2.2rem, 5vw, 3.4rem)' }}>
              Report it. <span className="grad-crimson">We map it.</span>
            </h1>
            <p className="lede">
              Signals are stored on your device immediately and pushed to the Nexa database when an API is
              reachable. Sakhi can then triage each report against district data and name the next step.
            </p>
          </div>
          <div className="seg">
            <button className={tab === 'report' ? 'on' : ''} onClick={() => setTab('report')}>New report</button>
            <button className={tab === 'feed' ? 'on' : ''} onClick={() => setTab('feed')}>My signals ({signals.length})</button>
          </div>
        </div>
      </Section>

      {tab === 'report' ? (
        <Section tight>
          <div className="grid" style={{ gridTemplateColumns: 'minmax(0, 1.25fr) minmax(0, 0.75fr)', gap: 'var(--sp-5)', alignItems: 'start' }}>
            <Reveal className="card">
              {/* Sector */}
              <div className="field" style={{ marginBottom: '1.1rem' }}>
                <label>Which problem?</label>
                <div className="row" style={{ gap: 5, flexWrap: 'wrap' }}>
                  {sectors.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      className={`chip${sector === s.id ? ' on' : ''}`}
                      onClick={() => setSector(s.id)}
                      style={sector === s.id ? undefined : { borderColor: `${SECTOR_ACCENT[s.id]}44` }}
                    >
                      <Icon name={SECTOR_ICON[s.id]} size={13} style={{ color: sector === s.id ? undefined : SECTOR_ACCENT[s.id] }} />
                      {s.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Location */}
              <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.8rem', marginBottom: '0.8rem' }}>
                <div className="field">
                  <label htmlFor="dist">District *</label>
                  <select id="dist" className="select" value={districtId} onChange={(e) => { setDistrictId(e.target.value); setCityId(''); }}>
                    <option value="">Choose a district…</option>
                    {districts.slice().sort((a, b) => a.name.localeCompare(b.name)).map((d) => (
                      <option key={d.id} value={d.id}>{d.name} — {d.hq}</option>
                    ))}
                  </select>
                </div>

                <div className="field">
                  <label htmlFor="city">City / municipality</label>
                  <select id="city" className="select" value={cityId} onChange={(e) => setCityId(e.target.value)} disabled={!districtId}>
                    <option value="">{districtId ? 'Optional…' : 'Pick a district first'}</option>
                    {cityOptions.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="row-between" style={{ marginBottom: '1.1rem' }}>
                <button className="btn btn-ghost btn-sm" onClick={locate} disabled={locating}>
                  {locating ? <span className="spinner" /> : <Icon name="pin" size={14} />}
                  {locating ? 'Locating…' : 'Use my GPS location'}
                </button>
                <span className="tiny muted mono">
                  {pos ? `${pos.lat.toFixed(4)}, ${pos.lon.toFixed(4)}` : district ? `Defaults to ${district.hq} HQ coordinates` : 'No location set'}
                </span>
              </div>

              {/* Title + detail */}
              <div className="field" style={{ marginBottom: '0.8rem' }}>
                <label htmlFor="title">One-line title *</label>
                <input
                  id="title"
                  className="input"
                  placeholder="e.g. Drain blocked, water pooling at Baneshwor junction"
                  value={title}
                  maxLength={110}
                  onChange={(e) => setTitle(e.target.value)}
                />
                <span className="tiny muted" style={{ textAlign: 'right' }}>{title.length}/110</span>
              </div>

              <div className="field" style={{ marginBottom: '1.1rem' }}>
                <label htmlFor="detail">What is happening? *</label>
                <textarea
                  id="detail"
                  className="textarea"
                  rows={5}
                  placeholder="Describe what you see, how long it has been happening, and who it affects. Specifics make the analysis useful."
                  value={detail}
                  maxLength={900}
                  onChange={(e) => setDetail(e.target.value)}
                />
                <span className="tiny muted" style={{ textAlign: 'right' }}>{detail.length}/900</span>
              </div>

              {/* Severity */}
              <div className="field" style={{ marginBottom: '1.3rem' }}>
                <label>How serious is it for you?</label>
                <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(112px, 1fr))', gap: '0.4rem' }}>
                  {SEVERITY_WORDS.map((s) => (
                    <button
                      key={s.v}
                      type="button"
                      onClick={() => setSeverity(s.v)}
                      className={cx('card', 'card-tight')}
                      style={{
                        textAlign: 'left',
                        padding: '0.55rem 0.65rem',
                        borderColor: severity === s.v ? `var(--${s.v >= 4 ? 'crimson' : s.v >= 3 ? 'gold' : 'jade'})` : undefined,
                        background: severity === s.v ? 'var(--surface-2)' : undefined,
                      }}
                    >
                      <strong style={{ fontSize: 'var(--fs-sm)', display: 'block' }}>{s.v} · {s.label}</strong>
                      <span className="tiny muted">{s.hint}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="row" style={{ gap: '0.5rem', flexWrap: 'wrap' }}>
                <button className="btn btn-primary btn-lg" onClick={submit} disabled={saving}>
                  {saving ? <span className="spinner" /> : <Icon name="check" size={16} />}
                  Submit signal
                </button>
                <Link className="btn btn-ghost btn-lg" to="/ask">
                  Ask Sakhi instead
                </Link>
              </div>

              {saved && (
                <div className="card card-tight card-accent a-up" style={{ ['--accent' as string]: 'var(--grad-gold)', marginTop: '1.1rem', background: 'var(--surface)' }}>
                  <strong style={{ fontSize: 'var(--fs-sm)' }}>Recorded.</strong>{' '}
                  <span className="small muted">It is saved on this device and will sync when the Nexa API is reachable.</span>
                  <div className="row" style={{ gap: '0.5rem', marginTop: '0.7rem' }}>
                    <button className="btn btn-ai btn-sm" onClick={() => { setTab('feed'); void triage(saved); }} disabled={triageBusy}>
                      <Icon name="sparkle" size={13} /> Triage with Sakhi
                    </button>
                    <button className="btn btn-ghost btn-sm" onClick={() => setTab('feed')}>
                      View all signals
                    </button>
                  </div>
                </div>
              )}
            </Reveal>

            {/* Context rail */}
            <Reveal dir="right" delay={120} className="stack" style={{ gap: 'var(--sp-4)' }}>
              {district && activeSector ? (
                <>
                  <div className="card">
                    <span className="eyebrow" style={{ marginBottom: '0.6rem' }}>Context for this report</span>
                    <div className="row-between" style={{ marginBottom: '0.7rem' }}>
                      <div className="stack" style={{ gap: 2 }}>
                        <strong>{district.name}</strong>
                        <span className="tiny muted">{district.hq} · {district.belt} belt</span>
                      </div>
                      <SeverityBadge value={districtSeverity} />
                    </div>
                    <div className="stack" style={{ gap: 5 }}>
                      <div className="row-between tiny">
                        <span className="muted">{activeSector.name} severity here</span>
                        <span className="mono" style={{ color: 'var(--ink)' }}>{districtSeverity}/100</span>
                      </div>
                      <Bar value={districtSeverity} color={`linear-gradient(90deg, ${SECTOR_ACCENT[sector]}, ${SECTOR_ACCENT[sector]}44)`} height={6} />
                    </div>
                    <p className="tiny muted" style={{ marginTop: '0.9rem' }}>{activeSector.headline}</p>
                    <button className="btn btn-ghost btn-sm btn-block" style={{ marginTop: '0.9rem' }} onClick={() => nav(`/districts/${district.id}`)}>
                      Open district profile <Icon name="arrowRight" size={13} />
                    </button>
                  </div>

                  <div className="card">
                    <span className="eyebrow" style={{ marginBottom: '0.6rem' }}>Signs to include</span>
                    <ul className="stack" style={{ gap: 5, listStyle: 'none' }}>
                      {['When did it start, and has it got worse?', 'Exactly which junction, street or ward?', 'How many people are affected daily?', 'Is anyone injured or is a service blocked?', 'Has the ward office or police been informed?']
                        .map((t) => (
                          <li key={t} className="row" style={{ gap: 7, alignItems: 'flex-start' }}>
                            <span style={{ color: 'var(--crimson)', marginTop: 2, flexShrink: 0 }}><Icon name="check" size={12} /></span>
                            <span className="tiny muted">{t}</span>
                          </li>
                        ))}
                    </ul>
                  </div>
                </>
              ) : (
                <div className="card">
                  <span className="eyebrow" style={{ marginBottom: '0.6rem' }}>How triage works</span>
                  <p className="small muted">
                    Pick a district and a sector and Nexa loads the local severity index so you know how your
                    report compares to the baseline. On submit, the signal is timestamped, geolocated and stored
                    locally, then Sakhi can triage it against sector mechanisms and name the responsible body.
                  </p>
                </div>
              )}

              <div className="card">
                <div className="row-between">
                  <span className="eyebrow" style={{ margin: 0 }}>Storage</span>
                  <span className={`badge ${backend?.up ? 'badge-low' : ''}`}>
                    {backend?.up ? 'API connected' : hasKey ? 'Local only' : 'Local only'}
                  </span>
                </div>
                <p className="tiny muted" style={{ margin: '0.7rem 0 0.8rem' }}>
                  Signals live in this browser. Nothing is sent anywhere unless a Nexa API is reachable.
                </p>
                <button className="btn btn-ghost btn-sm btn-block" onClick={doSync} disabled={!backend?.up}>
                  <Icon name="refresh" size={13} /> Sync to database
                </button>
              </div>
            </Reveal>
          </div>

          <div style={{ marginTop: 'var(--sp-5)' }}>
            <SourceNote text="Citizen signals are unverified self-reports. They are stored locally first and are not treated as official statistics." />
          </div>
        </Section>
      ) : (
        <SignalsFeed signals={signals} onTriage={triage} busy={triageBusy} onDelete={(id) => { removeSignal(id); setSignals(loadSignals()); }} />
      )}
    </>
  );
}

function SignalsFeed({
  signals,
  onTriage,
  busy,
  onDelete,
}: {
  signals: Signal[];
  onTriage: (s: Signal) => Promise<void>;
  busy: boolean;
  onDelete: (id: string) => void;
}) {
  if (signals.length === 0) {
    return (
      <Section tight>
        <div className="empty">
          <Icon name="flag" size={26} strokeWidth={1.4} />
          <strong>No signals yet</strong>
          <span className="tiny">Report an everyday problem and it will show up here, timestamped and geolocated.</span>
        </div>
      </Section>
    );
  }

  return (
    <Section tight>
      <div className="grid stagger" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(330px, 1fr))' }}>
        {signals.map((s) => {
          const d = districtById.get(s.district);
          const sec = sectors.find((x) => x.id === s.sector);
          return (
            <div key={s.id} className="card">
              <div className="row-between" style={{ alignItems: 'flex-start', marginBottom: '0.6rem' }}>
                <span
                  className="badge"
                  style={{ borderColor: `${SECTOR_ACCENT[s.sector]}55`, color: SECTOR_ACCENT[s.sector], background: `${SECTOR_ACCENT[s.sector]}14` }}
                >
                  <Icon name={SECTOR_ICON[s.sector]} size={12} /> {sec?.name ?? s.sector}
                </span>
                <span className="row" style={{ gap: 6 }}>
                  <span className={`badge badge-${s.severity >= 4 ? 'crit' : s.severity >= 3 ? 'mid' : 'low'}`}>sev {s.severity}</span>
                  <span className={`badge ${s.synced ? 'badge-low' : ''}`} title={s.synced ? 'Synced to API' : 'Stored on this device only'}>
                    {s.synced ? 'synced' : 'local'}
                  </span>
                </span>
              </div>

              <h3 className="h4">{s.title}</h3>
              <p className="small muted" style={{ margin: '0.4rem 0 0.7rem' }}>{s.detail}</p>

              <div className="row-between tiny muted" style={{ paddingTop: '0.6rem', borderTop: '1px solid var(--line)' }}>
                <span className="row" style={{ gap: 5 }}>
                  <Icon name="pin" size={11} /> {d?.name ?? s.district} · {s.lat.toFixed(2)}, {s.lon.toFixed(2)}
                </span>
                <span title={dateLabel(s.createdAt)}>{timeAgo(s.createdAt)}</span>
              </div>

              {s.aiSummary && (
                <div className="card card-tight a-up" style={{ marginTop: '0.8rem', background: 'var(--surface)', borderColor: 'rgb(56 189 248 / 0.3)' }}>
                  <span className="row" style={{ gap: 6, marginBottom: 5 }}>
                    <Icon name="sparkle" size={12} style={{ color: 'var(--glacier)' }} />
                    <span className="tiny" style={{ color: 'var(--glacier)', fontWeight: 650, letterSpacing: '0.04em' }}>
                      SAKHI TRIAGE
                    </span>
                  </span>
                  <p className="tiny" style={{ color: 'var(--ink-2)', whiteSpace: 'pre-wrap' }}>{s.aiSummary}</p>
                </div>
              )}

              <div className="row" style={{ gap: '0.4rem', marginTop: '0.8rem' }}>
                <button className="btn btn-ghost btn-sm" onClick={() => void onTriage(s)} disabled={busy}>
                  {busy ? <span className="spinner" /> : <Icon name="sparkle" size={13} />}
                  {s.aiSummary ? 'Re-triage' : 'Triage'}
                </button>
                <button className="btn btn-ghost btn-sm" onClick={() => onDelete(s.id)} aria-label="Delete signal">
                  <Icon name="trash" size={13} />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </Section>
  );
}

/** Nearest district HQ by great-circle distance. */
function nearestDistrict(lat: number, lon: number) {
  let best: (typeof districts)[number] | undefined;
  let bestD = Infinity;
  for (const d of districts) {
    const dx = (d.lon - lon) * Math.cos(((lat + d.lat) / 2) * (Math.PI / 180));
    const dy = d.lat - lat;
    const dist = dx * dx + dy * dy;
    if (dist < bestD) {
      bestD = dist;
      best = d;
    }
  }
  return best;
}