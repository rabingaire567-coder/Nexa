import { useEffect, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { Logo } from './Logo';
import { Icon } from './Icon';
import { useNexa } from '@/store/AppContext';
import { cx } from '@/lib/utils';

const LINKS = [
  { to: '/', label: 'Home', end: true },
  { to: '/atlas', label: 'Problem Atlas' },
  { to: '/districts', label: 'Districts' },
  { to: '/sectors', label: 'Sectors' },
  { to: '/report', label: 'Report' },
  { to: '/insights', label: 'Insights' },
];

export function Nav() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const { theme, toggleTheme, hasKey, backend } = useNexa();
  const loc = useLocation();

  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 12);
    on();
    window.addEventListener('scroll', on, { passive: true });
    return () => window.removeEventListener('scroll', on);
  }, []);

  useEffect(() => setOpen(false), [loc.pathname]);

  const aiReady = backend?.up || hasKey;

  return (
    <>
      <header className={cx('nav', scrolled && 'scrolled')}>
        <div className="wrap nav-inner">
          <Link to="/" aria-label="Nexa home">
            <Logo />
          </Link>

          <nav className="nav-links" aria-label="Primary">
            {LINKS.map((l) => (
              <NavLink key={l.to} to={l.to} end={l.end} className={({ isActive }) => cx('nav-link', isActive && 'active')}>
                {l.label}
              </NavLink>
            ))}
          </nav>

          <div className="nav-actions">
            <Link className="btn btn-ai btn-sm" to="/ask">
              <Icon name="sparkle" size={14} />
              <span className="sr-only">Open </span>Ask Sakhi
            </Link>

            <span
              className="badge tooltip-host"
              style={{ borderColor: 'transparent', background: 'transparent' }}
              title={backend?.up ? 'Nexa API connected — key stays server-side' : hasKey ? 'Browser mode — your key is stored locally' : 'Add a Gemini key in Settings'}
            >
              <span className={cx('dot', aiReady ? 'dot-live' : '')} style={{ color: aiReady ? 'var(--jade)' : 'var(--ink-4)' }} />
              <span className="tiny muted" style={{ letterSpacing: 0 }}>
                {backend?.up ? 'API' : hasKey ? 'Local' : 'Offline'}
              </span>
              <span className="tooltip">{backend?.up ? 'Server connected' : hasKey ? 'Direct from your browser' : 'No key configured'}</span>
            </span>

            <button className="btn-icon" onClick={toggleTheme} aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}>
              <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={16} />
            </button>

            <Link className="btn-icon" to="/settings" aria-label="Settings">
              <Icon name="settings" size={16} />
            </Link>

            <button className="nav-toggle" onClick={() => setOpen((o) => !o)} aria-label="Toggle navigation" aria-expanded={open}>
              <Icon name={open ? 'close' : 'menu'} size={17} />
            </button>
          </div>
        </div>
      </header>

      {open && (
        <nav className="nav-drawer" aria-label="Mobile">
          {LINKS.map((l) => (
            <NavLink key={l.to} to={l.to} end={l.end} className={({ isActive }) => cx('nav-link', isActive && 'active')}>
              {l.label}
            </NavLink>
          ))}
          <Link className="btn btn-ai btn-block" to="/ask" style={{ marginTop: '0.75rem' }}>
            <Icon name="sparkle" size={15} /> Ask Sakhi
          </Link>
        </nav>
      )}
    </>
  );
}

export function Footer() {
  return (
    <footer className="footer">
      <div className="wrap">
        <div className="footer-grid">
          <div className="stack" style={{ gap: '0.7rem', maxWidth: '38ch' }}>
            <Logo />
            <p className="small muted">
              A civic-intelligence platform for Nepal. We turn everyday problems into located, costed,
              implementable solutions — district by district.
            </p>
            <p className="tiny muted">
              Built on open data. Figures are published as indices with stated sources, not as
              measurements.
            </p>
          </div>

          <div>
            <h4>Explore</h4>
            <div className="footer-links">
              <Link to="/atlas">Problem Atlas</Link>
              <Link to="/districts">All 77 districts</Link>
              <Link to="/sectors">Nine sectors</Link>
              <Link to="/insights">Live insights</Link>
            </div>
          </div>

          <div>
            <h4>Participate</h4>
            <div className="footer-links">
              <Link to="/report">Report a problem</Link>
              <Link to="/ask">Ask Sakhi</Link>
              <Link to="/solutions">Solution library</Link>
              <Link to="/about">Methodology</Link>
            </div>
          </div>

          <div>
            <h4>Connect</h4>
            <div className="footer-links">
              <a href="https://data.gov.np" target="_blank" rel="noopener noreferrer">
                National statistics portal
              </a>
              <a href="https://dora.gov.np" target="_blank" rel="noopener noreferrer">
                Department of Roads
              </a>
              <a href="https://nea.gov.np" target="_blank" rel="noopener noreferrer">
                Nepal Electricity Authority
              </a>
              <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer">
                Get a Gemini API key
              </a>
            </div>
          </div>
        </div>

        <div className="footer-bottom">
          <span>© {new Date().getFullYear()} Nexa · Every day, smarter solutions.</span>
          <span className="row" style={{ gap: 10 }}>
            <span>Static-first · Works offline · No tracking</span>
            <span aria-hidden="true">·</span>
            <span className="row" style={{ gap: 5 }}>
              <span style={{ color: 'var(--crimson)' }}>🇳🇵</span> Nepal
            </span>
          </span>
        </div>
      </div>
    </footer>
  );
}