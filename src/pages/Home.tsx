import { Link } from 'react-router-dom';
import { NepalMap, SECTOR_ACCENT } from '@/components/NepalMap';
import { Icon, SECTOR_ICON } from '@/components/Icon';
import { Bar, Reveal, Section, SeverityBadge, SourceNote, Sparkline, Stat } from '@/components/ui';
import { cities, districtById, nationalFile, profileOf, sectors } from '@/lib/nepal';
import type { SectorId } from '@/types';
import { useNexa } from '@/store/AppContext';
import { compact, grade, num } from '@/lib/utils';
import { useTicker } from '@/hooks/useReveal';

const HEADLINE_IDS = ['kathmandu', 'lalitpur', 'morang', 'bhaktapur', 'rupandehi'] as const;

/** Rotating "right now in Nepal" lines, all derived from the bundled dataset. */
function buildFeed(): string[] {
  const out: string[] = [];
  for (const id of HEADLINE_IDS) {
    const p = profileOf(id);
    if (!p) continue;
    out.push(
      `${p.district.name} carries a composite pressure index of ${p.composite}/100, driven hardest by ${p.topSector.name.toLowerCase()}.`,
    );
  }
  for (const s of sectors.slice(0, 4)) {
    out.push(`${s.name}: ${s.headline}`);
  }
  return out;
}

