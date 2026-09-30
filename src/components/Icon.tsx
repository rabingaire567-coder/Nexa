import type { SVGProps } from 'react';

/**
 * Inline icon set. Every glyph is a 24×24 stroke path so icons inherit
 * `currentColor`, scale with `font-size`, and cost no network requests.
 */

export type IconName =
  | 'home'
  | 'map'
  | 'flag'
  | 'sparkle'
  | 'bulb'
  | 'plus'
  | 'send'
  | 'search'
  | 'close'
  | 'menu'
  | 'chevronDown'
  | 'chevronRight'
  | 'arrowRight'
  | 'arrowUpRight'
  | 'check'
  | 'alert'
  | 'info'
  | 'sun'
  | 'moon'
  | 'globe'
  | 'trash'
  | 'copy'
  | 'refresh'
  | 'download'
  | 'key'
  | 'settings'
  | 'filter'
  | 'layers'
  | 'droplet'
  | 'wind'
  | 'trash2'
  | 'zap'
  | 'heart'
  | 'leaf'
  | 'wifi'
  | 'car'
  | 'cloudRain'
  | 'cloud'
  | 'mountain'
  | 'cpu'
  | 'shield'
  | 'clock'
  | 'trendUp'
  | 'trendDown'
  | 'target'
  | 'book'
  | 'phone'
  | 'pin'
  | 'users'
  | 'file'
  | 'external';

