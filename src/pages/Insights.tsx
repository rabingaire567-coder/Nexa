import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { SECTOR_ACCENT } from '@/components/NepalMap';
import { Icon, SECTOR_ICON } from '@/components/Icon';
import { Bar, Empty, Reveal, Section, SeverityBadge, SourceNote, Stat } from '@/components/ui';
import { districts, nationalFile, profileOf, sectors } from '@/lib/nepal';
import { useNexa } from '@/store/AppContext';
import { generateInsight, NexaError, type Insight } from '@/lib/ai';
import { loadSignals, syncAll } from '@/lib/db';
import type { SectorId, Signal } from '@/types';
import { compact, grade, num } from '@/lib/utils';

/** Deterministic, model-free briefing so the page is useful without an API key. */
function localInsight(signals: Signal[]): Insight | null {
  if (signals.length < 3) return null;

  const bySector = new Map<SectorId, Signal[]>();
  for (const s of signals) {
    if (!bySector.has(s.sector)) bySector.set(s.sector, []);
    bySector.get(s.sector)!.push(s);
  }

  const top = [...bySector.entries()].sort((a, b) => b[1].length - a[1].length)[0];
  const [topId, topList] = top;

  const byDistrict = new Map<string, number>();
  for (const s of signals) byDistrict.set(s.district, (byDistrict.get(s.district) ?? 0) + 1);
  const worstDistrict = [...byDistrict.entries()].sort((a, b) => b[1] - a[1])[0];

  const sector = sectors.find((s) => s.id === topId)!;
  const d = districts.find((x) => x.id === worstDistrict[0]);

  return {
    headline: `${sector.name} dominates ${signals.length} citizen signals, concentrated in ${d?.name ?? worstDistrict[0]}`,
    summary:
      `${topList.length} of ${signals.length} reports concern ${sector.name.toLowerCase()}. ` +
      `${d?.name ?? 'The affected district'} accounts for the largest cluster at ${worstDistrict[1]} report${worstDistrict[1] === 1 ? '' : 's'}. ` +
      `This matches the published national baseline: ${sector.headline} The mechanism is structural rather than incidental — ` +
      `the sector's causal chain does not break without a targeted intervention, not with awareness.`,
    hotspots: [...bySector.entries()]
      .sort((a, b) => b[1].length - a[1].length)
      .slice(0, 4)
      .map(([id, list]) => {
        const sec = sectors.find((s) => s.id === id)!;
        const dName = districts.find((x) => x.id === list[0].district)?.name ?? list[0].district;
        return {
          place: dName,
          sector: id,
          why: `${list.length} report${list.length === 1 ? '' : 's'} on ${sec.name.toLowerCase()}; district index ${profileOf(list[0].district)?.severity[id] ?? '—'}/100.`,
          severity: profileOf(list[0].district)?.severity[id] ?? 50,
        };
      }),
    predictions: [
      {
        window: 'Next 90 days',
        sector: topId,
        forecast: `If the current report rate holds, ${sector.name.toLowerCase()} will remain the binding constraint in ${d?.name ?? 'the affected district'} through the dry season.`,
        confidence: signals.length > 8 ? 'medium' : 'low',
      },
      {
        window: 'Next 6 months',
        sector: 'flood',
        forecast: `Monsoon drainage capacity is the recurring failure mode; ${nationalFile.monsoon.bans.length} annual road-ban categories point to the same access bottleneck.`,
        confidence: 'medium',
      },
    ],
    actions: sector.solutions.slice(0, 3).map((sol) => ({
      title: sol.title,
      owner: `${d?.hq ?? 'Ward'} office with ${nationalFile.emergencies.items[0].name}`,
      window: sol.horizon,
      impact: sol.impact,
      steps: [sol.how, `Baseline against the ${sector.anchor.label} anchor before committing funds.`],
    })),
    citizenActions: [
      `Log every ${sector.name.toLowerCase()} incident in Nexa with date, ward and GPS so the pattern becomes undeniable.`,
      `Raise the issue at the ${d?.hq ?? 'local'} ward meeting with the report count as evidence.`,
      `Share the district profile link so neighbours see the same index you do.`,
    ],
  };
}

