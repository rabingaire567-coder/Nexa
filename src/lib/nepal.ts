import raw from '@/data/districts.json';
import national from '@/data/national.json';
import sectorRaw from '@/data/sectors.json';
import cityRaw from '@/data/cities.json';
import type { CitiesFile, District, DistrictsFile, NationalFile, Province, Sector, SectorId, SectorsFile, City } from '@/types';

export const geo = raw as unknown as DistrictsFile;
export const sectorsFile = sectorRaw as unknown as SectorsFile;
export const citiesFile = cityRaw as unknown as CitiesFile;
export const nationalFile = national as unknown as NationalFile;

export const districts: District[] = geo.districts;
export const provinces: Province[] = geo.provinces;
export const sectors: Sector[] = sectorsFile.sectors;
export const cities: City[] = citiesFile.cities;

export const SECTOR_IDS = sectors.map((s) => s.id) as SectorId[];

export const provinceById = new Map(provinces.map((p) => [p.id, p]));
export const districtById = new Map(districts.map((d) => [d.id, d]));
export const cityById = new Map(cities.map((c) => [c.id, c]));
export const sectorById = new Map(sectors.map((s) => [s.id, s]));

export const BELT_LABEL: Record<District['belt'], string> = {
  terai: 'Terai',
  hill: 'Hill',
  mountain: 'Mountain',
};

/** Human-readable tags used on district cards. */
export const TAG_LABEL: Record<string, string> = {
  agri: 'Agriculture',
  cardamom: 'Cardamom',
  tea: 'Tea',
  apple: 'Apple orchards',
  border: 'Border district',
  industrial: 'Industrial belt',
  metro: 'Metropolitan',
  capital: 'Federal capital',
  city: 'Regional centre',
  tourist: 'Tourism hub',
  heritage: 'Heritage',
  trek: 'Trekking gateway',
  conservation: 'Protected area',
  airport: 'Airport',
  hydro: 'Hydropower',
  glof: 'GLOF risk',
  floodplain: 'Flood plain',
  corridor: 'Highway corridor',
  remote: 'Hard-to-reach',
  dry: 'Rain-shadow, drought-prone',
  seismic: 'High seismic hazard',
  landslide: 'Landslide-prone',
  valley: 'Kathmandu Valley',
  'bp-highway': 'BP Highway',
  'kanti-highway': 'Kanti Highway',
  'araniko-highway': 'Araniko Highway',
  'midhill-corridor': 'Mid-Hill Highway',
  'mechi-corridor': 'Mechi Highway',
  koshi: 'Koshi basin',
  bagmati: 'Bagmati basin',
  gandaki: 'Gandaki basin',
  karnali: 'Karnali basin',
  kaligandaki: 'Kali Gandaki gorge',
  everest: 'Everest gateway',
};

const BELT_BASE: Record<SectorId, Record<District['belt'], number>> = {
  air: { terai: 66, hill: 58, mountain: 24 },
  traffic: { terai: 52, hill: 50, mountain: 20 },
  flood: { terai: 78, hill: 62, mountain: 58 },
  waste: { terai: 62, hill: 60, mountain: 22 },
  water: { terai: 66, hill: 66, mountain: 34 },
  energy: { terai: 64, hill: 60, mountain: 44 },
  health: { terai: 66, hill: 66, mountain: 52 },
  agri: { terai: 58, hill: 64, mountain: 62 },
  connect: { terai: 62, hill: 64, mountain: 70 },
};

/**
 * Nexa Composite Severity.
 *
 * Reproducible on purpose: base severity per ecological belt, nudged by the
 * district's urbanisation index and by the hazards its tags declare. Published
 * as an index, not a measurement — every input is public and auditable.
 */
export function severityOf(d: District, sector: SectorId): number {
  const base = BELT_BASE[sector][d.belt];
  let v = base + (d.urb - 35) * 0.34;

  const tagBoost: Partial<Record<SectorId, string[]>> = {
    air: ['industrial', 'metro', 'capital'],
    traffic: ['metro', 'capital', 'corridor', 'industrial'],
    flood: ['floodplain', 'koshi', 'bagmati', 'gandaki', 'karnali', 'glof'],
    waste: ['metro', 'capital', 'industrial'],
    water: ['floodplain', 'metro', 'capital', 'dry'],
    energy: ['industrial', 'metro', 'capital', 'remote', 'hydro'],
    health: ['remote', 'landslide', 'glof', 'mountain-corridor'],
    agri: ['agri', 'dry', 'valley'],
    connect: ['remote', 'landslide', 'corridor'],
  };
  for (const t of tagBoost[sector] ?? []) {
    if (d.tags.includes(t)) v += 6;
  }
  // Every mountain district carries extra clinical-access friction.
  if (sector === 'health' && d.belt === 'mountain') v += 4;
  if (sector === 'connect' && d.belt === 'mountain') v += 4;
  return Math.max(2, Math.min(100, Math.round(v)));
}

export interface DistrictProfile {
  district: District;
  province: Province;
  severity: Record<SectorId, number>;
  composite: number;
  topSector: Sector;
  topCity?: City;
}

export function profileOf(id: string): DistrictProfile | undefined {
  const district = districtById.get(id);
  if (!district) return undefined;
  const province = provinceById.get(district.prov)!;
  const severity = {} as Record<SectorId, number>;
  for (const s of SECTOR_IDS) severity[s] = severityOf(district, s);
  const composite = Math.round(SECTORS.reduce((acc, id) => acc + severity[id], 0) / SECTORS.length);
  const topSector = sectorById.get((SECTORS.slice().sort((a, b) => severity[b] - severity[a])[0] ?? 'air') as SectorId)!;
  const topCity = cities.find((c) => c.district === id);
  return { district, province, severity, composite, topSector, topCity };
}

export const SECTORS: SectorId[] = SECTOR_IDS;

export function searchNepal(query: string, limit = 12) {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const out: { kind: 'district' | 'city'; id: string; label: string; sub: string }[] = [];
  for (const d of districts) {
    const hay = `${d.name} ${d.ne} ${d.hq} ${d.hqNe} ${d.tags.join(' ')}`.toLowerCase();
    if (hay.includes(q)) {
      out.push({ kind: 'district', id: d.id, label: d.name, sub: `${d.hq} · ${d.ne}` });
    }
  }
  for (const c of cities) {
    const hay = `${c.name} ${c.ne} ${c.blurb} ${c.landmarks.join(' ')}`.toLowerCase();
    if (hay.includes(q)) {
      out.push({ kind: 'city', id: c.id, label: c.name, sub: c.blurb.slice(0, 64) + '…' });
    }
  }
  return out.slice(0, limit);
}

const NEPALI_DIGITS = ['०', '१', '२', '३', '४', '५', '६', '७', '८', '९'];

/** Converts ASCII digits to Devanagari. Used across the Nepali-first surfaces. */
export function toNepali(input: string | number): string {
  return String(input).replace(/[0-9]/g, (d) => NEPALI_DIGITS[Number(d)]);
}

export const hasNepali = (s: string) => /[ऀ-ॿ]/.test(s);
