export function cx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(' ');
}

const nf = new Intl.NumberFormat('en-US');

export function num(v: number): string {
  return nf.format(Math.round(v));
}

export function compact(v: number): string {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(v >= 10_000_000 ? 1 : 2)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(v >= 10_000 ? 0 : 1)}K`;
  return String(Math.round(v));
}

export function pct(v: number, digits = 0): string {
  return `${(v * 100).toFixed(digits)}%`;
}

export function clamp(v: number, lo = 0, hi = 100): number {
  return Math.min(hi, Math.max(lo, v));
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function uid(prefix = 'n'): string {
  const rand = Math.random().toString(36).slice(2, 9);
  return `${prefix}_${Date.now().toString(36)}_${rand}`;
}

export function timeAgo(ts: number): string {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  return new Date(ts).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function dateLabel(ts: number): string {
  return new Date(ts).toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function debounce<A extends unknown[]>(fn: (...args: A) => void, ms: number) {
  let t: ReturnType<typeof setTimeout> | undefined;
  return (...args: A) => {
    if (t) clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

/** Severity 0–100 → a label and colour ramp shared by every surface. */
export function grade(v: number): { label: string; color: string; tone: 'low' | 'mid' | 'high' | 'crit' } {
  if (v >= 80) return { label: 'Critical', color: '#ef4444', tone: 'crit' };
  if (v >= 62) return { label: 'High', color: '#f97362', tone: 'high' };
  if (v >= 40) return { label: 'Moderate', color: '#f5a524', tone: 'mid' };
  return { label: 'Low', color: '#34d399', tone: 'low' };
}

/** Deterministic pseudo-random in [0,1) from a string seed — stable across reloads. */
export function seeded(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 100000) / 100000;
}

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

/** Minimal, safe markdown → HTML for AI responses (bold, italics, code, lists, headings). */
export function renderMarkdown(src: string): string {
  const esc = escapeHtml(src);
  const blocks = esc.split(/\n{2,}/);
  const inline = (s: string) =>
    s
      .replace(/`([^`\n]+)`/g, '<code>$1</code>')
      .replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>')
      .replace(/(^|[\s(])\*([^*\n]+)\*/g, '$1<em>$2</em>')
      .replace(/\[([^\]\n]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');

  return blocks
    .map((block) => {
      const lines = block.split('\n');
      const isList = lines.every((l) => /^\s*[-*]\s+/.test(l));
      const isNum = lines.every((l) => /^\s*\d+[.)]\s+/.test(l));
      if (isList) return `<ul>${lines.map((l) => `<li>${inline(l.replace(/^\s*[-*]\s+/, ''))}</li>`).join('')}</ul>`;
      if (isNum) return `<ol>${lines.map((l) => `<li>${inline(l.replace(/^\s*\d+[.)]\s+/, ''))}</li>`).join('')}</ol>`;
      if (/^###\s+/.test(block)) return `<h4>${inline(block.replace(/^###\s+/, ''))}</h4>`;
      if (/^##\s+/.test(block)) return `<h3>${inline(block.replace(/^##\s+/, ''))}</h3>`;
      if (/^#{1,2}\s+/.test(block)) return `<h3>${inline(block.replace(/^#{1,2}\s+/, ''))}</h3>`;
      return `<p>${inline(block).replace(/\n/g, '<br/>')}</p>`;
    })
    .join('');
}
