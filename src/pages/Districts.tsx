import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { SECTOR_ACCENT } from '@/components/NepalMap';
import { Icon } from '@/components/Icon';
import { Bar, Empty, Reveal, Section, SourceNote } from '@/components/ui';
import { BELT_LABEL, districts, profileOf, provinces, SECTOR_IDS, TAG_LABEL } from '@/lib/nepal';
import { grade, num } from '@/lib/utils';

export default function Districts() {
  const [q, setQ] = useState('');
  const [province, setProvince] = useState('all');
  const [belt, setBelt] = useState('all');

  const cards = useMemo(() => {
    const term = q.trim().toLowerCase();
    return districts
      .filter((d) => (province === 'all' ? true : d.prov === province))
      .filter((d) => (belt === 'all' ? true : d.belt === belt))
      .filter((d) =>
        term ? `${d.name} ${d.ne} ${d.hq} ${d.hqNe} ${d.tags.join(' ')}`.toLowerCase().includes(term) : true,
      )
      .map((d) => profileOf(d.id)!)
      .sort((a, b) => b.composite - a.composite);
  }, [q, province, belt]);

  return (
    <>
      <Section tight>
        <div className="stack" style={{ gap: '0.5rem', maxWidth: '64ch' }}>
          <span className="eyebrow">All districts</span>
          <h1 className="h1" style={{ fontSize: 'clamp(2.2rem, 5vw, 3.4rem)' }}>
            <span className="grad-ink">77 districts</span>, ranked by pressure
          </h1>
          <p className="lede">
            Nepal's 77 districts across 7 provinces and 3 ecological belts. Each card shows the composite
            Nexa index, the dominant sector, and the characteristics driving it.
          </p>
        </div>
      </Section>

      <Section tight>
        <div className="card" style={{ marginBottom: 'var(--sp-5)' }}>
          <div className="row" style={{ gap: '0.6rem', flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', flex: 2, minWidth: 220 }}>
              <span style={{ position: 'absolute', left: 10, top: 11, color: 'var(--ink-4)', pointerEvents: 'none' }}>
                <Icon name="search" size={15} />
              </span>
              <input
                className="input"
                style={{ paddingLeft: '2.1rem' }}
                placeholder="Search by district, HQ, or characteristic…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                aria-label="Search districts"
              />
            </div>
            <select
              className="select"
              style={{ flex: 1, minWidth: 150 }}
              value={province}
              onChange={(e) => setProvince(e.target.value)}
              aria-label="Filter by province"
            >
              <option value="all">All 7 provinces</option>
              {provinces.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            <select
              className="select"
              style={{ flex: 1, minWidth: 140 }}
              value={belt}
              onChange={(e) => setBelt(e.target.value)}
              aria-label="Filter by ecological belt"
            >
              <option value="all">All 3 belts</option>
              <option value="terai">Terai</option>
              <option value="hill">Hill</option>
              <option value="mountain">Mountain</option>
            </select>
          </div>

          <div className="row" style={{ gap: '0.5rem', marginTop: '0.9rem', flexWrap: 'wrap' }}>
            <span className="tiny muted">Jump to:</span>
            {provinces.map((p) => (
              <button key={p.id} className={`chip${province === p.id ? ' on' : ''}`} onClick={() => setProvince(province === p.id ? 'all' : p.id)}>
                {p.name} <span className="tiny" style={{ opacity: 0.7 }}>{p.districts}</span>
              </button>
            ))}
          </div>
        </div>

        {cards.length === 0 ? (
          <Empty icon="search" title={`No district matches “${q}”`} hint="Try a district name, its headquarters, or a characteristic such as “floodplain”, “hydro” or “trek”." />
        ) : (
          <div className="grid stagger" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(276px, 1fr))' }}>
            {cards.map((p) => (
              <Link
                key={p.district.id}
                to={`/districts/${p.district.id}`}
                className="card card-hover"
                style={{ textDecoration: 'none' }}
              >
                <div className="row-between" style={{ alignItems: 'flex-start', marginBottom: '0.6rem' }}>
                  <div className="stack" style={{ gap: 2, minWidth: 0 }}>
                    <h3 className="h4 truncate">{p.district.name}</h3>
                    <span className="tiny muted">
                      {p.province.name} · {BELT_LABEL[p.district.belt]}
                    </span>
                  </div>
                  <span
                    className={`badge badge-${grade(p.composite).tone}`}
                    style={{ flexShrink: 0 }}
                    title="Composite Nexa index"
                  >
                    {p.composite}
                  </span>
                </div>

                <dl className="kv" style={{ fontSize: 'var(--fs-xs)', marginBottom: '0.7rem' }}>
                  <dt>HQ</dt>
                  <dd>{p.district.hq}</dd>
                  <dt>Population</dt>
                  <dd>{num(p.district.pop)}</dd>
                  <dt>Area</dt>
                  <dd>{num(p.district.area)} km²</dd>
                  <dt>Elevation</dt>
                  <dd>{num(p.district.alt)} m</dd>
                </dl>

                <div className="stack" style={{ gap: 5 }}>
                  <div className="row-between tiny">
                    <span className="muted">Top sector · {p.topSector.name}</span>
                    <span className="mono" style={{ color: grade(p.severity[p.topSector.id]).color, fontWeight: 700 }}>
                      {p.severity[p.topSector.id]}
                    </span>
                  </div>
                  <Bar
                    value={p.composite}
                    color={`linear-gradient(90deg, ${SECTOR_ACCENT[p.topSector.id]}, ${SECTOR_ACCENT[p.topSector.id]}44)`}
                    height={5}
                  />
                </div>

                <div className="row" style={{ gap: 5, marginTop: '0.8rem', flexWrap: 'wrap' }}>
                  {p.district.tags.slice(0, 3).map((t) => (
                    <span key={t} className="badge" style={{ textTransform: 'none', letterSpacing: 0, fontWeight: 500 }}>
                      {TAG_LABEL[t] ?? t}
                    </span>
                  ))}
                </div>
              </Link>
            ))}
          </div>
        )}

        <div style={{ marginTop: 'var(--sp-5)' }}>
          <SourceNote text="Administrative boundaries, area and population from NSO National Population and Housing Census 2021. Indices are Nexa constructions from belt, urbanisation and hazard-tag inputs." />
        </div>
      </Section>

      {/* Province summary */}
      <Section eyebrow="By province" title="Seven provinces at a glance">
        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(228px, 1fr))' }}>
          {provinces.map((p) => {
            const ds = districts.filter((d) => d.prov === p.id);
            const avg = Math.round(
              ds.reduce((a, d) => a + SECTOR_IDS.reduce((x, s) => x + profileOf(d.id)!.severity[s], 0) / SECTOR_IDS.length, 0) /
                (ds.length || 1),
            );
            return (
              <Reveal key={p.id} className="card card-hover">
                <div className="row-between" style={{ marginBottom: '0.6rem' }}>
                  <div className="stack" style={{ gap: 2 }}>
                    <h3 className="h4">{p.name}</h3>
                    <span className="ne tiny muted">{p.ne} · capital {p.capital}</span>
                  </div>
                  <span className={`badge badge-${grade(avg).tone}`}>{avg}</span>
                </div>
                <dl className="kv" style={{ fontSize: 'var(--fs-xs)' }}>
                  <dt>Districts</dt>
                  <dd>{p.districts}</dd>
                  <dt>Area</dt>
                  <dd>{num(p.area)} km²</dd>
                  <dt>Population</dt>
                  <dd>{num(p.pop)}</dd>
                </dl>
                <div style={{ marginTop: '0.7rem' }}>
                  <Bar value={avg} height={5} />
                </div>
              </Reveal>
            );
          })}
        </div>
      </Section>
    </>
  );
}