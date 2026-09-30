import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MAP_H, MAP_W, borderPath, point, riverPaths } from '@/data/nepalGeo';
import { cities, districts, severityOf, provinceById } from '@/lib/nepal';
import type { SectorId } from '@/types';
import { SECTOR_ICON, Icon } from './Icon';
import { grade } from '@/lib/utils';

const HIGHLIGHTED = ['kathmandu', 'lalitpur', 'bhaktapur', 'kaski', 'pokhara', 'chitwan', 'morang', 'rupandehi', 'banke', 'kailali', 'jhapa', 'sunsari', 'sindhupalchowk', 'khotang', 'sindhu', 'darchula', 'mugu', 'dolpa', 'jumla', 'karnali', 'salyan', 'palyu', 'bajura', 'doti', 'baitadi'];

const RAMP = ['#34d399', '#a3e635', '#f5a524', '#f97362', '#ef4444'];

function rampColor(v: number): string {
  const g = grade(v);
  return RAMP[Math.min(RAMP.length - 1, Math.max(0, ['low', 'mid', 'high', 'crit'].indexOf(g.tone)))];
}

interface Props {
  sector?: SectorId | 'composite';
  onSelect?: (districtId: string) => void;
  compact?: boolean;
  showLabels?: boolean;
}

export function NepalMap({ sector = 'composite', onSelect, compact = false, showLabels = true }: Props) {
  const nav = useNavigate();
  const [hover, setHover] = useState<string | null>(null);

  const border = useMemo(() => borderPath(), []);
  const rivers = useMemo(() => riverPaths(), []);

  const value = (districtId: string): number => {
    const d = districts.find((x) => x.id === districtId);
    if (!d) return 0;
    if (sector === 'composite') {
      const ids: SectorId[] = ['air', 'traffic', 'flood', 'waste', 'water', 'energy', 'health', 'agri', 'connect'];
      return Math.round(ids.reduce((a, s) => a + severityOf(d, s), 0) / ids.length);
    }
    return severityOf(d, sector);
  };

  const active = hover ? districts.find((d) => d.id === hover) : null;
  const activePoint = active ? point(active.lon, active.lat) : null;

  const topProvinces = useMemo(() => {
    const agg = new Map<string, number[]>();
    for (const d of districts) {
      if (!agg.has(d.prov)) agg.set(d.prov, []);
      agg.get(d.prov)!.push(value(d.id));
    }
    return agg;
  }, [sector]);

  return (
    <div className="stack" style={{ gap: '0.9rem' }}>
      <div className="map-shell">
        <svg className="map-svg" viewBox={`0 0 ${MAP_W} ${MAP_H}`} role="img" aria-label={`Map of Nepal showing ${sector === 'composite' ? 'composite severity' : `${sector} severity`} by district`}>
          <defs>
            <linearGradient id="nepal-fill" x1="0" y1="0" x2="0.4" y2="1">
              <stop offset="0%" stopColor="var(--surface-2)" />
              <stop offset="100%" stopColor="var(--surface)" />
            </linearGradient>
            <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="3" result="b" />
              <feMerge>
                <feMergeNode in="b" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* National outline */}
          <path d={border} fill="url(#nepal-fill)" stroke="var(--line-2)" strokeWidth="1.2" strokeLinejoin="round" />

          {/* Province tint bands */}
          {Array.from(topProvinces.entries()).map(([prov]) => {
            const p = provinceById.get(prov);
            if (!p) return null;
            const ds = districts.filter((d) => d.prov === prov);
            const avg = ds.reduce((a, d) => a + value(d.id), 0) / ds.length;
            const cx = ds.reduce((a, d) => a + point(d.lon, d.lat).x, 0) / ds.length;
            const cy = ds.reduce((a, d) => a + point(d.lon, d.lat).y, 0) / ds.length;
            return (
              <circle
                key={prov}
                cx={cx}
                cy={cy}
                r={compact ? 26 : 34}
                fill={rampColor(avg)}
                opacity="0.05"
                className="breathe"
              />
            );
          })}

          {/* Rivers */}
          {rivers.map((r) => (
            <path key={r.id} d={r.d} fill="none" stroke="var(--glacier)" strokeWidth="0.9" opacity="0.3" strokeLinecap="round" />
          ))}

          {/* District markers */}
          {districts.map((d) => {
            const { x, y } = point(d.lon, d.lat);
            const v = value(d.id);
            const isHot = HIGHLIGHTED.includes(d.id);
            const isHover = hover === d.id;
            const r = isHover ? 5.4 : isHot ? 3.4 : 2.4;
            return (
              <g key={d.id}>
                {isHover && <circle cx={x} cy={y} r={r + 5} fill={rampColor(v)} opacity="0.18" className="district-dot" />}
                <circle
                  cx={x}
                  cy={y}
                  r={r}
                  fill={rampColor(v)}
                  opacity={isHot || isHover ? 0.95 : 0.62}
                  stroke={isHover ? 'var(--ink)' : 'transparent'}
                  strokeWidth={isHover ? 1.4 : 0}
                  filter={isHover ? 'url(#glow)' : undefined}
                  className="district-dot"
                  onMouseEnter={() => setHover(d.id)}
                  onMouseLeave={() => setHover(null)}
                  onClick={() => (onSelect ? onSelect(d.id) : nav(`/districts/${d.id}`))}
                  style={{ cursor: 'pointer' }}
                />
                <circle
                  cx={x}
                  cy={y}
                  r={compact ? 7 : 10}
                  fill="transparent"
                  className="district-hit"
                  onMouseEnter={() => setHover(d.id)}
                  onMouseLeave={() => setHover(null)}
                  onClick={() => (onSelect ? onSelect(d.id) : nav(`/districts/${d.id}`))}
                />
                {showLabels && !compact && (isHot || isHover) && (
                  <text x={x} y={y - 8} textAnchor="middle" className="map-label">
                    {d.name}
                  </text>
                )}
              </g>
            );
          })}

          {/* City markers */}
          {!compact &&
            cities.map((c) => {
              const { x, y } = point(c.lon, c.lat);
              return (
                <g key={c.id} onClick={() => nav(`/districts/${c.district}`)} style={{ cursor: 'pointer' }}>
                  <rect x={x - 1.6} y={y - 1.6} width="3.2" height="3.2" fill="var(--ink)" transform={`rotate(45 ${x} ${y})`} opacity="0.8" />
                  <text x={x + 5} y={y + 3} className="map-label" style={{ fontSize: '5.4px' }}>
                    {c.name}
                  </text>
                </g>
              );
            })}

          {!compact &&
            rivers.map((r) => {
              const mid = r.d.split('C')[1]?.split(' ')[0];
              if (!mid) return null;
              const [mx, my] = mid.split(',').map(Number);
              return (
                <text key={r.id} x={mx} y={my} className="river-label" textAnchor="middle">
                  {r.name}
                </text>
              );
            })}

          {active && activePoint && (
            <circle cx={activePoint.x} cy={activePoint.y} r="14" fill="none" stroke="var(--crimson)" strokeWidth="1.2" opacity="0.5">
              <animate attributeName="r" values="10;16;10" dur="2.4s" repeatCount="indefinite" />
              <animate attributeName="opacity" values="0.55;0.12;0.55" dur="2.4s" repeatCount="indefinite" />
            </circle>
          )}
        </svg>

        {active && activePoint && (
          <div
            className="map-tip"
            style={{
              left: `${(activePoint.x / MAP_W) * 100}%`,
              top: `${(activePoint.y / MAP_H) * 100}%`,
            }}
          >
            <div className="row-between" style={{ gap: 8 }}>
              <strong>{active.name}</strong>
              <span className="badge" style={{ padding: '1px 6px' }}>
                {active.belt}
              </span>
            </div>
            <div className="tiny muted" style={{ marginTop: 2 }}>
              HQ {active.hq} · pop {(active.pop / 1000).toFixed(0)}k
            </div>
            <div className="row-between tiny" style={{ marginTop: 4, gap: 8 }}>
              <span className="muted">
                {sector === 'composite' ? 'Composite' : sector} index
              </span>
              <span className="mono" style={{ color: rampColor(value(active.id)), fontWeight: 700 }}>
                {value(active.id)}
              </span>
            </div>
          </div>
        )}
      </div>

      <div className="map-legend">
        {['low', 'mid', 'high', 'crit'].map((t, i) => (
          <span className="legend-item" key={t}>
            <span className="legend-swatch" style={{ background: RAMP[i] }} />
            {grade([20, 45, 68, 88][i]).label}
          </span>
        ))}
        <span className="legend-item" style={{ marginLeft: 'auto' }}>
          <Icon name="pin" size={12} /> {compact ? 'district' : 'city'} markers
        </span>
      </div>
    </div>
  );
}

export const SECTOR_ACCENT: Record<string, string> = {
  air: '#a78bfa',
  traffic: '#f5a524',
  flood: '#38bdf8',
  waste: '#f97362',
  water: '#2dd4bf',
  energy: '#ffd166',
  health: '#34d399',
  agri: '#84cc16',
  connect: '#ff3d63',
};

export { SECTOR_ICON };