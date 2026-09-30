import { Link, useParams } from 'react-router-dom';
import { SECTOR_ACCENT } from '@/components/NepalMap';
import { Icon, SECTOR_ICON } from '@/components/Icon';
import { Bar, Empty, Reveal, Section, SeverityBadge, SourceNote } from '@/components/ui';
import { districts, sectorById, severityOf } from '@/lib/nepal';
import { compact, grade, num } from '@/lib/utils';

const COST_TONE: Record<string, string> = {
  Low: 'var(--jade)',
  Medium: 'var(--gold)',
  High: 'var(--coral)',
  'Very high': 'var(--crimson)',
};

export default function SectorDetail() {
  const { id = '' } = useParams();
  const sector = sectorById.get(id as never);

  if (!sector) {
    return (
      <Section>
        <Empty icon="search" title="Sector not found" hint={`“${id}” is not one of the nine sectors Nexa tracks.`} />
        <div style={{ textAlign: 'center', marginTop: '1.2rem' }}>
          <Link className="btn btn-primary" to="/sectors">All nine sectors</Link>
        </div>
      </Section>
    );
  }

  const accent = SECTOR_ACCENT[sector.id];
  const worst = districts
    .map((d) => ({ d, v: severityOf(d, sector.id) }))
    .sort((a, b) => b.v - a.v)
    .slice(0, 12);
  const maxV = worst[0]?.v ?? 1;
  const totalImpact = sector.solutions.reduce((a, s) => a + s.impact, 0);

  return (
    <>
      <Section tight>
        <Link className="btn btn-ghost btn-sm" to="/sectors" style={{ marginBottom: '1.1rem' }}>
          <Icon name="arrowRight" size={13} style={{ transform: 'rotate(180deg)' }} /> All sectors
        </Link>

        <div className="grid" style={{ gridTemplateColumns: 'minmax(0, 1fr) auto', gap: 'var(--sp-5)', alignItems: 'start' }}>
          <div className="stack" style={{ gap: '0.6rem' }}>
            <span className="row" style={{ gap: 9 }}>
              <span
                className="badge"
                style={{ borderColor: `${accent}55`, color: accent, background: `${accent}14`, width: 34, height: 34, justifyContent: 'center', padding: 0 }}
              >
                <Icon name={SECTOR_ICON[sector.id]} size={18} />
              </span>
              <span className="eyebrow" style={{ margin: 0 }}>Sector brief</span>
            </span>

            <h1 className="h1" style={{ fontSize: 'clamp(2.3rem, 5.4vw, 3.8rem)' }}>
              {sector.name} <span className="ne" style={{ fontSize: '0.45em', color: accent }}>{sector.ne}</span>
            </h1>
            <p className="lede">{sector.headline}</p>
            <p className="small muted" style={{ maxWidth: '68ch' }}>{sector.problem}</p>
          </div>

          <div className="card card-solid" style={{ textAlign: 'center', minWidth: 172 }}>
            <span className="stat-label">National severity</span>
            <span className="stat-value" style={{ color: grade(sector.severity).color }}>{sector.severity}</span>
            <SeverityBadge value={sector.severity} />
            <hr className="hr" style={{ margin: '0.7rem 0' }} />
            <span className="tiny muted">Anchor gap</span>
            <strong className="mono" style={{ display: 'block', fontSize: 'var(--fs-md)' }}>
              {sector.anchor.value}
              {sector.anchor.unit} → {sector.anchor.target}
              {sector.anchor.unit}
            </strong>
          </div>
        </div>
      </Section>

      {/* Anchor + mechanism */}
      <Section eyebrow="The mechanism" title="Why this happens in Nepal" tight>
        <div className="grid" style={{ gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 'var(--sp-5)', alignItems: 'start' }}>
          <Reveal dir="left" className="card">
            <span className="eyebrow" style={{ marginBottom: '0.7rem' }}>Causal chain</span>
            <ol className="stack" style={{ gap: '0.7rem', listStyle: 'none' }}>
              {sector.mechanism.map((m, i) => (
                <li key={i} className="row" style={{ gap: 11, alignItems: 'flex-start' }}>
                  <span
                    className="mono"
                    style={{
                      flexShrink: 0,
                      width: 24,
                      height: 24,
                      borderRadius: 999,
                      display: 'grid',
                      placeItems: 'center',
                      background: `${accent}1f`,
                      border: `1px solid ${accent}55`,
                      color: accent,
                      fontWeight: 700,
                      fontSize: 11,
                    }}
                  >
                    {i + 1}
                  </span>
                  <span className="small" style={{ color: 'var(--ink-2)', lineHeight: 1.62 }}>{m}</span>
                </li>
              ))}
            </ol>
          </Reveal>

          <Reveal dir="right" delay={120} className="stack" style={{ gap: 'var(--sp-4)' }}>
            <div className="card">
              <span className="eyebrow" style={{ marginBottom: '0.6rem' }}>Anchor indicator</span>
              <p className="small muted">{sector.anchor.label}</p>
              <div className="row" style={{ gap: 10, margin: '0.5rem 0 0.7rem' }}>
                <span className="mono" style={{ fontSize: '1.9rem', fontWeight: 700, letterSpacing: '-0.035em', color: 'var(--ink)' }}>
                  {compact(sector.anchor.value)}
                  {sector.anchor.unit}
                </span>
                <Icon name="arrowRight" size={16} style={{ color: 'var(--ink-4)' }} />
                <span className="mono" style={{ fontSize: '1.15rem', color: 'var(--ink-3)' }}>
                  {compact(sector.anchor.target)}
                  {sector.anchor.unit}
                </span>
              </div>
              <Bar value={sector.anchor.value} max={sector.anchor.target * 3} color={`linear-gradient(90deg, ${accent}, ${accent}55)`} height={7} />
              <p className="tiny muted" style={{ marginTop: 8 }}>Target: {sector.anchor.targetLabel}</p>
            </div>

            <div className="card">
              <span className="eyebrow" style={{ marginBottom: '0.6rem' }}>What to watch</span>
              <div className="stack" style={{ gap: 7 }}>
                {sector.signals.map((sig) => (
                  <div key={sig} className="row" style={{ gap: 8, alignItems: 'flex-start' }}>
                    <span style={{ color: accent, marginTop: 2, flexShrink: 0 }}>
                      <Icon name="target" size={13} />
                    </span>
                    <span className="small muted">{sig}</span>
                  </div>
                ))}
              </div>
            </div>
          </Reveal>
        </div>
      </Section>

      {/* District exposure */}
      <Section eyebrow="Geography" title={`Where ${sector.name.toLowerCase()} bites hardest`} tight>
        <Reveal className="card">
          <div className="stack" style={{ gap: 8 }}>
            {worst.map(({ d, v }, i) => (
              <Link
                key={d.id}
                to={`/districts/${d.id}`}
                className="row"
                style={{ gap: 12, padding: '0.22rem 0.3rem', borderRadius: 'var(--r-xs)', transition: 'background 140ms' }}
              >
                <span className="mono tiny muted" style={{ width: 16, textAlign: 'right' }}>{i + 1}</span>
                <span className="small" style={{ width: 'clamp(96px, 22%, 190px)', color: 'var(--ink)', fontWeight: 520, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {d.name}
                </span>
                <span style={{ flex: 1, minWidth: 40 }}>
                  <Bar value={v} max={maxV} color={`linear-gradient(90deg, ${accent}, ${accent}44)`} height={6} />
                </span>
                <span className="tiny muted truncate" style={{ width: 'clamp(64px, 16%, 130px)', textAlign: 'right' }}>
                  {d.belt} · {num(d.pop)}
                </span>
                <span className="mono tiny" style={{ color: grade(v).color, fontWeight: 700, width: 26, textAlign: 'right' }}>
                  {v}
                </span>
              </Link>
            ))}
          </div>
        </Reveal>
      </Section>

      {/* Solutions */}
      <Section
        eyebrow="Interventions"
        title={`${sector.solutions.length} costed solutions`}
        lede={`Each carries a modelled impact on this sector, a cost band, an effort band and a delivery window. Combined modelled impact: ${totalImpact} index points.`}
      >
        <div className="grid stagger" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(310px, 1fr))' }}>
          {sector.solutions.map((sol) => (
            <div key={sol.title} className="card card-hover" style={{ borderTop: `2px solid ${accent}` }}>
              <div className="row-between" style={{ marginBottom: '0.6rem' }}>
                <span className="badge" style={{ textTransform: 'none', letterSpacing: 0, fontWeight: 550, color: accent, borderColor: `${accent}44` }}>
                  {sol.lever}
                </span>
                <span className="mono" style={{ fontSize: '1.1rem', fontWeight: 700, color: accent }}>
                  +{sol.impact}
                </span>
              </div>

              <h3 className="h4">{sol.title}</h3>
              <p className="small muted" style={{ margin: '0.5rem 0 0.9rem' }}>{sol.how}</p>

              <div style={{ marginBottom: '0.9rem' }}>
                <Bar value={sol.impact} color={`linear-gradient(90deg, ${accent}, ${accent}44)`} height={5} />
              </div>

              <div className="row" style={{ gap: 5, flexWrap: 'wrap' }}>
                <span className="badge" style={{ color: COST_TONE[sol.cost], borderColor: `${COST_TONE[sol.cost]}44` }}>
                  {sol.cost} cost
                </span>
                <span className="badge">{sol.effort} effort</span>
                <span className="badge">
                  <Icon name="clock" size={11} /> {sol.horizon}
                </span>
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* CTA */}
      <Section tight>
        <Reveal dir="scale" className="card card-solid card-accent" style={{ ['--accent' as string]: `linear-gradient(90deg, ${accent}, transparent)`, textAlign: 'center' }}>
          <span className="eyebrow" style={{ marginBottom: '0.7rem' }}>Go deeper</span>
          <h2 className="h2 grad-ink" style={{ marginBottom: '0.6rem' }}>
            Ask Sakhi about {sector.name.toLowerCase()}
          </h2>
          <p className="lede" style={{ margin: '0 auto 1.4rem' }}>
            Get the sector mechanism explained for a specific district, with costed next steps and the
            responsible institution named.
          </p>
          <div className="row" style={{ justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link className="btn btn-ai" to={`/ask?s=${sector.id}`}>
              <Icon name="sparkle" size={16} /> Ask about {sector.name.toLowerCase()}
            </Link>
            <Link className="btn btn-ghost" to={`/report?s=${sector.id}`}>
              <Icon name="flag" size={16} /> Report a {sector.name.toLowerCase()} issue
            </Link>
          </div>
        </Reveal>
      </Section>

      <Section tight>
        <SourceNote text="Sector severity, mechanism and solution impacts are Nexa constructions built on published national statistics. Treat them as prioritisation aids, not forecasts." />
      </Section>
    </>
  );
}