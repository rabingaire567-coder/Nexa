import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { NepalMap, SECTOR_ACCENT } from '@/components/NepalMap';
import { Icon, SECTOR_ICON } from '@/components/Icon';
import { Bar, Reveal, Section, SeverityBadge, SourceNote } from '@/components/ui';
import { districts, profileOf, provinces, sectors, SECTOR_IDS } from '@/lib/nepal';
import type { SectorId } from '@/types';
import { grade, num } from '@/lib/utils';
import { useMedia } from '@/hooks/useReveal';

type SortKey = 'composite' | 'name' | 'pop' | 'area' | SectorId;

export default function Atlas() {
  const [sector, setSector] = useState<SectorId | 'composite'>('composite');
  const [province, setProvince] = useState('all');
  const [belt, setBelt] = useState('all');
  const [sort, setSort] = useState<SortKey>('composite');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const narrow = useMedia('(max-width: 940px)');

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return districts
      .filter((d) => (province === 'all' ? true : d.prov === province))
      .filter((d) => (belt === 'all' ? true : d.belt === belt))
      .filter((d) => (q ? `${d.name} ${d.ne} ${d.hq} ${d.hqNe} ${d.tags.join(' ')}`.toLowerCase().includes(q) : true))
      .map((d) => profileOf(d.id))
      .filter((p): p is NonNullable<typeof p> => Boolean(p))
      .sort((x, y) => {
        switch (sort) {
          case 'name':
            return x.district.name.localeCompare(y.district.name);
          case 'pop':
            return y.district.pop - x.district.pop;
          case 'area':
            return y.district.area - x.district.area;
          case 'composite':
            return y.composite - x.composite;
          default:
            return y.severity[sort] - x.severity[sort];
        }
      });
  }, [province, belt, query, sort]);

  const activeSector = sector === 'composite' ? null : sector;
  const columnLabel = activeSector ? (sectors.find((s) => s.id === activeSector)?.name ?? 'Index') : 'Index';

  return (
    <>
      <Section tight>
        <div className="row-between" style={{ alignItems: 'flex-end' }}>
          <div className="stack" style={{ gap: '0.5rem', maxWidth: '62ch' }}>
            <span className="eyebrow">Problem Atlas</span>
            <h1 className="h1" style={{ fontSize: 'clamp(2.2rem, 5vw, 3.4rem)' }}>
              Every district, <span className="grad-crimson">every pressure</span>
            </h1>
            <p className="lede">
              Choose a sector to recolour the map. The index is computed from ecological belt, urbanisation and
              declared hazard tags — no black box, no opaque survey weight.
            </p>
          </div>
          <Link className="btn btn-ghost btn-sm" to="/about">
            <Icon name="book" size={14} /> Methodology
          </Link>
        </div>
      </Section>

      {/* Sticky sector switcher */}
      <div
        style={{
          position: 'sticky',
          top: 'var(--nav-h)',
          zIndex: 90,
          background: 'var(--glass)',
          backdropFilter: 'blur(14px)',
          WebkitBackdropFilter: 'blur(14px)',
          borderBottom: '1px solid var(--line)',
        }}
      >
        <div className="wrap" style={{ paddingBlock: '0.6rem' }}>
          <div className="scroll-x row" style={{ gap: '0.4rem' }}>
            <button className={`chip${sector === 'composite' ? ' on' : ''}`} onClick={() => setSector('composite')}>
              <Icon name="layers" size={13} /> Composite
            </button>
            {sectors.map((s) => (
              <button
                key={s.id}
                className={`chip${sector === s.id ? ' on' : ''}`}
                onClick={() => setSector(s.id)}
                style={sector === s.id ? undefined : { borderColor: `${SECTOR_ACCENT[s.id]}44` }}
              >
                <Icon
                  name={SECTOR_ICON[s.id]}
                  size={13}
                  style={{ color: sector === s.id ? undefined : SECTOR_ACCENT[s.id] }}
                />
                {s.name}
              </button>
            ))}
          </div>
        </div>
      </div>

      <Section tight>
        <div
          className="grid"
          style={{
            gridTemplateColumns: narrow ? '1fr' : 'minmax(0, 1.25fr) minmax(0, 0.75fr)',
            gap: 'var(--sp-5)',
            alignItems: 'start',
          }}
        >
          <div className="stack" style={{ gap: 'var(--sp-4)' }}>
            <Reveal className="card" style={{ padding: '1.2rem' }}>
              <div className="row-between" style={{ marginBottom: '0.9rem' }}>
                <span className="eyebrow" style={{ margin: 0 }}>
                  {activeSector ? `${sectors.find((s) => s.id === activeSector)?.name} severity` : 'Composite severity'}
                </span>
                {selected && (
                  <button className="btn btn-ghost btn-sm" onClick={() => setSelected(null)}>
                    <Icon name="close" size={13} /> Clear
                  </button>
                )}
              </div>
              <NepalMap sector={sector} onSelect={(id) => setSelected(id)} />
            </Reveal>

            {selected && <SelectedPanel id={selected} />}
          </div>

          {/* Ranked table */}
          <Reveal dir="right" delay={120} className="card card-flush">
            <div className="stack" style={{ gap: '0.7rem', padding: '1.1rem', borderBottom: '1px solid var(--line)' }}>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: 10, top: 11, color: 'var(--ink-4)', pointerEvents: 'none' }}>
                  <Icon name="search" size={15} />
                </span>
                <input
                  className="input"
                  style={{ paddingLeft: '2.1rem' }}
                  placeholder="Search 77 districts…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  aria-label="Search districts"
                />
              </div>

              <div className="row" style={{ gap: '0.4rem', flexWrap: 'wrap' }}>
                <select
                  className="select"
                  style={{ flex: 1, minWidth: 130 }}
                  value={province}
                  onChange={(e) => setProvince(e.target.value)}
                  aria-label="Filter by province"
                >
                  <option value="all">All provinces</option>
                  {provinces.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
                <select
                  className="select"
                  style={{ flex: 1, minWidth: 118 }}
                  value={belt}
                  onChange={(e) => setBelt(e.target.value)}
                  aria-label="Filter by ecological belt"
                >
                  <option value="all">All belts</option>
                  <option value="terai">Terai</option>
                  <option value="hill">Hill</option>
                  <option value="mountain">Mountain</option>
                </select>
              </div>

              <select
                className="select"
                value={sort}
                onChange={(e) => setSort(e.target.value as SortKey)}
                aria-label="Sort districts"
              >
                <option value="composite">Sort: composite index</option>
                <option value="name">Sort: name A–Z</option>
                <option value="pop">Sort: population</option>
                <option value="area">Sort: area</option>
                {sectors.map((s) => (
                  <option key={s.id} value={s.id}>Sort: {s.name}</option>
                ))}
              </select>
            </div>

            <div style={{ maxHeight: 'min(62vh, 600px)', overflowY: 'auto' }}>
              <table className="tbl">
                <thead style={{ position: 'sticky', top: 0, background: 'var(--bg-2)', zIndex: 1 }}>
                  <tr>
                    <th>District</th>
                    <th>Province</th>
                    <th className="num">{columnLabel}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((p) => {
                    const v = activeSector ? p.severity[activeSector] : p.composite;
                    return (
                      <tr
                        key={p.district.id}
                        onClick={() => setSelected(p.district.id)}
                        style={{
                          cursor: 'pointer',
                          background: selected === p.district.id ? 'var(--surface-2)' : undefined,
                        }}
                      >
                        <td>
                          <Link
                            to={`/districts/${p.district.id}`}
                            onClick={(e) => e.stopPropagation()}
                            style={{ fontWeight: 550, color: 'var(--ink)' }}
                          >
                            {p.district.name}
                          </Link>
                          <div className="tiny muted">{p.district.hq} · {p.district.belt}</div>
                        </td>
                        <td className="tiny">{p.province.name}</td>
                        <td className="num">
                          <span className="mono" style={{ color: grade(v).color, fontWeight: 700 }}>{v}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {rows.length === 0 && (
                <div className="empty" style={{ margin: '1rem', border: 0 }}>
                  No district matches “{query}”.
                </div>
              )}
            </div>

            <div style={{ padding: '0.7rem 1.1rem', borderTop: '1px solid var(--line)' }}>
              <SourceNote text={`${rows.length} of 77 districts shown · NSO National Population and Housing Census 2021`} />
            </div>
          </Reveal>
        </div>
      </Section>
    </>
  );
}

function SelectedPanel({ id }: { id: string }) {
  const p = profileOf(id);
  if (!p) return null;
  const ranked = SECTOR_IDS.map((s) => ({ id: s, v: p.severity[s] })).sort((a, b) => b.v - a.v);

  return (
    <Reveal dir="up" className="card card-solid card-accent" style={{ ['--accent' as string]: 'var(--grad-crimson)' }}>
      <div className="row-between" style={{ alignItems: 'flex-start' }}>
        <div className="stack" style={{ gap: 3 }}>
          <span className="eyebrow" style={{ margin: 0 }}>{p.province.name} province</span>
          <h2 className="h2" style={{ fontSize: '1.7rem' }}>
            {p.district.name} <span className="ne muted" style={{ fontSize: '0.6em' }}>{p.district.ne}</span>
          </h2>
          <p className="small muted">
            HQ {p.district.hq} · {num(p.district.area)} km² · pop {num(p.district.pop)} · {p.district.belt} belt ·{' '}
            {num(p.district.alt)} m
          </p>
        </div>
        <SeverityBadge value={p.composite} />
      </div>

      <div
        className="grid"
        style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(186px, 1fr))', gap: '0.8rem', marginTop: '1.2rem' }}
      >
        {ranked.map(({ id: sid, v }) => {
          const s = sectors.find((x) => x.id === sid);
          if (!s) return null;
          return (
            <div key={sid} className="stack" style={{ gap: 5 }}>
              <div className="row-between tiny">
                <span className="row" style={{ gap: 6 }}>
                  <Icon name={SECTOR_ICON[sid]} size={13} style={{ color: SECTOR_ACCENT[sid] }} />
                  <span className="muted">{s.name}</span>
                </span>
                <span className="mono" style={{ color: grade(v).color, fontWeight: 700 }}>{v}</span>
              </div>
              <Bar value={v} color={`linear-gradient(90deg, ${SECTOR_ACCENT[sid]}, ${SECTOR_ACCENT[sid]}44)`} height={5} />
            </div>
          );
        })}
      </div>

      {p.topCity && (
        <p className="small muted" style={{ marginTop: '1.1rem' }}>
          Largest tracked city: <strong style={{ color: 'var(--ink)' }}>{p.topCity.name}</strong> — {p.topCity.blurb}
        </p>
      )}

      <div className="row" style={{ marginTop: '1.2rem', flexWrap: 'wrap' }}>
        <Link className="btn btn-primary btn-sm" to={`/districts/${p.district.id}`}>
          Full profile <Icon name="arrowRight" size={13} />
        </Link>
        <Link className="btn btn-ai btn-sm" to="/ask">
          <Icon name="sparkle" size={13} /> Ask about {p.district.name}
        </Link>
      </div>
    </Reveal>
  );
}