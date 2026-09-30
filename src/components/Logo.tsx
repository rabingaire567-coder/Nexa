interface LogoProps {
  size?: number;
  className?: string;
  withWordmark?: boolean;
}

/**
 * The Nexa mark: Nepal's double-pennon silhouette abstracted into two strokes
 * that also read as an "N". Rendered as SVG so it stays crisp and inherits
 * the theme's gradient tokens.
 */
export function Logo({ size = 30, className, withWordmark = true }: LogoProps) {
  return (
    <span className={`brand${className ? ` ${className}` : ''}`}>
      <svg className="brand-mark" viewBox="0 0 40 40" width={size} height={size} aria-hidden="true">
        <defs>
          <linearGradient id="nexa-mark" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#ff3d63" />
            <stop offset="55%" stopColor="#d81e46" />
            <stop offset="100%" stopColor="#2a5bd7" />
          </linearGradient>
        </defs>
        <rect x="1" y="1" width="38" height="38" rx="11" fill="url(#nexa-mark)" />
        <path
          d="M11.4 28.6V11.4l8.2 10.1 8.2-10.1v17.2"
          fill="none"
          stroke="#fff"
          strokeWidth="3.1"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="28" cy="12.2" r="2.5" fill="#ffd166" />
      </svg>
      {withWordmark && (
        <span className="brand-word">
          Nexa<span className="grad-crimson">.</span>
        </span>
      )}
    </span>
  );
}

/** Compact monochrome variant for the footer and favicon-scale use. */
export function LogoGlyph({ size = 22 }: { size?: number }) {
  return (
    <svg viewBox="0 0 40 40" width={size} height={size} aria-hidden="true">
      <rect x="1" y="1" width="38" height="38" rx="11" fill="url(#nexa-mark-f)" />
      <defs>
        <linearGradient id="nexa-mark-f" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#ff3d63" />
          <stop offset="100%" stopColor="#2a5bd7" />
        </linearGradient>
      </defs>
      <path d="M11.4 28.6V11.4l8.2 10.1 8.2-10.1v17.2" fill="none" stroke="#fff" strokeWidth="3.1" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}