const P: Record<IconName, string> = {
  home: 'M3 10.6 12 3l9 7.6M5.4 9.3V20a1 1 0 0 0 1 1h3.3v-5.6h4.6V21h3.3a1 1 0 0 0 1-1V9.3',
  map: 'M9 3 3 5.4v15.2L9 18l6 2.4 6-2.4V3l-6 2.4L9 3Zm0 0v15.2m6-12.8v15.2',
  flag: 'M5 21V4m0 0h11.5l-2 3.8 2 3.8H5',
  sparkle: 'M12 3.2 13.7 9l5.8 1.7-5.8 1.7L12 18.2 10.3 12.4 4.5 10.7 10.3 9 12 3.2ZM19 3v3M20.5 4.5h-3M5.5 16v3M7 17.5H4',
  bulb: 'M9.2 17.5h5.6M10 21h4M12 3a6 6 0 0 0-3.6 10.8c.6.5 1 1.2 1.1 2h5c.1-.8.5-1.5 1.1-2A6 6 0 0 0 12 3Z',
  plus: 'M12 5v14M5 12h14',
  send: 'M21.5 3.5 10.8 14.2M21.5 3.5l-6.8 17-3.9-6.3-6.3-3.9 17-6.8Z',
  search: 'M11 18.5a7.5 7.5 0 1 0 0-15 7.5 7.5 0 0 0 0 15ZM20.5 20.5 16 16',
  close: 'M6 6l12 12M18 6 6 18',
  menu: 'M4 7h16M4 12h16M4 17h16',
  chevronDown: 'm6 9.5 6 6 6-6',
  chevronRight: 'm9.5 6 6 6-6 6',
  arrowRight: 'M4 12h16m-6-6 6 6-6 6',
  arrowUpRight: 'M7 17 17 7M8 7h9v9',
  check: 'm4.5 12.5 5 5 10-11',
  alert: 'M12 8.5v5m0 3.2v.1M10.3 3.9 2.6 17.2A2 2 0 0 0 4.3 20.2h15.4a2 2 0 0 0 1.7-3l-7.7-13.3a2 2 0 0 0-3.4 0Z',
  info: 'M12 11v5.5m0-8.6v.1M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z',
  sun: 'M12 16.5a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9ZM12 2v2.2M12 19.8V22M4.2 4.2l1.6 1.6M18.2 18.2l1.6 1.6M2 12h2.2M19.8 12H22M4.2 19.8l1.6-1.6M18.2 5.8l1.6-1.6',
  moon: 'M20.5 14.2A8.5 8.5 0 0 1 9.8 3.5a8.5 8.5 0 1 0 10.7 10.7Z',
  globe: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM3.2 9.5h17.6M3.2 14.5h17.6M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18',
  trash: 'M4.5 7h15M9.5 7V5.2A1.2 1.2 0 0 1 10.7 4h2.6a1.2 1.2 0 0 1 1.2 1.2V7m3 0-.8 12.1a1.2 1.2 0 0 1-1.2 1.1H7.9a1.2 1.2 0 0 1-1.2-1.1L6 7m3.5 4v6m5-6v6',
  copy: 'M9 9.5A1.5 1.5 0 0 1 10.5 8h8A1.5 1.5 0 0 1 20 9.5v8a1.5 1.5 0 0 1-1.5 1.5h-8A1.5 1.5 0 0 1 9 17.5v-8ZM15.5 8V6.5A1.5 1.5 0 0 0 14 5H6a1.5 1.5 0 0 0-1.5 1.5v8A1.5 1.5 0 0 0 6 16h1.5',
  refresh: 'M20 12a8 8 0 1 1-2.6-5.9M20 3.5V9h-5.5',
  download: 'M12 3.5v11m0 0 4.2-4.2M12 14.5 7.8 10.3M4.5 17v2.5h15V17',
  key: 'M14.5 9.5a4.5 4.5 0 1 0-4.2 4.5L4 20.3v1.2h2.8v-2h2v-2h2l2-2a4.5 4.5 0 0 0 3.7-6Zm0 0h.01',
  settings:
    'M12 15.2a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4Zm8-3.2a8 8 0 0 0-.1-1.2l2-1.5-2-3.4-2.3 1a8 8 0 0 0-2-1.2l-.3-2.5h-3.9l-.3 2.5a8 8 0 0 0-2 1.2l-2.3-1-2 3.4 2 1.5a8 8 0 0 0 0 2.4l-2 1.5 2 3.4 2.3-1a8 8 0 0 0 2 1.2l.3 2.5h3.9l.3-2.5a8 8 0 0 0 2-1.2l2.3 1 2-3.4-2-1.5c.1-.4.1-.8.1-1.2Z',
  filter: 'M3.5 5.5h17l-6.5 7.6v5.6l-4 2.2v-7.8L3.5 5.5Z',
  layers: 'm12 3 8.5 4.6L12 12.2 3.5 7.6 12 3Zm8.5 9.2L12 16.8 3.5 12.2m17 4.4L12 21.2 3.5 16.6',
  droplet: 'M12 3.2c3 3.4 6 6.5 6 9.6a6 6 0 0 1-12 0c0-3.1 3-6.2 6-9.6ZM9 14a3 3 0 0 0 3 3',
  wind: 'M3.5 8.5h9a2.8 2.8 0 1 0-2.8-2.8M3.5 12.5h13a2.8 2.8 0 1 1-2.8 2.8M3.5 16.5h6.5',
  trash2: 'M4.5 7h15M9.5 7V5.2A1.2 1.2 0 0 1 10.7 4h2.6a1.2 1.2 0 0 1 1.2 1.2V7m3 0-.8 12.1a1.2 1.2 0 0 1-1.2 1.1H7.9a1.2 1.2 0 0 1-1.2-1.1L6 7m3.5 4v6m5-6v6M10 11v6m4-6v6',
  zap: 'M13.5 3 5.5 13.2h5.2L10 21l8.5-10.4h-5.4L13.5 3Z',
  heart: 'M12 20s-7.5-4.4-7.5-9.3A4.2 4.2 0 0 1 12 7.9a4.2 4.2 0 0 1 7.5 2.8C19.5 15.6 12 20 12 20Z',
  leaf: 'M20 4C10.5 4 5 8.5 5 14.5c0 1.6.4 3 1.2 4.2M20 4c0 9-4.5 12.5-9.5 12.5-1 0-2-.2-2.9-.5M11 15 6 10m5 5c1.5-3.5 4-6 7.5-7.5',
  wifi: 'M2.5 9.2a14 14 0 0 1 19 0M6 13a9 9 0 0 1 12 0M9.5 16.6a4.4 4.4 0 0 1 5 0M12 20.2v.1',
  car: 'M4 15.5h16M5.5 15.5 7 8.6h10l1.5 6.9M4.5 15.5V19h2.6v-3.5m9.4 0V19H19v-3.5M8 12.5h8',
  cloudRain: 'M7 15.5A4 4 0 0 1 7.2 7.6a5.2 5.2 0 0 1 9.9 1.3A3.7 3.7 0 0 1 17 15.5M9 18.5l-.8 2.2m4-2.2-.8 2.2m4-2.2-.8 2.2',
  cloud: 'M7 18.5A4.2 4.2 0 0 1 7.2 10a5.2 5.2 0 0 1 9.9 1.3A3.7 3.7 0 0 1 17 18.5',
  mountain: 'm2.5 19.5 6.2-11 4 6.2 2.3-3.4 6.5 8.2M8.7 8.5 10 6l1.3 2.5',
  cpu: 'M7.5 7.5h9v9h-9v-9Zm-3.5 3v3m3-3v3m10-3v3m-3-3v3m-7 3v3m3-3v3m7-3v3m-3-3v3M9.5 4.5v3m5-3v3m-5 9v3m5-3v3M3 9.5h3m-3 5h3m12-5h3m-3 5h3',
  shield: 'M12 3.5 5 6.2v5.3c0 4.3 2.9 8.2 7 9.3 4.1-1.1 7-5 7-9.3V6.2L12 3.5Zm-2.6 8.4 2 2 3.6-3.9',
  clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM12 7v5.3l3.3 2',
  trendUp: 'm3.5 16.5 5.5-5.5 3.5 3.5 7-7m0 0H14m5.5 0v5.5',
  trendDown: 'm3.5 7.5 5.5 5.5 3.5-3.5 7 7m0 0H14m5.5 0V11',
  target: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0-4.2a4.8 4.8 0 1 0 0-9.6 4.8 4.8 0 0 0 0 9.6ZM12 13.2a1.2 1.2 0 1 0 0-2.4 1.2 1.2 0 0 0 0 2.4Z',
  book: 'M4.5 5.2A1.7 1.7 0 0 1 6.2 3.5H11v17H6.2a1.7 1.7 0 0 1-1.7-1.7V5.2Zm15 0a1.7 1.7 0 0 0-1.7-1.7H13v17h4.8a1.7 1.7 0 0 0 1.7-1.7V5.2Z',
  phone: 'M6.4 3.5h3l1.5 4-2 1.4a12 12 0 0 0 5.2 5.2l1.4-2 4 1.5v3a2 2 0 0 1-2.2 2A17 17 0 0 1 4.4 5.7a2 2 0 0 1 2-2.2Z',
  pin: 'M12 21s6.5-6 6.5-10.5a6.5 6.5 0 1 0-13 0C5.5 15 12 21 12 21Zm0-8.2a2.4 2.4 0 1 0 0-4.8 2.4 2.4 0 0 0 0 4.8Z',
  users: 'M16 20v-1.8a3.7 3.7 0 0 0-3.7-3.7H6.7A3.7 3.7 0 0 0 3 18.2V20M9.5 10.8a3.4 3.4 0 1 0 0-6.8 3.4 3.4 0 0 0 0 6.8ZM21 20v-1.8a3.7 3.7 0 0 0-2.8-3.6M15.5 4.2a3.4 3.4 0 0 1 0 6.6',
  file: 'M14 3.5H6.5a1.5 1.5 0 0 0-1.5 1.5v14a1.5 1.5 0 0 0 1.5 1.5h11a1.5 1.5 0 0 0 1.5-1.5V8.5L14 3.5Zm0 0v5h5M9 13h6M9 16.5h6',
  external: 'M14 4.5h5.5V10M19.5 4.5 11 13M18 14v5.5H4.5V6H10',
};

interface IconProps extends Omit<SVGProps<SVGSVGElement>, 'name'> {
  name: IconName;
  size?: number;
}

export function Icon({ name, size = 18, strokeWidth = 1.7, ...rest }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      <path d={P[name]} />
    </svg>
  );
}

/** Maps a sector id onto its icon. */
export const SECTOR_ICON: Record<string, IconName> = {
  air: 'wind',
  traffic: 'car',
  flood: 'droplet',
  waste: 'trash2',
  water: 'droplet',
  energy: 'zap',
  health: 'heart',
  agri: 'leaf',
  connect: 'wifi',
};