export default function Home() {
  const { signals, lang, theme } = useNexa();
  const tick = useTicker(5600);
  const feed = buildFeed();

  const headline = nationalFile.headline;
  const topSector = sectors.slice().sort((a, b) => b.severity - a.severity)[0];
  const capital = cities.find((c) => c.id === 'kathmandu') ?? cities[0];
  const ranked = HEADLINE_IDS.map((id) => profileOf(id)).filter(Boolean);
  const current = feed[tick % feed.length];

  const capitalSectorScore = (id: SectorId): number => {
    const s = sectors.find((x) => x.id === id);
    const cityVal = citySectorValue(capital, id);
    return s ? Math.round((s.severity + cityVal) / 2) : 0;
  };

  return (
    <>
      {/* ══════════════════════════ HERO ══════════════════════════ */}
      <section className="hero">
        <div className="hero-bg" />
        <div className="bg-grid" />

        <span className="orb breathe" style={{ width: 340, height: 340, top: -90, left: '4%', background: 'rgb(255 61 99 / 0.3)' }} />
        <span className="orb breathe" style={{ width: 300, height: 300, top: 60, right: '2%', background: 'rgb(56 189 248 / 0.26)', animationDelay: '1.4s' }} />
        <span className="orb breathe" style={{ width: 260, height: 260, bottom: -60, left: '46%', background: 'rgb(167 139 250 / 0.22)', animationDelay: '2.6s' }} />

        <div className="wrap">
          <div
            className="grid"
            style={{ gridTemplateColumns: 'minmax(0, 1.05fr) minmax(0, 0.95fr)', gap: 'clamp(2rem, 5vw, 4rem)', alignItems: 'center' }}
          >
            <div>
              <span className="badge badge-crit a-in" style={{ marginBottom: '1.1rem' }}>
                <span className="dot dot-live" />
                {signals.length > 0
                  ? `${signals.length} citizen signal${signals.length === 1 ? '' : 's'} tracked`
                  : '77 districts · 7 provinces · 9 sectors'}
              </span>

              <h1 className="hero-title">
                <span className="line"><span>Everyday problems.</span></span>
                <span className="line"><span className="grad-crimson">Smarter solutions.</span></span>
                <span className="line"><span style={{ color: 'var(--ink-3)' }}>For all of Nepal.</span></span>
              </h1>

              <p className="lede a-up d-3" style={{ marginTop: '1.3rem' }}>
                Nine everyday problems — air, traffic, flood, waste, water, energy, health, agriculture and
                connectivity — tracked across <strong style={{ color: 'var(--ink)' }}>77 districts</strong> and{' '}
                <strong style={{ color: 'var(--ink)' }}>7 provinces</strong>. Nexa shows you where the problem is,
                why it happens, and what it costs to fix.
              </p>

              <div className="row a-up d-4" style={{ marginTop: '1.7rem', flexWrap: 'wrap', gap: '0.6rem' }}>
                <Link className="btn btn-primary btn-lg" to="/atlas">
                  <Icon name="map" size={17} /> Explore the Problem Atlas
                </Link>
                <Link className="btn btn-ai btn-lg" to="/ask">
                  <Icon name="sparkle" size={17} /> Ask Sakhi
                </Link>
              </div>

              <p className="tiny muted a-up d-5" style={{ marginTop: '1.1rem' }}>
                No account needed · Works offline · {theme === 'dark' ? 'Dark' : 'Light'} mode
                {lang === 'ne' && ' · नेपाली'}
              </p>
            </div>

            <Reveal dir="scale" delay={180} className="card card-solid">
              <div className="row-between" style={{ marginBottom: '1rem' }}>
                <span className="eyebrow" style={{ margin: 0 }}>Right now in Nepal</span>
                <span className="ticker">
                  <span className="dot dot-live" style={{ color: 'var(--jade)' }} />
                  streaming
                </span>
              </div>

              <p className="h4" style={{ minHeight: '4.4em', lineHeight: 1.5 }} key={tick}>
                {current}
              </p>

              <hr className="hr" style={{ margin: '0.9rem 0 1rem' }} />

              <div className="stack" style={{ gap: '0.8rem' }}>
                {headline.slice(0, 3).map((h) => {
                  const span = h.id === 'pop' ? 32_000_000 : h.value * 3;
                  return (
                    <div key={h.id} className="stack" style={{ gap: 5 }}>
                      <div className="row-between tiny">
                        <span className="muted">{h.label}</span>
                        <span className="mono" style={{ color: 'var(--ink)' }}>
                          {compact(h.value)}
                          {h.suffix}
                        </span>
                      </div>
                      <Bar value={Math.min(100, (h.value / span) * 100)} height={4} />
                    </div>
                  );
                })}
              </div>

              <Link className="btn btn-ghost btn-sm btn-block" to="/atlas" style={{ marginTop: '1.1rem' }}>
                Open the atlas <Icon name="arrowRight" size={13} />
              </Link>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ══════════════════════ HEADLINE STATS ══════════════════════ */}
      <Section tight>
        <div className="grid stagger stagger-fast" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(212px, 1fr))' }}>
          {headline.map((h) => (
            <Stat key={h.id} label={h.label} value={h.value} suffix={h.suffix} sub={h.sub} />
          ))}
        </div>
        <div style={{ marginTop: '1.2rem' }}>
          <SourceNote text={`Sources: ${[...new Set(headline.map((h) => h.source))].join(' · ')}`} />
        </div>
      </Section>

      {/* ══════════════════════ ATLAS ══════════════════════ */}
      <Section
        id="atlas"
        eyebrow="Problem Atlas"
        title="Where Nepal's everyday problems actually are"
        lede="Hover or tap any district. The index blends ecological belt, urbanisation and hazard exposure into one reproducible, auditable number."
      >
        <div className="grid" style={{ gridTemplateColumns: 'minmax(0, 1.3fr) minmax(0, 0.7fr)', gap: 'var(--sp-6)', alignItems: 'start' }}>
          <Reveal dir="left" className="card" style={{ padding: '1.25rem' }}>
            <NepalMap sector="composite" />
          </Reveal>

          <div className="stack" style={{ gap: 'var(--sp-4)' }}>
            <Reveal dir="right" delay={100} className="card">
              <span className="eyebrow" style={{ marginBottom: '0.7rem' }}>Highest composite pressure</span>
              <div className="stack" style={{ gap: '0.15rem' }}>
                {ranked.map((p, i) => p && (
                  <Link
                    key={p.district.id}
                    to={`/districts/${p.district.id}`}
                    className="row-between"
                    style={{ padding: '0.45rem 0.5rem', borderRadius: 'var(--r-sm)' }}
                  >
                    <span className="row" style={{ gap: 8, minWidth: 0 }}>
                      <span className="mono tiny muted" style={{ width: 14 }}>{i + 1}</span>
                      <strong style={{ fontSize: 'var(--fs-sm)' }}>{p.district.name}</strong>
                      <span className="tiny muted truncate">{p.district.hq}</span>
                    </span>
                    <span className="mono tiny" style={{ color: grade(p.composite).color, fontWeight: 700 }}>
                      {p.composite}
                    </span>
                  </Link>
                ))}
              </div>
            </Reveal>

            <Reveal dir="right" delay={200} className="card">
              <span className="eyebrow" style={{ marginBottom: '0.5rem' }}>Most acute national sector</span>
              <h3 className="h3" style={{ marginTop: '0.35rem' }}>
                {topSector.name}{' '}
                <span className="ne muted" style={{ fontSize: '0.58em' }}>{topSector.ne}</span>
              </h3>
              <p className="small muted" style={{ marginTop: '0.5rem' }}>{topSector.headline}</p>
              <div className="row-between" style={{ marginTop: '1rem' }}>
                <SeverityBadge value={topSector.severity} />
                <Link className="btn btn-ghost btn-sm" to={`/sectors/${topSector.id}`}>
                  Solutions <Icon name="arrowRight" size={13} />
                </Link>
              </div>
            </Reveal>
          </div>
        </div>
      </Section>

      {/* ══════════════════════ SECTORS ══════════════════════ */}
      <Section
        eyebrow="Nine sectors"
        title="Everyday problems, broken down"
        lede="Each sector carries a documented mechanism — the causal chain that turns a symptom into a system. Understanding the mechanism is what makes a solution actually work."
      >
        <div className="grid stagger" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(272px, 1fr))' }}>
          {sectors.map((s) => (
            <Link
              key={s.id}
              to={`/sectors/${s.id}`}
              className="card card-hover card-accent"
              style={{ ['--accent' as string]: `linear-gradient(90deg, ${SECTOR_ACCENT[s.id]}, transparent)` }}
            >
              <div className="row-between" style={{ alignItems: 'flex-start', marginBottom: '0.8rem' }}>
                <span
                  className="badge"
                  style={{ borderColor: `${SECTOR_ACCENT[s.id]}55`, color: SECTOR_ACCENT[s.id], background: `${SECTOR_ACCENT[s.id]}14` }}
                >
                  <Icon name={SECTOR_ICON[s.id]} size={13} />
                  {s.name}
                </span>
                <span className="mono tiny" style={{ color: grade(s.severity).color, fontWeight: 700 }}>
                  {s.severity}
                </span>
              </div>

              <h3 className="h4">
                {s.name} <span className="ne muted" style={{ fontSize: '0.68em', marginLeft: 4 }}>{s.ne}</span>
              </h3>
              <p className="small muted clamp-3" style={{ marginTop: '0.45rem' }}>{s.problem}</p>

              <hr className="hr" style={{ margin: '0.9rem 0' }} />

              <div className="stack" style={{ gap: 7 }}>
                <div className="row-between tiny">
                  <span className="muted">{s.anchor.label}</span>
                  <span className="mono" style={{ color: 'var(--ink)' }}>
                    {compact(s.anchor.value)}{s.anchor.unit} → {compact(s.anchor.target)}{s.anchor.unit}
                  </span>
                </div>
                <Bar value={s.anchor.value} max={s.anchor.target * 3} color={`linear-gradient(90deg, ${SECTOR_ACCENT[s.id]}, ${SECTOR_ACCENT[s.id]}55)`} height={5} />
                <span className="tiny muted row" style={{ gap: 5 }}>
                  <Icon name="bulb" size={12} /> {s.solutions.length} costed solutions · {s.mechanism.length}-step mechanism
                </span>
              </div>
            </Link>
          ))}
        </div>
      </Section>

      {/* ══════════════════════ TRENDS ══════════════════════ */}
      <Section
        eyebrow="The numbers"
        title="Trends that explain the crisis"
        lede="Long-run indicators, each carrying its source. These are the constraints any real solution has to work inside."
      >
        <div className="grid stagger" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(292px, 1fr))' }}>
          {Object.entries(nationalFile.series)
            .slice(0, 4)
            .map(([key, s]) => {
              const up = s.points[s.points.length - 1].v > s.points[0].v;
              const bad = /pm|aqi|brief/i.test(key);
              const color = bad ? 'var(--crimson)' : up ? 'var(--gold)' : 'var(--jade)';
              return (
                <div key={key} className="card">
                  <div className="row-between" style={{ alignItems: 'flex-start' }}>
                    <div className="stack" style={{ gap: 2 }}>
                      <span className="stat-label">{s.label}</span>
                      <span className="row" style={{ gap: 6 }}>
                        <Icon name={up ? 'trendUp' : 'trendDown'} size={14} style={{ color }} />
                        <span className="mono tiny" style={{ color }}>
                          {up ? 'rising' : 'falling'}
                        </span>
                      </span>
                    </div>
                    <span className="badge">{s.unit}</span>
                  </div>
                  <div style={{ margin: '0.9rem 0 0.5rem' }}>
                    <Sparkline values={s.points.map((p) => p.v)} color={color} height={56} />
                  </div>
                  <p className="tiny muted">Source: {s.source}</p>
                </div>
              );
            })}
        </div>
      </Section>

      {/* ══════════════════════ CAPITAL DEEP DIVE ══════════════════════ */}
      <Section
        eyebrow="Field report"
        title={`Inside ${capital.name}`}
        lede="One city, every indicator. This is what a district profile looks like when it is not reduced to an average."
      >
        <div className="grid" style={{ gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 'var(--sp-6)', alignItems: 'center' }}>
          <Reveal dir="left" className="card">
            <div className="row-between" style={{ marginBottom: '1rem' }}>
              <div className="stack" style={{ gap: 2 }}>
                <h3 className="h3">{capital.name}</h3>
                <span className="tiny muted">
                  {capital.type} · {districtById.get(capital.district)?.name} · {num(capital.alt)} m elevation
                </span>
              </div>
              <span className="badge badge-ai">{capital.type}</span>
            </div>

            <p className="small muted" style={{ marginBottom: '1.1rem' }}>{capital.blurb}</p>

            <dl className="kv">
              <dt>PM2.5</dt>
              <dd>{capital.air.pm25} µg/m³</dd>
              <dt>Air quality index</dt>
              <dd>{capital.air.aqi} · {capital.air.worst}</dd>
              <dt>Peak congestion</dt>
              <dd>{capital.traffic.congestion}%</dd>
              <dt>Waste generated</dt>
              <dd>{capital.waste.tpd} t/day</dd>
              <dt>Recycled</dt>
              <dd>{capital.waste.recycled}%</dd>
              <dt>Peak load</dt>
              <dd>{compact(capital.energy.peakLoadMW)} MW</dd>
              <dt>Outage hours</dt>
              <dd>{capital.energy.outageHours} h/day</dd>
              <dt>Internet penetration</dt>
              <dd>{capital.connect.internet}%</dd>
              <dt>Digital literacy</dt>
              <dd>{capital.connect.digitalLiteracy}%</dd>
            </dl>

            <div className="row" style={{ marginTop: '1.2rem', flexWrap: 'wrap' }}>
              <Link className="btn btn-primary btn-sm" to={`/districts/${capital.district}`}>
                Full district profile
              </Link>
              <Link className="btn btn-ghost btn-sm" to="/ask">
                Ask about {capital.name} <Icon name="sparkle" size={13} />
              </Link>
            </div>
          </Reveal>

          <Reveal dir="right" delay={140} className="stack" style={{ gap: 'var(--sp-3)' }}>
            {(['air', 'traffic', 'flood', 'waste', 'health'] as SectorId[]).map((id) => {
              const s = sectors.find((x) => x.id === id);
              if (!s) return null;
              const v = capitalSectorScore(id);
              return (
                <div key={id} className="card card-tight card-hover">
                  <div className="row-between">
                    <span className="row" style={{ gap: 8 }}>
                      <Icon name={SECTOR_ICON[id]} size={15} style={{ color: SECTOR_ACCENT[id] }} />
                      <strong style={{ fontSize: 'var(--fs-sm)' }}>{s.name}</strong>
                    </span>
                    <span className="mono tiny" style={{ color: grade(v).color, fontWeight: 700 }}>
                      {v}
                    </span>
                  </div>
                  <div style={{ marginTop: 8 }}>
                    <Bar value={v} color={`linear-gradient(90deg, ${SECTOR_ACCENT[id]}, ${SECTOR_ACCENT[id]}44)`} height={5} />
                  </div>
                  <p className="tiny muted clamp-2" style={{ marginTop: 7 }}>{s.mechanism[0]}</p>
                </div>
              );
            })}
          </Reveal>
        </div>
      </Section>

      {/* ══════════════════════ CTA ══════════════════════ */}
      <Section tight>
        <Reveal dir="scale" className="card card-solid" style={{ padding: 'clamp(1.8rem, 5vw, 3.2rem)', textAlign: 'center' }}>
          <span className="orb breathe" style={{ width: 240, height: 240, top: -70, left: '50%', transform: 'translateX(-50%)', background: 'rgb(56 189 248 / 0.2)' }} />
          <span className="eyebrow" style={{ marginBottom: '0.8rem' }}>Get started</span>
          <h2 className="h2 grad-ink" style={{ marginBottom: '0.8rem' }}>Three ways in</h2>
          <p className="lede" style={{ margin: '0 auto 1.6rem' }}>
            Explore the atlas, report something broken, or ask Sakhi a hard question about your district.
          </p>
          <div className="row" style={{ justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link className="btn btn-primary" to="/atlas">
              <Icon name="map" size={16} /> Problem Atlas
            </Link>
            <Link className="btn btn-ghost" to="/report">
              <Icon name="flag" size={16} /> Report a problem
            </Link>
            <Link className="btn btn-ai" to="/ask">
              <Icon name="sparkle" size={16} /> Ask Sakhi
            </Link>
          </div>
        </Reveal>
      </Section>
    </>
  );
}

/** Maps a city indicator onto the 0–100 sector scale used across Nexa. */
function citySectorValue(city: typeof cities[number], id: SectorId): number {
  switch (id) {
    case 'air': return Math.min(100, Math.round(city.air.aqi / 3));
    case 'traffic': return city.traffic.congestion;
    case 'flood': return city.water.floodProne.length * 22;
    case 'waste': return Math.min(100, Math.round(city.waste.tpd / 1.4));
    case 'water': return Math.min(100, Math.round(100 - city.water.floodProne.length * 20));
    case 'energy': return Math.min(100, Math.round(city.energy.outageHours * 9));
    case 'health': return Math.min(100, Math.round(100 - city.health.phcReach30min));
    case 'agri': return 45;
    case 'connect': return Math.min(100, Math.round(100 - city.connect.digitalLiteracy));
    default: return 0;
  }
}