import { Link } from 'react-router-dom';
import { Icon } from '@/components/Icon';
import { LineChart, Reveal, Section, SourceNote } from '@/components/ui';
import { cities, districts, nationalFile, provinces, sectors, SECTOR_IDS, severityOf } from '@/lib/nepal';
import { compact, num } from '@/lib/utils';

export default function About() {
  const totalPop = provinces.reduce((a, p) => a + p.pop, 0);
  const totalArea = provinces.reduce((a, p) => a + p.area, 0);
  const totalSolutions = sectors.reduce((a, s) => a + s.solutions.length, 0);

  return (
    <>
      <Section tight>
        <div className="stack" style={{ gap: '0.6rem', maxWidth: '68ch' }}>
          <span className="eyebrow">Methodology</span>
          <h1 className="h1" style={{ fontSize: 'clamp(2.2rem, 5vw, 3.4rem)' }}>
            How Nexa <span className="grad-crimson">thinks</span>
          </h1>
          <p className="lede">
            Nexa publishes indices, not measurements. This page states exactly how every number on the site is
            produced, which inputs it uses, and where it comes from — so you can disagree with it, and check us.
          </p>
        </div>
      </Section>

      {/* Ground rules */}
      <Section eyebrow="Ground rules" title="Three commitments">
        <div className="grid stagger" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(290px, 1fr))' }}>
          {[
            {
              icon: 'shield' as const,
              title: 'Every number is traceable',
              body: 'Administration, population and area come from the National Statistics Office census. Air, energy, health and connectivity anchors come from published national statistics. Where Nexa constructs a number, it says so and shows the formula.',
            },
            {
              icon: 'target' as const,
              title: 'Indices are labelled as indices',
              body: 'A composite severity of 72 means "72 on a 0–100 modelled scale", not "72 µg/m³" and not "72% worse". Nexa never dresses an index up as a measurement. The distinction is preserved in the UI, the AI prompts and the API.',
            },
            {
              icon: 'users' as const,
              title: 'Geography is respected',
              body: 'Nepal runs from 59 m in Jhapa to 8,848.86 m at Sagarmatha. A hill district and a Terai district have opposite problems, so every sector model carries a per-belt base. One-size-fits-all advice is a bug, not a feature.',
            },
          ].map((c) => (
            <div key={c.title} className="card">
              <span
                className="badge"
                style={{ width: 34, height: 34, justifyContent: 'center', padding: 0, color: 'var(--crimson)', borderColor: 'rgb(255 61 99 / 0.4)' }}
              >
                <Icon name={c.icon} size={17} />
              </span>
              <h3 className="h4" style={{ margin: '0.9rem 0 0.5rem' }}>{c.title}</h3>
              <p className="small muted">{c.body}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* The composite formula */}
      <Section eyebrow="The composite severity index" title="One formula, fully open" lede="The Nexa Composite Severity is a belt base per sector, adjusted by urbanisation, then adjusted again by declared hazard tags. It is reproducible from the bundled dataset in about ten lines of code.">
        <div className="grid" style={{ gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 'var(--sp-5)', alignItems: 'start' }}>
          <Reveal dir="left" className="card">
            <span className="eyebrow" style={{ marginBottom: '0.8rem' }}>Definition</span>
            <pre
              className="mono"
              style={{
                fontSize: 'var(--fs-sm)',
                lineHeight: 1.7,
                background: 'var(--surface)',
                border: '1px solid var(--line)',
                borderRadius: 'var(--r-sm)',
                padding: '1rem',
                overflowX: 'auto',
                margin: 0,
              }}
            >{`severity(district, sector) =
    BELT_BASE[sector][belt]        // per-belt baseline
  + (urbanisation - 35) * 0.34    // density pressure
  + 6 per matching hazard tag     // declared exposure
  + 4 if sector is health/connect
      and belt is mountain        // access friction
  clamped to [2, 100]

composite = mean(severity(d, s)
                 for all 9 sectors)`}</pre>

            <div className="stack" style={{ gap: 8, marginTop: '1.1rem' }}>
              <span className="stat-label">Belt baselines</span>
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Sector</th>
                    <th className="num">Terai</th>
                    <th className="num">Hill</th>
                    <th className="num">Mountain</th>
                  </tr>
                </thead>
                <tbody>
                  {SECTOR_IDS.map((id) => {
                    const s = sectors.find((x) => x.id === id)!;
                    const d = districts.find((x) => x.belt === 'terai')!;
                    return (
                      <tr key={id}>
                        <td style={{ color: 'var(--ink)' }}>{s.name}</td>
                        <td className="num mono">{severityOf(d, id)}</td>
                        <td className="num mono">{severityOf(districts.find((x) => x.belt === 'hill')!, id)}</td>
                        <td className="num mono">{severityOf(districts.find((x) => x.belt === 'mountain')!, id)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <p className="tiny muted">
                Shown as the belt baseline before the urbanisation and tag adjustments, so you can see what each
                belt contributes on its own.
              </p>
            </div>
          </Reveal>

          <Reveal dir="right" delay={120} className="stack" style={{ gap: 'var(--sp-4)' }}>
            <div className="card">
              <span className="eyebrow" style={{ marginBottom: '0.8rem' }}>What the index is not</span>
              <ul className="stack" style={{ gap: 8, listStyle: 'none' }}>
                {[
                  'It is not a probability of an event occurring.',
                  'It is not a measurement from a sensor or a survey.',
                  'It is not comparable across sectors — a flood index of 80 does not mean air of 80 is worse.',
                  'It is not a substitute for a local feasibility study before spending money.',
                ].map((t) => (
                  <li key={t} className="row" style={{ gap: 8, alignItems: 'flex-start' }}>
                    <span style={{ color: 'var(--crimson)', marginTop: 3, flexShrink: 0 }}><Icon name="close" size={13} /></span>
                    <span className="small muted">{t}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="card">
              <span className="eyebrow" style={{ marginBottom: '0.8rem' }}>Known limitations</span>
              <ul className="stack" style={{ gap: 8, listStyle: 'none' }}>
                {[
                  'District headquarters coordinates stand in for the whole district, which flatters very large or very mountainous districts.',
                  'Urbanisation is a single per-district index, so intra-district variation is invisible.',
                  'City-level indicators are modelled estimates, not instrument readings.',
                  'Tag assignment is manual and therefore arguable — a district could reasonably carry a tag it does not.',
                ].map((t) => (
                  <li key={t} className="row" style={{ gap: 8, alignItems: 'flex-start' }}>
                    <span style={{ color: 'var(--gold)', marginTop: 3, flexShrink: 0 }}><Icon name="alert" size={13} /></span>
                    <span className="small muted">{t}</span>
                  </li>
                ))}
              </ul>
            </div>
          </Reveal>
        </div>
      </Section>

      {/* Coverage */}
      <Section eyebrow="Coverage" title="What Nexa knows" tight>
        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))' }}>
          {[
            { label: 'Districts', value: districts.length },
            { label: 'Provinces', value: provinces.length },
            { label: 'Cities tracked', value: cities.length },
            { label: 'Sectors', value: sectors.length },
            { label: 'Costed solutions', value: totalSolutions },
            { label: 'Population covered', value: totalPop },
            { label: 'Area covered (km²)', value: totalArea },
            { label: 'Emergency lines', value: nationalFile.emergencies.items.length },
          ].map((s) => (
            <div key={s.label} className="card card-tight">
              <div className="stat">
                <span className="stat-label">{s.label}</span>
                <span className="stat-value" style={{ fontSize: '1.7rem' }}>{compact(s.value)}</span>
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* Trends with sources */}
      <Section eyebrow="Evidence" title="The trends Nexa reasons from" tight>
        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 'var(--sp-5)' }}>
          {Object.entries(nationalFile.series).map(([key, s]) => (
            <Reveal key={key} className="card">
              <div className="row-between" style={{ marginBottom: '0.8rem' }}>
                <span className="stack" style={{ gap: 2 }}>
                  <span className="stat-label">{s.label}</span>
                  <span className="tiny muted">
                    {num(s.points[0].v)} → {num(s.points[s.points.length - 1].v)} {s.unit}
                  </span>
                </span>
                <span className="badge">{s.unit}</span>
              </div>
              <LineChart points={s.points} height={168} color={key.includes('pm') || key.includes('aqi') ? 'var(--crimson)' : 'var(--glacier)'} unit={s.unit} />
              <p className="tiny muted" style={{ marginTop: '0.8rem' }}>Source: {s.source}</p>
            </Reveal>
          ))}
        </div>
      </Section>

      {/* How the AI is constrained */}
      <Section eyebrow="Sakhi" title="How the assistant is constrained" lede="The AI is not a search engine. It is bound to the same dataset, and its instructions forbid it from answering from memory on anything location-specific.">
        <div className="grid" style={{ gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 'var(--sp-5)', alignItems: 'start' }}>
          <Reveal dir="left" className="card">
            <span className="eyebrow" style={{ marginBottom: '0.8rem' }}>Grounding rules in the system prompt</span>
            <ol className="stack" style={{ gap: 9, listStyle: 'none' }}>
              {[
                'Always locate — name the district, city or province. "Nepal has traffic problems" is useless.',
                'Use the tools before answering anything about a place, a sector or a solution.',
                'Cite the anchor figure when the knowledge base has one.',
                'Separate fact from forecast explicitly.',
                'Be concrete about money and time — a range in rupees beats "significant investment".',
                'Respect the geography; never give one-size-fits-all advice.',
                'Admit ignorance and name the responsible institution.',
              ].map((r, i) => (
                <li key={i} className="row" style={{ gap: 9, alignItems: 'flex-start' }}>
                  <span className="mono tiny" style={{ color: 'var(--glacier)', minWidth: 16 }}>{i + 1}</span>
                  <span className="small muted">{r}</span>
                </li>
              ))}
            </ol>
          </Reveal>

          <Reveal dir="right" delay={120} className="card">
            <span className="eyebrow" style={{ marginBottom: '0.8rem' }}>Tools it can call</span>
            <div className="stack" style={{ gap: '0.9rem' }}>
              <div className="card card-tight" style={{ background: 'var(--surface)' }}>
                <code className="mono" style={{ color: 'var(--glacier)' }}>nexa_lookup</code>
                <p className="tiny muted" style={{ marginTop: 5 }}>
                  Six kinds — district, city, free search, national, sector, emergency. Returns the same records
                  the atlas renders, so the AI cannot disagree with the map.
                </p>
              </div>
              <div className="card card-tight" style={{ background: 'var(--surface)' }}>
                <code className="mono" style={{ color: 'var(--glacier)' }}>nexa_solutions</code>
                <p className="tiny muted" style={{ marginTop: 5 }}>
                  Returns the solution playbook for one sector — impact, cost, effort, horizon and mechanism.
                </p>
              </div>
              <div className="card card-tight" style={{ background: 'var(--surface)' }}>
                <strong style={{ fontSize: 'var(--fs-sm)' }}>Model selection</strong>
                <p className="tiny muted" style={{ marginTop: 5 }}>
                  The model is discovered at runtime from Google's model list and ranked, never hard-coded, so a
                  rename on Google's side cannot break the integration. A fallback chain covers the rest.
                </p>
              </div>
            </div>
          </Reveal>
        </div>
      </Section>

      {/* Architecture */}
      <Section eyebrow="Under the hood" title="How Nexa is built" tight>
        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
          {[
            { icon: 'layers' as const, title: 'Static first', body: 'React + Vite + TypeScript, deployed as static files. The knowledge base ships as JSON and every index is computed in the browser, so the whole site works offline and needs no backend.' },
            { icon: 'cpu' as const, title: 'Optional API', body: 'A small Node service adds server-side key custody, model discovery, a JSON-file database and signal sync. When it is absent Nexa degrades to direct browser calls rather than breaking.' },
            { icon: 'shield' as const, title: 'Keys stay put', body: 'A browser-supplied Gemini key is stored in localStorage and sent straight to Google. It is never proxied through, or logged by, any Nexa server.' },
            { icon: 'globe' as const, title: 'Accessible and bilingual', body: 'Keyboard navigable, reduced-motion aware, screen-reader labelled, and prepared for Devanagari throughout. Data figures are rendered in both numerals where it matters.' },
          ].map((c) => (
            <div key={c.title} className="card">
              <Icon name={c.icon} size={19} style={{ color: 'var(--glacier)' }} />
              <h3 className="h4" style={{ margin: '0.7rem 0 0.4rem' }}>{c.title}</h3>
              <p className="small muted">{c.body}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section tight>
        <div className="row-between" style={{ flexWrap: 'wrap' }}>
          <SourceNote text={nationalFile.$meta?.note ?? 'National data from NSO and published ministry statistics. Indices are Nexa constructions.'} />
          <div className="row" style={{ gap: '0.5rem', flexWrap: 'wrap' }}>
            <Link className="btn btn-ghost btn-sm" to="/atlas">
              <Icon name="map" size={13} /> Problem Atlas
            </Link>
            <Link className="btn btn-primary btn-sm" to="/ask">
              <Icon name="sparkle" size={13} /> Ask Sakhi
            </Link>
          </div>
        </div>
      </Section>
    </>
  );
}