import { useEffect, type CSSProperties, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Icon, type IconName } from './Icon';
import { useReveal, useCountUp } from '@/hooks/useReveal';
import { useNexa } from '@/store/AppContext';
import { clamp, cx, grade } from '@/lib/utils';
import { Link } from 'react-router-dom';

/* ─────────────────────────────── Reveal ──────────────────────────────── */

type Dir = 'up' | 'down' | 'left' | 'right' | 'scale';

export function Reveal({
  children,
  dir = 'up',
  delay = 0,
  as: Tag = 'div',
  className,
  ...rest
}: {
  children: ReactNode;
  dir?: Dir;
  delay?: number;
  as?: 'div' | 'section' | 'li' | 'article' | 'span' | 'header';
  className?: string;
} & Record<string, unknown>) {
  const { ref, inView } = useReveal<HTMLDivElement>();
  return (
    <Tag
      ref={ref as never}
      className={cx('reveal', `from-${dir}`, inView && 'is-in', className)}
      style={{ transitionDelay: `${delay}ms` } as CSSProperties}
      {...rest}
    >
      {children}
    </Tag>
  );
}

/* ─────────────────────────────── Section ─────────────────────────────── */

export function Section({
  id,
  eyebrow,
  title,
  lede,
  children,
  action,
  tight,
}: {
  id?: string;
  eyebrow?: string;
  title?: ReactNode;
  lede?: ReactNode;
  action?: ReactNode;
  tight?: boolean;
  children?: ReactNode;
}) {
  return (
    <section id={id} className={cx('section', tight && 'section-tight')}>
      <div className="wrap">
        {(eyebrow || title) && (
          <Reveal className="sec-head">
            {eyebrow && <span className="eyebrow">{eyebrow}</span>}
            {title && <h2 className="h2 grad-ink">{title}</h2>}
            {lede && <p className="lede">{lede}</p>}
            {action}
          </Reveal>
        )}
        {children}
      </div>
    </section>
  );
}

/* ─────────────────────────────── Stat ────────────────────────────────── */

export function Stat({
  label,
  value,
  suffix,
  prefix,
  sub,
  decimals = 0,
  icon,
  animate = true,
  accent,
}: {
  label: string;
  value: number;
  suffix?: string;
  prefix?: string;
  sub?: string;
  decimals?: number;
  icon?: IconName;
  animate?: boolean;
  accent?: string;
}) {
  const { ref, inView } = useReveal<HTMLDivElement>(0.3);
  const v = useCountUp(value, inView && animate);
  const shown = decimals > 0 ? v.toFixed(decimals) : Math.round(v).toLocaleString('en-US');
  return (
    <div ref={ref} className="card card-tight card-hover">
      <div className="row-between" style={{ alignItems: 'flex-start' }}>
        <div className="stat">
          <span className="stat-label">{label}</span>
          <span className="stat-value" style={accent ? { color: accent } : undefined}>
            {prefix}
            {shown}
            {suffix && <span style={{ fontSize: '0.55em', marginLeft: 2 }}>{suffix}</span>}
          </span>
          {sub && <span className="tiny muted">{sub}</span>}
        </div>
        {icon && (
          <span
            className="badge"
            style={{ borderColor: 'transparent', background: 'var(--surface-2)', color: accent ?? 'var(--ink-3)' }}
          >
            <Icon name={icon} size={15} />
          </span>
        )}
      </div>
    </div>
  );
}

/* ─────────────────────────────── Bar ─────────────────────────────────── */

export function Bar({ value, max = 100, color, height }: { value: number; max?: number; color?: string; height?: number }) {
  const pctv = clamp((value / max) * 100);
  return (
    <div className="bar" style={height ? { height } : undefined} role="progressbar" aria-valuenow={Math.round(value)} aria-valuemin={0} aria-valuemax={max}>
      <i style={{ width: `${pctv}%`, background: color ?? 'var(--grad-crimson)' }} />
    </div>
  );
}

/* ──────────────────────────── Severity badge ─────────────────────────── */

export function SeverityBadge({ value, label }: { value: number; label?: string }) {
  const g = grade(value);
  return (
    <span className={cx('badge', `badge-${g.tone}`)}>
      <span className="dot" />
      {label ?? g.label}
    </span>
  );
}

/* ───────────────────────────── Sparkline ────────────────────────────── */

export function Sparkline({
  values,
  height = 44,
  color = 'var(--crimson)',
  fill = true,
  strokeWidth = 2,
}: {
  values: number[];
  height?: number;
  color?: string;
  fill?: boolean;
  strokeWidth?: number;
}) {
  if (values.length < 2) return null;
  const w = 100;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * w;
    const y = height - 4 - ((v - min) / span) * (height - 8);
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  });
  const id = `sp-${color.replace(/[^a-z]/gi, '')}-${values.length}`;
  return (
    <svg viewBox={`0 0 ${w} ${height}`} preserveAspectRatio="none" style={{ width: '100%', height }} aria-hidden="true">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.32" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {fill && <polygon points={`0,${height} ${pts.join(' ')} ${w},${height}`} fill={`url(#${id})`} />}
      <polyline
        points={pts.join(' ')}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
      <circle cx={pts[pts.length - 1]?.split(',')[0]} cy={pts[pts.length - 1]?.split(',')[1]} r="2.6" fill={color} />
    </svg>
  );
}

/* ───────────────────────────── Line chart ───────────────────────────── */

