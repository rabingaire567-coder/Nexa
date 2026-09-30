import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { SECTOR_ACCENT } from '@/components/NepalMap';
import { Icon, SECTOR_ICON } from '@/components/Icon';
import { Bar, Empty, Reveal, Section, SeverityBadge, SourceNote } from '@/components/ui';
import { districts, sectors, SECTOR_IDS, severityOf, sectorsFile } from '@/lib/nepal';
import type { SectorId } from '@/types';
import { compact, grade } from '@/lib/utils';

export default function Sectors() {
  const [q, setQ] = useState('');
  const order = useMemo(() => sectors.slice().sort((a, b) => b.severity - a.severity), []);

  const list = q.trim()
    ? order.filter((s) => `${s.name} ${s.ne} ${s.headline} ${s.problem}`.toLowerCase().includes(q.trim().toLowerCase()))
    : order;

  return (
    <>
      <Section tight>
        <div className="grid" style={{ gridTemplateColumns: 'minmax(0, 1fr) auto', gap: 'var(--sp-5)', alignItems: 'end' }}>
          <div className="stack" style={{ gap: '0.5rem', maxWidth: '64ch' }}>
            <span className="eyebrow">Nine sectors</span>
            <h1 className="h1" style={{ fontSize: 'clamp(2.2rem, 5vw, 3.4rem)' }}>
              Nine problems, <span className="grad-crimson">nine mechanisms</span>
            </h1>
            <p className="lede">
              Each sector is decomposed into the mechanism that causes it, the anchor figure that measures it,
              and costed interventions with a modelled impact.
            </p>
          </div>
          <div style={{ position: 'relative', minWidth: 240 }}>
            <span style={{ position: 'absolute', left: 10, top: 11, color: 'var(--ink-4)', pointerEvents: 'none' }}>
              <Icon name="search" size={15} />
            </span>
            <input
              className="input"
              style={{ paddingLeft: '2.1rem' }}
              placeholder="Search sectors…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              aria-label="Search sectors"
            />
          </div>
        </div>
      </Section>

      <Section tight>
        {list.length === 0 ? (
          <Empty icon="search" title={`No sector matches “${q}”`} hint="Try “air”, “flood”, “traffic”, “energy” or “connectivity”." />
        ) : (
          <div className="stack" style={{ gap: 'var(--sp-4)' }}>
            {list.map((s, idx) => {
              const worst = worstDistricts(s.id);
              return (
                <Reveal key={s.id} delay={Math.min(idx * 40, 240)} className="card card-hover card-accent" style={{ ['--accent' as string]: `linear-gradient(90deg, ${SECTOR_ACCENT[s.id]}, transparent)` }}>
                  <div className="grid" style={{ gridTemplateColumns: 'minmax(0, 1.4fr) minmax(0, 1fr)', gap: 'var(--sp-5)', alignItems: 'start' }}>
                    <div>
                      <div className="row-between" style={{ alignItems: 'flex-start', marginBottom: '0.7rem' }}>
                        <div className="row" style={{ gap: 10 }}>
                          <span
                            className="badge"
                            style={{
                              borderColor: `${SECTOR_ACCENT[s.id]}55`,
                              color: SECTOR_ACCENT[s.id],
                              background: `${SECTOR_ACCENT[s.id]}14`,
                              width: 30,
                              height: 30,
                              justifyContent: 'center',
                              padding: 0,
                            }}
                          >
                            <Icon name={SECTOR_ICON[s.id]} size={16} />
                          </span>
                          <div className="stack" style={{ gap: 1 }}>
                            <h3 className="h3">{s.name}</h3>
                            <span className="ne tiny muted">{s.ne}</span>
                          </div>
                        </div>
                        <SeverityBadge value={s.severity} />
                      </div>

                      <p className="small" style={{ color: 'var(--ink-2)', fontWeight: 550, marginBottom: '0.5rem' }}>
                        {s.headline}
                      </p>
                      <p className="small muted">{s.problem}</p>

                      <div className="stack" style={{ gap: 6, marginTop: '1rem' }}>
                        <span className="stat-label">Causal mechanism</span>
                        {s.mechanism.map((m, i) => (
                          <div key={i} className="row" style={{ gap: 9, alignItems: 'flex-start' }}>
                            <span
                              className="mono tiny"
                              style={{
                                color: SECTOR_ACCENT[s.id],
                                background: `${SECTOR_ACCENT[s.id]}14`,
                                borderRadius: 999,
                                width: 18,
                                height: 18,
                                display: 'grid',
                                placeItems: 'center',
                                flexShrink: 0,
                                marginTop: 2,
                              }}
                            >
                              {i + 1}
                            </span>
                            <span className="small muted">{m}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="stack" style={{ gap: '1rem' }}>
                      <div className="card card-tight" style={{ background: 'var(--surface)' }}>
                        <span className="stat-label">{s.anchor.label}</span>
                        <div className="row" style={{ gap: 8, margin: '0.3rem 0 0.5rem' }}>
                          <span className="mono" style={{ fontSize: '1.5rem', fontWeight: 700, letterSpacing: '-0.03em' }}>
                            {compact(s.anchor.value)}
                            {s.anchor.unit}
                          </span>
                          <Icon name="arrowRight" size={14} style={{ color: 'var(--ink-4)' }} />
                          <span className="mono muted" style={{ fontSize: '1rem' }}>
                            {compact(s.anchor.target)}
                            {s.anchor.unit}
                          </span>
                        </div>
                        <Bar value={s.anchor.value} max={s.anchor.target * 3} color={`linear-gradient(90deg, ${SECTOR_ACCENT[s.id]}, ${SECTOR_ACCENT[s.id]}55)`} height={6} />
                        <span className="tiny muted" style={{ display: 'block', marginTop: 6 }}>
                          Target: {s.anchor.targetLabel}
                        </span>
                      </div>

                      <div className="stack" style={{ gap: 6 }}>
                        <span className="stat-label">Most exposed districts</span>
                        {worst.map((w) => (
                          <Link
                            key={w.id}
                            to={`/districts/${w.id}`}
                            className="row-between"
                            style={{ padding: '0.28rem 0.35rem', borderRadius: 'var(--r-xs)', fontSize: 'var(--fs-sm)' }}
                          >
                            <span className="muted truncate">{w.name}</span>
                            <span className="mono tiny" style={{ color: grade(w.v).color, fontWeight: 700 }}>{w.v}</span>
                          </Link>
                        ))}
                      </div>

                      <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
                        <span className="badge">{s.solutions.length} solutions</span>
                        {s.signals.slice(0, 2).map((sig) => (
                          <span key={sig} className="badge" style={{ textTransform: 'none', letterSpacing: 0, fontWeight: 500 }}>
                            {sig}
                          </span>
                        ))}
                      </div>

                      <Link className="btn btn-ghost btn-sm btn-block" to={`/sectors/${s.id}`}>
                        Open sector brief <Icon name="arrowRight" size={13} />
                      </Link>
                    </div>
                  </div>
                </Reveal>
              );
            })}
          </div>
        )}

        <div style={{ marginTop: 'var(--sp-5)' }}>
          <SourceNote text={sectorsFileNote()} />
        </div>
      </Section>
    </>
  );
}

function worstDistricts(sector: SectorId, n = 5) {
  return districts
    .map((d) => ({ id: d.id, name: d.name, v: severityOf(d, sector) }))
    .sort((a, b) => b.v - a.v)
    .slice(0, n);
}

function sectorsFileNote(): string {
  return sectorsFile.$meta?.note ?? `Sector definitions and anchor figures span ${SECTOR_IDS.length} sectors. Severity is an index, not a measurement.`;
}