export default function Insights() {
  const { signals, setSignals, backend, hasKey, toast } = useNexa();
  const [insight, setInsight] = useState<Insight | null>(null);
  const [busy, setBusy] = useState(false);
  const [live, setLive] = useState('');
  const [usedAI, setUsedAI] = useState(false);

  useEffect(() => setSignals(loadSignals()), [setSignals]);
  useEffect(() => setInsight(localInsight(signals)), [signals]);

  const stats = useMemo(() => {
    const bySector = new Map<SectorId, number>();
    for (const s of signals) bySector.set(s.sector, (bySector.get(s.sector) ?? 0) + 1);
    const byDistrict = new Map<string, number>();
    for (const s of signals) byDistrict.set(s.district, (byDistrict.get(s.district) ?? 0) + 1);
    return { bySector, byDistrict };
  }, [signals]);

  async function run(): Promise<void> {
    if (!backend?.up && !hasKey) {
      toast('warn', 'Add a Gemini API key to generate an AI briefing. The local heuristic below works without one.');
      return;
    }
    if (signals.length < 3) {
      toast('warn', 'Report at least three signals first — the briefing needs a pattern to read.');
      return;
    }

    setBusy(true);
    setLive('');
    const lines = signals
      .slice(0, 60)
      .map((s) => {
        const d = districts.find((x) => x.id === s.district);
        const sec = sectors.find((x) => x.id === s.sector);
        return `- [${sec?.name ?? s.sector}] ${d?.name ?? s.district}${s.city ? ` / ${s.city}` : ''} · severity ${s.severity} · ${s.title} — ${s.detail}`;
      })
      .join('\n');

    const prompt = `${signals.length} civic signals from Nepal, newest first:\n\n${lines}\n\nAggregate them by sector and district.`;
    try {
      const ai = await generateInsight(prompt, (_t, full) => setLive(full));
      if (ai) {
        setInsight(ai);
        setUsedAI(true);
        toast('ok', 'AI briefing generated.');
      } else {
        toast('warn', 'The model returned no usable briefing. Showing the local analysis instead.');
      }
    } catch (err) {
      toast('err', err instanceof NexaError ? err.message : 'Could not generate a briefing.');
    } finally {
      setBusy(false);
      setLive('');
    }
  }

  async function sync(): Promise<void> {
    const r = await syncAll();
    setSignals(loadSignals());
    toast(r.pushed ? 'ok' : 'warn', r.pushed ? 'Signals synced.' : 'No API reachable — nothing synced.');
  }

  return (
    <>
      <Section tight>
        <div className="row-between" style={{ alignItems: 'flex-end' }}>
          <div className="stack" style={{ gap: '0.5rem', maxWidth: '62ch' }}>
            <span className="eyebrow">Operational briefing</span>
            <h1 className="h1" style={{ fontSize: 'clamp(2.2rem, 5vw, 3.4rem)' }}>
              From signals <span className="grad-crimson">to decisions</span>
            </h1>
            <p className="lede">
              Nexa aggregates the civic signals collected on this device, reads them against the sector
              mechanisms, and produces a briefing a ward officer could act on Monday.
            </p>
          </div>
          <div className="row" style={{ gap: '0.5rem', flexWrap: 'wrap' }}>
            <button className="btn btn-ghost btn-sm" onClick={sync} disabled={!backend?.up}>
              <Icon name="refresh" size={13} /> Sync
            </button>
            <button className="btn btn-ai" onClick={run} disabled={busy || signals.length < 3}>
              {busy ? <span className="spinner" /> : <Icon name="sparkle" size={16} />}
              Generate AI briefing
            </button>
          </div>
        </div>
      </Section>

      <Section tight>
        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
          <Stat label="Signals collected" value={signals.length} icon="flag" />
          <Stat label="Districts affected" value={stats.byDistrict.size} icon="map" />
          <Stat label="Sectors represented" value={stats.bySector.size} icon="layers" />
          <Stat
            label="Mean severity"
            value={signals.length ? signals.reduce((a, s) => a + s.severity, 0) / signals.length : 0}
            decimals={1}
            icon="alert"
          />
        </div>
      </Section>

      {signals.length < 3 ? (
        <Section tight>
          <Empty
            icon="flag"
            title="Not enough signals to read a pattern"
            hint="The briefing needs at least three reports. Submit a few from different places, or generate demonstration signals to explore the analysis."
          />
          <div className="row" style={{ justifyContent: 'center', gap: '0.5rem', marginTop: '1.2rem', flexWrap: 'wrap' }}>
            <Link className="btn btn-primary" to="/report">
              <Icon name="plus" size={15} /> Report a problem
            </Link>
            <SeedButton onDone={() => setSignals(loadSignals())} />
          </div>
        </Section>
      ) : (
        <>
          {/* Briefing */}
          <Section tight>
            <Reveal dir="up" className="card card-solid card-accent" style={{ ['--accent' as string]: usedAI ? 'var(--grad-glacier)' : 'var(--grad-crimson)' }}>
              <div className="row-between" style={{ alignItems: 'flex-start', marginBottom: '1rem' }}>
                <span className="row" style={{ gap: 8 }}>
                  <Icon name="bulb" size={17} style={{ color: usedAI ? 'var(--glacier)' : 'var(--crimson)' }} />
                  <span className="eyebrow" style={{ margin: 0 }}>Briefing</span>
                </span>
                <span className={`badge ${usedAI ? 'badge-ai' : ''}`}>{usedAI ? 'AI generated' : 'local analysis'}</span>
              </div>

              <h2 className="h3" style={{ marginBottom: '0.7rem', maxWidth: '46ch' }}>{insight?.headline}</h2>
              <p className="lede" style={{ fontSize: 'var(--fs-base)' }}>{insight?.summary}</p>

              {busy && live && (
                <div className="card card-tight a-up" style={{ marginTop: '1rem', background: 'var(--surface)' }}>
                  <span className="tiny muted">Streaming raw model output…</span>
                  <p className="tiny mono clamp-3" style={{ color: 'var(--ink-3)' }}>{live}</p>
                </div>
              )}
            </Reveal>
          </Section>

          {/* Hotspots */}
          {insight?.hotspots?.length ? (
            <Section eyebrow="Hotspots" title="Where the reports cluster">
              <div className="grid stagger" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(272px, 1fr))' }}>
                {insight.hotspots.map((h, i) => {
                  const sec = sectors.find((s) => s.id === h.sector);
                  const acc = SECTOR_ACCENT[h.sector] ?? 'var(--crimson)';
                  return (
                    <div key={i} className="card" style={{ borderTop: `2px solid ${acc}` }}>
                      <div className="row-between" style={{ marginBottom: '0.6rem' }}>
                        <span className="row" style={{ gap: 7 }}>
                          <Icon name={SECTOR_ICON[h.sector] ?? 'target'} size={14} style={{ color: acc }} />
                          <strong style={{ fontSize: 'var(--fs-sm)' }}>{h.place}</strong>
                        </span>
                        <SeverityBadge value={h.severity} />
                      </div>
                      <p className="small muted">{h.why}</p>
                      <div style={{ marginTop: '0.8rem' }}>
                        <Bar value={h.severity} color={`linear-gradient(90deg, ${acc}, ${acc}44)`} height={5} />
                      </div>
                      {sec && (
                        <Link className="btn btn-ghost btn-sm" to={`/sectors/${sec.id}`} style={{ marginTop: '0.9rem' }}>
                          {sec.name} solutions <Icon name="arrowRight" size={13} />
                        </Link>
                      )}
                    </div>
                  );
                })}
              </div>
            </Section>
          ) : null}

          <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 'var(--sp-5)', alignItems: 'start' }}>
            {/* Predictions */}
            {insight?.predictions?.length ? (
              <Reveal className="card">
                <span className="eyebrow" style={{ marginBottom: '0.8rem' }}>Forecast</span>
                <div className="stack" style={{ gap: '0.9rem' }}>
                  {insight.predictions.map((p, i) => {
                    const sec = sectors.find((s) => s.id === p.sector);
                    return (
                      <div key={i} className="stack" style={{ gap: 4 }}>
                        <div className="row-between">
                          <span className="row" style={{ gap: 6 }}>
                            <Icon name={SECTOR_ICON[p.sector] ?? 'clock'} size={13} style={{ color: SECTOR_ACCENT[p.sector] }} />
                            <span className="badge">{p.window}</span>
                          </span>
                          <span className={`badge ${p.confidence === 'high' ? 'badge-crit' : p.confidence === 'medium' ? 'badge-mid' : ''}`}>
                            {p.confidence} confidence
                          </span>
                        </div>
                        <p className="small muted">{p.forecast}</p>
                        {sec && <span className="tiny muted">Sector: {sec.name}</span>}
                      </div>
                    );
                  })}
                </div>
              </Reveal>
            ) : null}

            {/* Actions */}
            {insight?.actions?.length ? (
              <Reveal delay={120} className="card">
                <span className="eyebrow" style={{ marginBottom: '0.8rem' }}>Recommended actions</span>
                <div className="stack" style={{ gap: '1rem' }}>
                  {insight.actions.map((a, i) => (
                    <div key={i} style={{ paddingBottom: '0.9rem', borderBottom: i < insight.actions!.length - 1 ? '1px solid var(--line)' : undefined }}>
                      <div className="row-between" style={{ marginBottom: 5 }}>
                        <strong style={{ fontSize: 'var(--fs-sm)' }}>{a.title}</strong>
                        <span className="mono tiny" style={{ color: grade(a.impact).color, fontWeight: 700 }}>+{a.impact}</span>
                      </div>
                      <div className="row" style={{ gap: 6, marginBottom: 6, flexWrap: 'wrap' }}>
                        <span className="badge badge-ai">
                          <Icon name="users" size={11} /> {a.owner}
                        </span>
                        <span className="badge">
                          <Icon name="clock" size={11} /> {a.window}
                        </span>
                      </div>
                      <ol className="stack" style={{ gap: 3, listStyle: 'none' }}>
                        {a.steps.map((s, j) => (
                          <li key={j} className="row" style={{ gap: 7, alignItems: 'flex-start' }}>
                            <span className="mono tiny muted" style={{ minWidth: 12 }}>{j + 1}.</span>
                            <span className="tiny muted">{s}</span>
                          </li>
                        ))}
                      </ol>
                    </div>
                  ))}
                </div>
              </Reveal>
            ) : null}
          </div>

          {/* Citizen actions */}
          {insight?.citizenActions?.length ? (
            <Section eyebrow="What you can do" title="Individual actions">
              <div className="grid stagger" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(272px, 1fr))' }}>
                {insight.citizenActions.map((c, i) => (
                  <div key={i} className="card card-tight">
                    <div className="row" style={{ gap: 9, alignItems: 'flex-start' }}>
                      <span className="msg-av" style={{ width: 22, height: 22, fontSize: 10, background: 'var(--grad-crimson)', color: '#fff' }}>
                        {i + 1}
                      </span>
                      <span className="small" style={{ color: 'var(--ink-2)' }}>{c}</span>
                    </div>
                  </div>
                ))}
              </div>
            </Section>
          ) : null}

          {/* Breakdown */}
          <Section tight>
            <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 'var(--sp-5)', alignItems: 'start' }}>
              <Reveal className="card">
                <span className="eyebrow" style={{ marginBottom: '0.8rem' }}>Reports by sector</span>
                <div className="stack" style={{ gap: '0.6rem' }}>
                  {[...stats.bySector.entries()].sort((a, b) => b[1] - a[1]).map(([id, n]) => {
                    const sec = sectors.find((s) => s.id === id);
                    const max = Math.max(...stats.bySector.values());
                    return (
                      <div key={id} className="stack" style={{ gap: 4 }}>
                        <div className="row-between tiny">
                          <span className="row" style={{ gap: 6 }}>
                            <Icon name={SECTOR_ICON[id] ?? 'target'} size={12} style={{ color: SECTOR_ACCENT[id] }} />
                            <span className="muted">{sec?.name ?? id}</span>
                          </span>
                          <span className="mono">{n}</span>
                        </div>
                        <Bar value={n} max={max} color={`linear-gradient(90deg, ${SECTOR_ACCENT[id] ?? 'var(--crimson)'}, transparent)`} height={5} />
                      </div>
                    );
                  })}
                </div>
              </Reveal>

              <Reveal delay={120} className="card">
                <span className="eyebrow" style={{ marginBottom: '0.8rem' }}>Reports by district</span>
                <div className="stack" style={{ gap: '0.4rem', maxHeight: 260, overflowY: 'auto' }}>
                  {[...stats.byDistrict.entries()]
                    .sort((a, b) => b[1] - a[1])
                    .map(([id, n]) => {
                      const d = districts.find((x) => x.id === id);
                      const p = profileOf(id);
                      return (
                        <Link key={id} to={`/districts/${id}`} className="row-between" style={{ padding: '0.3rem 0.35rem', borderRadius: 'var(--r-xs)', fontSize: 'var(--fs-sm)' }}>
                          <span className="row" style={{ gap: 7, minWidth: 0 }}>
                            <span className="muted truncate">{d?.name ?? id}</span>
                            {p && <span className="tiny muted truncate">{d?.hq}</span>}
                          </span>
                          <span className="row" style={{ gap: 8, flexShrink: 0 }}>
                            <span className="mono tiny">{n}</span>
                            {p && <span className="tiny" style={{ color: grade(p.composite).color }}>{p.composite}</span>}
                          </span>
                        </Link>
                      );
                    })}
                </div>
              </Reveal>
            </div>
          </Section>
        </>
      )}

      <Section tight>
        <SourceNote text={`Monsoon road-ban categories: ${nationalFile.monsoon.bans.length}. National population: ${compact(nationalFile.headline.find((h) => h.id === 'pop')?.value ?? 0)} across ${num(districts.length)} districts. Citizen signals are unverified self-reports.`} />
      </Section>
    </>
  );
}

