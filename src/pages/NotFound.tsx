import { Link } from 'react-router-dom';
import { Icon } from '@/components/Icon';
import { Section } from '@/components/ui';

const LINKS = [
  { to: '/atlas', label: 'Problem Atlas', icon: 'map' as const },
  { to: '/districts', label: 'All 77 districts', icon: 'pin' as const },
  { to: '/sectors', label: 'Nine sectors', icon: 'layers' as const },
  { to: '/solutions', label: 'Solution library', icon: 'bulb' as const },
  { to: '/report', label: 'Report a problem', icon: 'flag' as const },
  { to: '/insights', label: 'Live insights', icon: 'trendUp' as const },
  { to: '/ask', label: 'Ask Sakhi', icon: 'sparkle' as const },
  { to: '/about', label: 'Methodology', icon: 'book' as const },
];

export default function NotFound() {
  return (
    <Section>
      <div className="stack" style={{ alignItems: 'center', textAlign: 'center', gap: '0.9rem', maxWidth: '58ch', margin: '0 auto' }}>
        <span
          className="badge badge-crit"
          style={{ width: 54, height: 54, justifyContent: 'center', padding: 0, fontSize: '1.2rem' }}
        >
          404
        </span>

        <h1 className="h1" style={{ fontSize: 'clamp(2rem, 5vw, 3rem)' }}>
          Not in the <span className="grad-crimson">knowledge base</span>
        </h1>

        <p className="lede">
          That route does not exist. Nexa does not recognise it, and — unlike Sakhi — it will not guess.
        </p>

        <div className="row" style={{ justifyContent: 'center', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.5rem' }}>
          <Link className="btn btn-primary" to="/">
            <Icon name="home" size={15} /> Back to home
          </Link>
          <Link className="btn btn-ai" to="/ask">
            <Icon name="sparkle" size={15} /> Ask Sakhi instead
          </Link>
        </div>

        <hr className="hr" style={{ width: '100%', margin: '1.2rem 0' }} />

        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', textAlign: 'left', width: '100%' }}>
          {LINKS.map((l) => (
            <Link key={l.to} to={l.to} className="card card-tight card-hover">
              <div className="row" style={{ gap: 8 }}>
                <Icon name={l.icon} size={15} style={{ color: 'var(--crimson)' }} />
                <span className="small" style={{ fontWeight: 550 }}>{l.label}</span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </Section>
  );
}