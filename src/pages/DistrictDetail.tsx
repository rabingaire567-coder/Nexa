import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { NepalMap, SECTOR_ACCENT } from '@/components/NepalMap';
import { Icon, SECTOR_ICON } from '@/components/Icon';
import { Bar, Empty, Reveal, Section, SeverityBadge, SourceNote } from '@/components/ui';
import { BELT_LABEL, nationalFile, profileOf, sectors, SECTOR_IDS, TAG_LABEL } from '@/lib/nepal';
import type { City, SectorId } from '@/types';
import { compact, grade, num } from '@/lib/utils';

export default function DistrictDetail() {
  const { id = '' } = useParams();
  const p = useMemo(() => profileOf(id), [id]);
  const [sector, setSector] = useState<SectorId | 'composite'>('composite');

  if (!p) {
    return (
      <Section>
        <Empty
          icon="search"
          title="District not found"
          hint={`No district is registered under “${id}”.`}
        />
        <div style={{ textAlign: 'center', marginTop: '1.2rem' }}>
          <Link className="btn btn-primary" to="/districts">
            Browse all 77 districts
          </Link>
        </div>
      </Section>
    );
  }

  const d = p.district;
  const ranked = SECTOR_IDS.map((s) => ({ id: s, v: p.severity[s] })).sort((a, b) => b.v - a.v);

  return (
    <>
      {/* Header */}
      <Section tight>
        <div className="row-between" style={{ marginBottom: '1.2rem' }}>
          <Link className="btn btn-ghost btn-sm" to="/districts">
            <Icon name="arrowRight" size={13} style={{ transform: 'rotate(180deg)' }} /> All districts
          </Link>
          <div className="row" style={{ gap: '0.4rem' }}>
            <Link className="btn btn-ghost btn-sm" to="/ask">
              <Icon name="sparkle" size={13} /> Ask Sakhi
            </Link>
            <button className="btn btn-primary btn-sm" onClick={() => window.print()}>
              <Icon name="download" size={13} /> Print brief
            </button>
          </div>
        </div>

        <div className="grid" style={{ gridTemplateColumns: 'minmax(0, 1fr) auto', gap: 'var(--sp-5)', alignItems: 'start' }}>
          <div className="stack" style={{ gap: '0.6rem' }}>
            <span className="eyebrow">{p.province.name} province · {BELT_LABEL[d.belt]} belt</span>
            <h1 className="h1" style={{ fontSize: 'clamp(2.3rem, 5.4vw, 3.8rem)' }}>
              {d.name} <span className="ne grad-crimson" style={{ fontSize: '0.52em' }}>{d.ne}</span>
            </h1>
            <p className="lede">
              Headquarters <strong style={{ color: 'var(--ink)' }}>{d.hq}</strong> (
              <span className="ne">{d.hqNe}</span>) · {num(d.area)} km² · population {num(d.pop)} ·{' '}
              {num(d.alt)} m elevation.
            </p>
            <div className="row" style={{ gap: 5, flexWrap: 'wrap', marginTop: '0.3rem' }}>
              {d.tags.map((t) => (
                <span key={t} className="badge" style={{ textTransform: 'none', letterSpacing: 0, fontWeight: 500 }}>
                  {TAG_LABEL[t] ?? t}
                </span>
              ))}
            </div>
          </div>
          <div className="card card-solid" style={{ textAlign: 'center', minWidth: 168 }}>
            <span className="stat-label">Composite index</span>
            <span className="stat-value" style={{ color: grade(p.composite).color }}>{p.composite}</span>
            <SeverityBadge value={p.composite} />
            <hr className="hr" style={{ margin: '0.7rem 0' }} />
            <span className="tiny muted">Top sector</span>
            <strong style={{ display: 'block', fontSize: 'var(--fs-sm)' }}>{p.topSector.name}</strong>
          </div>
        </div>
      </Section>

      {/* Map + sector breakdown */}
      <Section tight>
        <div className="grid" style={{ gridTemplateColumns: 'minmax(0, 1.05fr) minmax(0, 0.95fr)', gap: 'var(--sp-5)', alignItems: 'start' }}>
          <Reveal dir="left" className="card" style={{ padding: '1.2rem' }}>
            <div className="row" style={{ gap: 5, marginBottom: '0.9rem', flexWrap: 'wrap' }}>
              <button className={`chip${sector === 'composite' ? ' on' : ''}`} onClick={() => setSector('composite')}>
                <Icon name="pin" size={12} /> {d.name}
              </button>
              {ranked.slice(0, 4).map(({ id: sid }) => (
                <button
                  key={sid}
                  className={`chip${sector === sid ? ' on' : ''}`}
                  onClick={() => setSector(sid)}
                  style={sector === sid ? undefined : { borderColor: `${SECTOR_ACCENT[sid]}44` }}
                >
                  {sectors.find((s) => s.id === sid)?.name}
                </button>
              ))}
            </div>
            <NepalMap sector={sector} />
          </Reveal>

          <Reveal dir="right" delay={120} className="card">
            <span className="eyebrow" style={{ marginBottom: '0.9rem' }}>Sector breakdown</span>
            <div className="stack" style={{ gap: '0.75rem' }}>
              {ranked.map(({ id: sid, v }) => {
                const s = sectors.find((x) => x.id === sid);
                if (!s) return null;
                return (
                  <div key={sid} className="stack" style={{ gap: 5 }}>
                    <div className="row-between tiny">
                      <span className="row" style={{ gap: 6 }}>
                        <Icon name={SECTOR_ICON[sid]} size={13} style={{ color: SECTOR_ACCENT[sid] }} />
                        <Link to={`/sectors/${sid}`} style={{ color: 'var(--ink)', fontWeight: 550 }}>
                          {s.name}
                        </Link>
                      </span>
                      <span className="mono" style={{ color: grade(v).color, fontWeight: 700 }}>{v}</span>
                    </div>
                    <Bar value={v} color={`linear-gradient(90deg, ${SECTOR_ACCENT[sid]}, ${SECTOR_ACCENT[sid]}44)`} height={5} />
                  </div>
                );
              })}
            </div>
            <p className="tiny muted" style={{ marginTop: '1rem' }}>
              Computed from {BELT_LABEL[d.belt].toLowerCase()} belt base severity, urbanisation index {d.urb}/100, and{' '}
              {d.tags.length} declared hazard tags.
            </p>
          </Reveal>
        </div>
      </Section>

      {/* Mechanisms for top sectors */}
      <Section eyebrow="What is happening" title={`Why ${d.name} is exposed`} lede="Every sector has a documented causal chain. Knowing the mechanism tells you which intervention actually moves the number.">
        <div className="grid stagger" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))' }}>
          {ranked.slice(0, 3).map(({ id: sid, v }) => {
            const s = sectors.find((x) => x.id === sid);
            if (!s) return null;
            return (
              <div key={sid} className="card" style={{ borderTop: `2px solid ${SECTOR_ACCENT[sid]}` }}>
                <div className="row-between" style={{ marginBottom: '0.7rem' }}>
                  <span className="row" style={{ gap: 8 }}>
                    <Icon name={SECTOR_ICON[sid]} size={17} style={{ color: SECTOR_ACCENT[sid] }} />
                    <strong>{s.name}</strong>
                    <span className="ne tiny muted">{s.ne}</span>
                  </span>
                  <span className="mono" style={{ color: grade(v).color, fontWeight: 700 }}>{v}</span>
                </div>
                <p className="small muted" style={{ marginBottom: '0.8rem' }}>{s.problem}</p>
                <ol className="stack" style={{ gap: 6, listStyle: 'none' }}>
                  {s.mechanism.slice(0, 3).map((m, i) => (
                    <li key={i} className="row" style={{ gap: 8, alignItems: 'flex-start', fontSize: 'var(--fs-sm)' }}>
                      <span className="mono tiny muted" style={{ minWidth: 16 }}>{i + 1}</span>
                      <span className="muted">{m}</span>
                    </li>
                  ))}
                </ol>
                <Link className="btn btn-ghost btn-sm" to={`/sectors/${sid}`} style={{ marginTop: '0.9rem' }}>
                  Solutions <Icon name="arrowRight" size={13} />
                </Link>
              </div>
            );
          })}
        </div>
      </Section>

      {/* City */}
      {p.topCity && <CityBlock city={p.topCity} />}

      {/* Emergency numbers */}
      <Section eyebrow="If it is urgent" title="Emergency numbers" tight lede={nationalFile.emergencies.label}>
        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))' }}>
          {nationalFile.emergencies.items.map((e) => (
            <a
              key={e.number}
              className="card card-tight card-hover"
              href={`tel:${e.number.replace(/[^\d+]/g, '')}`}
              style={{ textDecoration: 'none' }}
            >
              <div className="row-between">
                <div className="stack" style={{ gap: 2, minWidth: 0 }}>
                  <strong style={{ fontSize: 'var(--fs-sm)' }}>{e.name}</strong>
                  <span className="tiny muted clamp-2">{e.note}</span>
                </div>
                <span className="mono" style={{ color: 'var(--crimson)', fontWeight: 700, flexShrink: 0 }}>
                  {e.number}
                </span>
              </div>
            </a>
          ))}
        </div>
      </Section>

      <Section tight>
        <div className="row-between">
          <SourceNote text={`${d.name} district: NSO census 2021 · indices are Nexa constructions, published as indices not measurements.`} />
          <Link className="btn btn-primary btn-sm" to={`/ask?d=${d.id}`}>
            <Icon name="sparkle" size={13} /> Deep-dive with Sakhi
          </Link>
        </div>
      </Section>
    </>
  );
}