/** Creates a small set of realistic demonstration signals for exploration. */
function SeedButton({ onDone }: { onDone: () => void }) {
  const { toast } = useNexa();
  const [busy, setBusy] = useState(false);

  const seeds = [
    { sector: 'traffic' as SectorId, district: 'kathmandu', title: 'Ring Road congestion now over 40 minutes at grade junction', detail: 'Heavy traffic every evening from 17:00 to 20:00. Commuters report 40+ minute delays through the grade separator approach.', severity: 4 as const },
    { sector: 'traffic' as SectorId, district: 'lalitpur', title: 'Gwarko bottleneck worsening during school hours', detail: 'Vehicles queue back nearly a kilometre between 07:30 and 09:00. Pedestrians cross unsignalised mid-block.', severity: 3 as const },
    { sector: 'flood' as SectorId, district: 'kaski', title: 'Waterlogging at Bhairabati after every heavy afternoon shower', detail: 'Water accumulates for two to three hours because the outlet is undersized. Shops in the lower block are affected.', severity: 4 as const },
    { sector: 'air' as SectorId, district: 'bhaktapur', title: 'Brick kiln smoke visible across the valley at dawn', detail: 'Seasonal kilns on the eastern edge burn openly. Visibility drops noticeably by 06:00 and residents report throat irritation.', severity: 3 as const },
    { sector: 'waste' as SectorId, district: 'kathmandu', title: 'Municipal bin overflow in dense residential lanes', detail: 'Bins are emptied once daily, which is not enough in summer. Waste spills into the road and drains.', severity: 3 as const },
    { sector: 'health' as SectorId, district: 'jumla', title: 'Ambulance takes over four hours to reach the district hospital', detail: 'Single road access. A referral took 4.5 hours for a suspected fracture. Community health workers have no transport.', severity: 5 as const },
  ];

  return (
    <button
      className="btn btn-ghost"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        const { addSignal } = await import('@/lib/db');
        for (const s of seeds) {
          const d = districts.find((x) => x.id === s.district)!;
          addSignal({ ...s, lat: d.lat, lon: d.lon });
        }
        setBusy(false);
        toast('ok', `Added ${seeds.length} demonstration signals.`);
        onDone();
      }}
    >
      {busy ? <span className="spinner" /> : <Icon name="sparkle" size={15} />}
      Load demonstration signals
    </button>
  );
}