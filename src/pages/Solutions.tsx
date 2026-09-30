import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { SECTOR_ACCENT } from '@/components/NepalMap';
import { Icon, SECTOR_ICON } from '@/components/Icon';
import { Bar, Empty, Reveal, Section, SourceNote } from '@/components/ui';
import { sectors } from '@/lib/nepal';
import type { Solution, SectorId } from '@/types';
import { cx } from '@/lib/utils';

const COST_TONE: Record<Solution['cost'], string> = {
  Low: 'var(--jade)',
  Medium: 'var(--gold)',
  High: 'var(--coral)',
  'Very high': 'var(--crimson)',
};

const COST_RANK: Record<Solution['cost'], number> = { Low: 0, Medium: 1, High: 2, 'Very high': 3 };
const EFFORT_RANK: Record<Solution['effort'], number> = { Low: 0, Medium: 1, High: 2 };

type SortKey = 'impact' | 'cost' | 'effort' | 'horizon';

export default function Solutions() {
  const [sector, setSector] = useState<SectorId | 'all'>('all');
  const [cost, setCost] = useState<Solution['cost'] | 'all'>('all');
  const [sort, setSort] = useState<SortKey>('impact');
  const [q, setQ] = useState('');

  const all = useMemo(() => sectors.flatMap((s) => s.solutions.map((sol) => ({ sol, sectorId: s.id }))), []);

  const rows = useMemo(() => {
    const term = q.trim().toLowerCase();
    return all
      .filter((r) => (sector === 'all' ? true : r.sectorId === sector))
      .filter((r) => (cost === 'all' ? true : r.sol.cost === cost))
      .filter((r) => (term ? `${r.sol.title} ${r.sol.how} ${r.sol.lever}`.toLowerCase().includes(term) : true))
      .sort((a, b) => {
        switch (sort) {
          case 'cost':
            return COST_RANK[a.sol.cost] - COST_RANK[b.sol.cost] || b.sol.impact - a.sol.impact;
          case 'effort':
            return EFFORT_RANK[a.sol.effort] - EFFORT_RANK[b.sol.effort];
          case 'horizon':
            return a.sol.horizon.localeCompare(b.sol.horizon);
          default:
            return b.sol.impact - a.sol.impact;
        }
      });
  }, [all, sector, cost, sort, q]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { Low: 0, Medium: 0, High: 0, 'Very high': 0 };
    for (const { sol } of all) c[sol.cost]++;
    return c;
  }, [all]);

  return (
    <>
      <Section tight>
        <div className="stack" style={{ gap: '0.5rem', maxWidth: '62ch' }}>
          <span className="eyebrow">Solution library</span>
          <h1 className="h1" style={{ fontSize: 'clamp(2.2rem, 5vw, 3.4rem)' }}>
            {all.length} interventions, <span className="grad-crimson">costed and sequenced</span>
          </h1>
          <p className="lede">
            Every solution carries a modelled impact on its sector, a cost band, an effort band and a delivery
            horizon. Filter by what you can actually afford and start.
          </p>
        </div>
      </Section>

      <Section tight>
        <div className="card" style={{ marginBottom: 'var(--sp-5)' }}>
          <div className="row" style={{ gap: '0.6rem', flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', flex: 2, minWidth: 210 }}>
              <span style={{ position: 'absolute', left: 10, top: 11, color: 'var(--ink-4)', pointerEvents: 'none' }}>
                <Icon name="search" size={15} />
              </span>
              <input
                className="input"
                style={{ paddingLeft: '2.1rem' }}
                placeholder="Search solutions…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                aria-label="Search solutions"
              />
            </div>

            <select className="select" style={{ flex: 1, minWidth: 150 }} value={cost} onChange={(e) => setCost(e.target.value as typeof cost)} aria-label="Filter by cost">
              <option value="all">Any cost ({all.length})</option>
              {(['Low', 'Medium', 'High', 'Very high'] as const).map((c) => (
                <option key={c} value={c}>{c} ({counts[c]})</option>
              ))}
            </select>

            <select className="select" style={{ flex: 1, minWidth: 140 }} value={sort} onChange={(e) => setSort(e.target.value as SortKey)} aria-label="Sort solutions">
              <option value="impact">Sort: impact</option>
              <option value="cost">Sort: cheapest first</option>
              <option value="effort">Sort: least effort</option>
              <option value="horizon">Sort: fastest</option>
            </select>
          </div>

          <div className="row" style={{ gap: 5, marginTop: '0.9rem', flexWrap: 'wrap' }}>
            <button className={`chip${sector === 'all' ? ' on' : ''}`} onClick={() => setSector('all')}>
              <Icon name="layers" size={12} /> All sectors
            </button>
            {sectors.map((s) => (
              <button
                key={s.id}
                className={`chip${sector === s.id ? ' on' : ''}`}
                onClick={() => setSector(s.id)}
                style={sector === s.id ? undefined : { borderColor: `${SECTOR_ACCENT[s.id]}44` }}
              >
                <Icon name={SECTOR_ICON[s.id]} size={12} style={{ color: sector === s.id ? undefined : SECTOR_ACCENT[s.id] }} />
                {s.name}
              </button>
            ))}
          </div>
        </div>

        {rows.length === 0 ? (
          <Empty icon="search" title="No solutions match those filters" hint="Widen the cost band or clear the search." />
        ) : (
          <div className="grid stagger" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(316px, 1fr))' }}>
            {rows.map(({ sol, sectorId }, i) => {
              const sec = sectors.find((s) => s.id === sectorId)!;
              const accent = SECTOR_ACCENT[sectorId];
              return (
                <div key={`${sectorId}-${sol.title}`} className="card card-hover" style={{ borderTop: `2px solid ${accent}` }}>
                  <div className="row-between" style={{ alignItems: 'flex-start', marginBottom: '0.6rem' }}>
                    <span
                      className="badge"
                      style={{ borderColor: `${accent}55`, color: accent, background: `${accent}14` }}
                    >
                      <Icon name={SECTOR_ICON[sectorId]} size={11} /> {sec.name}
                    </span>
                    <span className="mono" style={{ fontSize: '1.15rem', fontWeight: 700, color: accent }}>
                      +{sol.impact}
                    </span>
                  </div>

                  <h3 className="h4">{sol.title}</h3>
                  <p className="small muted" style={{ margin: '0.45rem 0 0.8rem' }}>{sol.how}</p>

                  <div style={{ marginBottom: '0.9rem' }}>
                    <Bar value={sol.impact} max={100} color={`linear-gradient(90deg, ${accent}, ${accent}44)`} height={5} />
                  </div>

                  <div className="row-between" style={{ marginBottom: '0.8rem' }}>
                    <span className="badge" style={{ color: COST_TONE[sol.cost], borderColor: `${COST_TONE[sol.cost]}44` }}>
                      {sol.cost} cost
                    </span>
                    <span className={cx('badge')}>{sol.effort} effort</span>
                    <span className="badge">
                      <Icon name="clock" size={11} /> {sol.horizon}
                    </span>
                  </div>

                  <div className="row-between" style={{ paddingTop: '0.7rem', borderTop: '1px solid var(--line)' }}>
                    <span className="tiny muted truncate">{sol.lever}</span>
                    <Link className="btn btn-ghost btn-sm" to={`/sectors/${sectorId}`}>
                      Sector <Icon name="arrowRight" size={12} />
                    </Link>
                  </div>

                  <span className="sr-only">Rank {i + 1} of {rows.length}</span>
                </div>
              );
            })}
          </div>
        )}

        <div style={{ marginTop: 'var(--sp-5)' }}>
          <SourceNote text="Impacts are modelled index-point reductions under stated assumptions, not measured outcomes. Cost and effort bands are relative and intended for prioritisation." />
        </div>
      </Section>

      <Section tight>
        <Reveal dir="scale" className="card card-solid card-accent" style={{ ['--accent' as string]: 'var(--grad-glacier)', textAlign: 'center' }}>
          <span className="eyebrow" style={{ marginBottom: '0.7rem' }}>Not sure where to start?</span>
          <h2 className="h2 grad-ink" style={{ marginBottom: '0.6rem' }}>Let Sakhi choose for you</h2>
          <p className="lede" style={{ margin: '0 auto 1.4rem' }}>
            Describe the district, the budget and the deadline. Sakhi will rank the interventions for that
            specific constraint rather than giving generic advice.
          </p>
          <Link className="btn btn-ai" to="/ask">
            <Icon name="sparkle" size={16} /> Ask Sakhi
          </Link>
        </Reveal>
      </Section>
    </>
  );
}