function CityBlock({ city }: { city: City }) {
  const rows: { label: string; value: string }[] = [
    { label: 'PM2.5 (annual mean)', value: `${city.air.pm25} µg/m³` },
    { label: 'Air quality index', value: `${city.air.aqi} — ${city.air.worst}` },
    { label: 'Peak congestion', value: `${city.traffic.congestion}% at ${city.traffic.peakHours}` },
    { label: 'Average speed', value: `${city.traffic.avgSpeedKmph} km/h` },
    { label: 'Ring road', value: typeof city.ringRoad === 'string' ? city.ringRoad : city.ringRoad ? 'Operational' : 'Not built' },
    { label: 'Waste generated', value: `${city.waste.tpd} t/day` },
    { label: 'Recycled', value: `${city.waste.recycled}%` },
    { label: 'Landfill', value: city.waste.landfill },
    { label: 'Drain network age', value: city.water.drainAge },
    { label: 'Flood-prone zones', value: city.water.floodProne.join(', ') },
    { label: 'Peak electrical load', value: `${compact(city.energy.peakLoadMW)} MW` },
    { label: 'Daily outage', value: `${city.energy.outageHours} h` },
    { label: 'Import share', value: `${city.energy.importShare}%` },
    { label: 'Hydro season', value: city.energy.hydroSeason },
    { label: 'Tertiary hospitals', value: String(city.health.tertiaryHospitals) },
    { label: 'PHC within 30 min', value: `${city.health.phcReach30min}%` },
    { label: 'Doctors per 100k', value: String(city.health.doctorsPer100k) },
    { label: 'Internet penetration', value: `${city.connect.internet}%` },
    { label: 'Mobile penetration', value: `${city.connect.mobile}%` },
    { label: 'Digital literacy', value: `${city.connect.digitalLiteracy}%` },
    { label: 'Universities', value: String(city.universities) },
  ];

  return (
    <Section eyebrow="City detail" title={`${city.name} — full indicator set`} lede={city.blurb}>
      <div className="grid" style={{ gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 'var(--sp-5)', alignItems: 'start' }}>
        <Reveal dir="left" className="card card-flush">
          <table className="tbl">
            <caption className="sr-only">Indicator table for {city.name}</caption>
            <tbody>
              {rows.map((r) => (
                <tr key={r.label}>
                  <td style={{ color: 'var(--ink-3)', width: '48%' }}>{r.label}</td>
                  <td className="num" style={{ color: 'var(--ink)', fontWeight: 550 }}>{r.value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Reveal>

        <Reveal dir="right" delay={120} className="stack" style={{ gap: 'var(--sp-4)' }}>
          <div className="card">
            <span className="eyebrow" style={{ marginBottom: '0.6rem' }}>Landmarks & infrastructure</span>
            <div className="row" style={{ gap: 5, flexWrap: 'wrap' }}>
              {city.landmarks.map((l) => (
                <span key={l} className="badge" style={{ textTransform: 'none', letterSpacing: 0, fontWeight: 500 }}>
                  {l}
                </span>
              ))}
              {city.airport && (
                <span className="badge badge-ai" style={{ textTransform: 'none', letterSpacing: 0 }}>
                  <Icon name="arrowUpRight" size={12} /> {city.airport}
                </span>
              )}
            </div>
          </div>

          <div className="card card-accent" style={{ ['--accent' as string]: 'var(--grad-glacier)' }}>
            <span className="eyebrow" style={{ marginBottom: '0.6rem' }}>Ask about this city</span>
            <p className="small muted" style={{ marginBottom: '0.9rem' }}>
              Sakhi can pull every figure above, explain the mechanism behind the worst-scoring indicator, and
              cost out an intervention for {city.name} specifically.
            </p>
            <Link className="btn btn-ai btn-sm" to={`/ask?c=${city.id}`}>
              <Icon name="sparkle" size={13} /> Start the conversation
            </Link>
          </div>
        </Reveal>
      </div>
    </Section>
  );
}