export function LineChart({
  points,
  height = 200,
  color = 'var(--crimson)',
  unit = '',
}: {
  points: { y: string | number; v: number; partial?: boolean }[];
  height?: number;
  color?: string;
  unit?: string;
}) {
  if (points.length < 2) return null;
  const pad = { t: 12, r: 8, b: 26, l: 44 };
  const w = 720;
  const h = height;
  const vs = points.map((p) => p.v);
  const rawMin = Math.min(...vs);
  const rawMax = Math.max(...vs);
  const pad2 = (rawMax - rawMin) * 0.14 || 1;
  const min = rawMin - pad2;
  const max = rawMax + pad2;
  const x = (i: number) => pad.l + (i / (points.length - 1)) * (w - pad.l - pad.r);
  const y = (v: number) => pad.t + (1 - (v - min) / (max - min)) * (h - pad.t - pad.b);

  const line = points.map((p, i) => `${x(i).toFixed(1)},${y(p.v).toFixed(1)}`).join(' ');
  const area = `${pad.l},${h - pad.b} ${line} ${w - pad.r},${h - pad.b}`;
  const ticks = 4;
  const gid = `lc-${color.replace(/[^a-z]/gi, '')}`;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ width: '100%', height: 'auto', overflow: 'visible' }} role="img">
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.34" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>

      {Array.from({ length: ticks + 1 }, (_, i) => {
        const v = min + ((max - min) / ticks) * i;
        const yy = y(v);
        return (
          <g key={i}>
            <line x1={pad.l} y1={yy} x2={w - pad.r} y2={yy} stroke="var(--line)" strokeWidth="1" strokeDasharray="3 4" />
            <text x={pad.l - 8} y={yy + 3.5} textAnchor="end" fontSize="10" fill="var(--ink-4)" className="mono">
              {formatTick(v)}
              {unit}
            </text>
          </g>
        );
      })}

      <polygon points={area} fill={`url(#${gid})`} />
      <polyline points={line} fill="none" stroke={color} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />

      {points.map((p, i) => (
        <g key={i}>
          <circle cx={x(i)} cy={y(p.v)} r={i === points.length - 1 ? 4.5 : 2.6} fill="var(--bg)" stroke={color} strokeWidth="2" />
          <text x={x(i)} y={h - 8} textAnchor="middle" fontSize="10" fill="var(--ink-4)" className="mono">
            {p.y}
          </text>
        </g>
      ))}
    </svg>
  );
}

function formatTick(v: number): string {
  if (Math.abs(v) >= 1000) return `${Math.round(v / 100) / 10}k`;
  return String(Math.round(v * 10) / 10);
}

/* ───────────────────────────── Bar chart ────────────────────────────── */

export function BarChart({
  data,
  height = 170,
  colorFor,
}: {
  data: { label: string; value: number; color?: string; sub?: string }[];
  height?: number;
  colorFor?: (d: { label: string; value: number }, i: number) => string;
}) {
  const max = Math.max(...data.map((d) => d.value)) || 1;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
      {data.map((d, i) => (
        <div key={d.label} className="stack" style={{ gap: 3 }}>
          <div className="row-between tiny">
            <span style={{ color: 'var(--ink-2)' }}>{d.label}</span>
            <span className="mono muted">{typeof d.value === 'number' ? d.value.toLocaleString() : d.value}</span>
          </div>
          <Bar value={d.value} max={max} color={d.color ?? colorFor?.(d, i) ?? 'var(--grad-crimson)'} height={height / 12} />
        </div>
      ))}
    </div>
  );
}

/* ─────────────────────────────── Modal ───────────────────────────────── */

export function Modal({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  subtitle?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;
  return createPortal(
    <div className="modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div
        className="modal"
        style={wide ? { width: 'min(1020px, 100%)' } : undefined}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="modal-head">
          <div className="stack" style={{ gap: 4 }}>
            <h3 className="h3">{title}</h3>
            {subtitle && <p className="small muted">{subtitle}</p>}
          </div>
          <button className="btn-icon" onClick={onClose} aria-label="Close dialog">
            <Icon name="close" size={16} />
          </button>
        </header>
        <div className="modal-body">{children}</div>
        {footer && <footer className="modal-foot">{footer}</footer>}
      </div>
    </div>,
    document.body,
  );
}

/* ────────────────────────────── Toasts ───────────────────────────────── */

export function ToastHost() {
  const { toasts, dismiss } = useNexa();
  const icon: Record<string, IconName> = { ok: 'check', warn: 'alert', err: 'alert', info: 'info' };
  return (
    <div className="toasts" aria-live="polite" aria-atomic="false">
      {toasts.map((t) => (
        <div key={t.id} className={cx('toast', t.kind)} onClick={() => dismiss(t.id)} role="status">
          <span style={{ marginTop: 2, color: 'var(--ink-3)' }}>
            <Icon name={icon[t.kind]} size={15} />
          </span>
          <span style={{ flex: 1 }}>{t.text}</span>
        </div>
      ))}
    </div>
  );
}

/* ───────────────────────────── Empty state ──────────────────────────── */

export function Empty({ icon = 'info', title, hint }: { icon?: IconName; title: string; hint?: string }) {
  return (
    <div className="empty a-in">
      <Icon name={icon} size={26} strokeWidth={1.4} />
      <strong>{title}</strong>
      {hint && <span className="tiny" style={{ maxWidth: '44ch' }}>{hint}</span>}
    </div>
  );
}

/* ──────────────────────────── Source note ───────────────────────────── */

export function SourceNote({ text, icon = 'file' }: { text: string; icon?: IconName }) {
  return (
    <p className="tiny muted row" style={{ gap: 6, alignItems: 'flex-start', lineHeight: 1.5 }}>
      <span style={{ marginTop: 1, flexShrink: 0 }}>
        <Icon name={icon} size={12} />
      </span>
      <span>{text}</span>
    </p>
  );
}

/* ───────────────────────────── Link button ──────────────────────────── */

export function ActionLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link className="btn btn-ghost btn-sm" to={to}>
      {children}
      <Icon name="arrowRight" size={14} />
    </Link>
  );
}