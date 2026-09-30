export type Belt = 'terai' | 'hill' | 'mountain';

export type SectorId =
  | 'air'
  | 'traffic'
  | 'flood'
  | 'waste'
  | 'water'
  | 'energy'
  | 'health'
  | 'agri'
  | 'connect';

export interface Province {
  id: string;
  name: string;
  ne: string;
  capital: string;
  capitalNe: string;
  districts: number;
  area: number;
  pop: number;
}

export interface District {
  id: string;
  name: string;
  ne: string;
  prov: string;
  hq: string;
  hqNe: string;
  area: number;
  pop: number;
  lat: number;
  lon: number;
  alt: number;
  belt: Belt;
  /** Urbanisation index, 0–100. Drives the Nexa composite severity model. */
  urb: number;
  tags: string[];
}

export type CityType = 'capital' | 'metro' | 'submetro' | 'city' | 'town';

export interface City {
  id: string;
  name: string;
  ne: string;
  district: string;
  prov: string;
  type: CityType;
  lat: number;
  lon: number;
  alt: number;
  pop: number;
  blurb: string;
  air: { pm25: number; aqi: number; worst: string; trend: string };
  traffic: { congestion: number; peakHours: string; avgSpeedKmph: number; ringRoad: string | boolean };
  waste: { tpd: number; recycled: number; landfill: string; openBurning: boolean };
  water: { floodProne: string[]; drainAge: string };
  energy: { peakLoadMW: number; outageHours: number; importShare: number; hydroSeason: string };
  health: { tertiaryHospitals: number; phcReach30min: number; doctorsPer100k: number };
  connect: { internet: number; mobile: number; digitalLiteracy: number };
  landmarks: string[];
  airport: string | null;
  ringRoad: boolean;
  universities: number;
}

export interface Solution {
  title: string;
  lever: string;
  horizon: string;
  /** 0–100 modelled impact on the sector. */
  impact: number;
  cost: 'Low' | 'Medium' | 'High' | 'Very high';
  effort: 'Low' | 'Medium' | 'High';
  how: string;
}

export interface Sector {
  id: SectorId;
  name: string;
  ne: string;
  icon: string;
  accent: string;
  severity: number;
  headline: string;
  problem: string;
  mechanism: string[];
  anchor: { value: number; unit: string; label: string; target: number; targetLabel: string };
  signals: string[];
  solutions: Solution[];
}

export interface SeriesPoint {
  y: string | number;
  v: number;
  partial?: boolean;
}

export interface Series {
  label: string;
  unit: string;
  points: SeriesPoint[];
  source: string;
}

export interface DistrictMeta {
  source: string;
  districts: number;
  provinces: number;
  note: string;
}

export interface CityMeta {
  source: string;
  note: string;
}

export interface SectorMeta {
  note: string;
  severity: string;
}

export interface DistrictsFile {
  $meta: DistrictMeta;
  provinces: Province[];
  districts: District[];
}

export interface CitiesFile {
  $meta: CityMeta;
  cities: City[];
}

export interface SectorsFile {
  $meta: SectorMeta;
  sectors: Sector[];
}

export interface NationalFile {
  $meta: { note: string; unit: string };
  identity: {
    nameEn: string;
    nameNe: string;
    flag: string;
    motto: string;
    mottoEn: string;
    nationalFlower: string;
    shape: string;
    highestPoint: string;
    lowestPoint: string;
    timeZone: string;
    languages: number;
    currency: string;
    callingCode: string;
  };
  headline: { id: string; label: string; value: number; suffix: string; sub: string; source: string }[];
  stats: { id: string; label: string; value: number; unit: string; note: string; source: string }[];
  series: Record<string, Series>;
  monsoon: { label: string; note: string; bans: { road: string; window: string; reason: string }[] };
  emergencies: { label: string; note?: string; items: { name: string; number: string; note: string }[] };
}

/** A citizen-submitted civic signal. Stored locally, optionally synced to the API. */
export interface Signal {
  id: string;
  sector: SectorId;
  district: string;
  city?: string;
  title: string;
  detail: string;
  severity: 1 | 2 | 3 | 4 | 5;
  lat: number;
  lon: number;
  createdAt: number;
  synced: boolean;
  aiSummary?: string;
  aiActions?: string[];
}

export type ChatRole = 'user' | 'model';

export interface ChatMessage {
  role: ChatRole;
  text: string;
  at: number;
  /** Tool calls the assistant made against the knowledge base. */
  tools?: { name: string; args: Record<string, unknown> }[];
  error?: boolean;
}

export interface NexaModel {
  id: string;
  label: string;
  kind: string;
}
