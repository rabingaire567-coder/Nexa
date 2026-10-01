import {
  BELT_LABEL,
  cities,
  districtById,
  districts,
  nationalFile,
  provinceById,
  provinces,
  sectorById,
  sectors,
  severityOf,
  SECTOR_IDS,
  TAG_LABEL,
} from './nepal';
import { toNepali } from './nepal';
import type { City, District, Sector, SectorId } from '@/types';

/**
 * Nexa Knowledge Mode.
 *
 * Sakhi answers through Gemini whenever a key is configured. This module is the
 * fallback that keeps the assistant genuinely useful with no key at all — which
 * matters, because a demo where the flagship feature is a disabled textbox is a
 * bad demo.
 *
 * It is retrieval plus templated synthesis, not a language model: the question is
 * routed to the same `runTool` surface the live model calls, and the answer is
 * assembled from Nexa's verified dataset. Every number it prints is the stored
 * value, and the transport badge tells the reader which mode produced it.
 *
 * No network. No key. No invented figures.
 */

export interface KbAnswer {
  text: string;
  tools: { name: string; args: Record<string, unknown> }[];
}

const nf = (n: number) => n.toLocaleString('en-IN');

/* ───────────────────────── intent detection ───────────────────────── */

type Intent =
  | { kind: 'emergency' }
  | { kind: 'place-sector'; place: District | City; sector: SectorId; asCity: boolean }
  | { kind: 'sector'; id: SectorId }
  | { kind: 'city'; city: City }
  | { kind: 'district'; district: District }
  | { kind: 'compare'; places: District[]; sector?: SectorId }
  | { kind: 'national'; topics: string[] }
  | { kind: 'solution'; id: SectorId }
  | { kind: 'rank'; sector: SectorId }
  | { kind: 'greeting' }
  | { kind: 'unknown' };

const SECTOR_WORDS: [SectorId, RegExp][] = [
  ['air', /air|pollut|pm2\.?5|smog|aqi|वायु|प्रदूषण|धुव|वातावरण/],
  ['traffic', /traffic|congestion|road|jam|vehicle|सडक|जाम|यातायात|गाडी|चालक/],
  ['flood', /flood|landslide|glof|river|erosion|बाढी|पहिरो|डुब्न|नदी|गलछो/],
  ['waste', /waste|garbage|trash|landfill|sanitation|फोहोर|कचरा|सफाई|डंगर/],
  ['water', /water|drain|pipe|supply|shortage|पानी|नाली|खानेपानी|प्युर/],
  ['energy', /power|electric|load.?shed|blackout|energy|bijuli|बिजुली|लोडशेडिङ|मात्रा/],
  ['health', /health|hospital|doctor|clinic|medic|स्वास्थ्य|अस्पताल|डाक्टर|औषध|निगर/],
  ['agri', /farm|agricult|crop|harvest|fisher|livestock|कृषि|खेती|बाली|माछा|पशु/],
  ['connect', /internet|digital|literacy|network|online|phone|इन्टरनेट|डिजिटल|साक्षरता|इन्टर/],
];

/** Devanagari presence decides the response language. */
const isNepali = (s: string) => /[ऀ-ॿ]/.test(s);

/**
 * Colloquial and transliterated spellings people actually type. The dataset
 * stores the standard form (विराटनगर) but the spoken variant is बिराजनगर.
 */
const ALIASES: Record<string, string> = {
  birajnagar: 'biratnagar',
  vitar: 'kathmandu',
  ktm: 'kathmandu',
  bkt: 'bhaktapur',
  pkt: 'pokhara',
  bktapur: 'bhaktapur',
  bhatgoda: 'bhaktapur',
  nepalganj: 'nepalgunj',
  jnk: 'janakpur',
  bhardaha: 'birgunj',
  dhangara: 'dhangadhi',
};

/**
 * Devanagari combining marks that carry no identity: the dependent vowel signs,
 * the virama, anusvara, candrabindu, visarga and the stress accents. Removing
 * these is what turns भक्तपुरको into भक्तपुर, so a possessive form still matches
 * the bare name. Built from escape sequences rather than literal ranges, because
 * the nukta consonants are multi-codepoint and cannot appear in a character
 * class written as literal text.
 */
const DEVANAGARI_MARKS = new RegExp('[\\u0900-\\u0903\\u093A-\\u094D\\u0951-\\u0957\\u0962-\\u0963]', 'g');

/** Everything worth comparing: Latin letters plus Devanagari consonants/vowels. */
const SKELETON_KEEP = new RegExp('[^a-z\\u0905-\\u0914\\u0915-\\u0939\\u0958-\\u095F\\u0985-\\u098C]', 'g');

/**
 * Reduces a name to a comparison skeleton.
 *
 * Latin is lowercased with the b/v, s/sh and t/th pairs Nepali speakers substitute
 * freely unified. Devanagari keeps its consonants but loses the combining marks
 * above. The b/v pair is unified in both scripts, so the spoken बिराजनगर matches
 * the written विराटनगर.
 */
function skeleton(input: string): string {
  return input
    .toLowerCase()
    .replace(DEVANAGARI_MARKS, '')
    .replace(/sh|x/g, 's')
    .replace(/th/g, 't')
    .replace(/[bv]/g, 'b')
    .replace(/\u092C/g, '\u0935') // Devanagari b → v, mirroring the Latin unification above
    .replace(SKELETON_KEEP, '');
}

/**
 * Nepali attaches case and possessive endings directly to the noun, so
 * "भक्तपुरको" and "बिराजनगरमा" must be stripped back to the bare name before it
 * can be matched.
 *
 * Only multi-character endings are listed. Single letters like र and न are far
 * too common inside Nepali names to strip safely — removing the "र" from
 * बिराजनगरको turned it into बिराजनग and broke the match.
 */
const SUFFIXES = /(मा|ले|को|कि|की|का|कै|बाट|तिर|सँग|सित|थियो|हो|हुन्|छु)$/;

function stripAffixes(word: string): string {
  let w = word;
  for (let i = 0; i < 2; i++) {
    const next = w.replace(SUFFIXES, '');
    if (next === w) break;
    w = next;
  }
  return w;
}

/** Longest common subsequence length. */
function lcs(a: string, b: string): number {
  if (!a.length || !b.length) return 0;
  let prev = Array.from({ length: b.length + 1 }, () => 0);
  for (let i = 1; i <= a.length; i++) {
    const cur = Array.from({ length: b.length + 1 }, () => 0);
    for (let j = 1; j <= b.length; j++) {
      cur[j] = a[i - 1] === b[j - 1] ? prev[j - 1] + 1 : Math.max(prev[j], cur[j - 1]);
    }
    prev = cur;
  }
  return prev[b.length];
}

/** 0–1 similarity: forgiving of spelling drift, intolerant of unrelated names. */
function similarity(a: string, b: string): number {
  if (!a || !b) return 0;
  if (a === b) return 1;
  if (a.length >= 4 && b.length >= 4 && (a.includes(b) || b.includes(a))) return 0.93;
  const longest = Math.max(a.length, b.length);
  if (longest < 4) return 0;
  let prefix = 0;
  while (prefix < a.length && prefix < b.length && a[prefix] === b[prefix]) prefix++;
  return Math.max(lcs(a, b) / longest, (prefix * 0.9) / longest);
}

/** True when the question mentions any of the supplied name spellings. */
function nameHit(names: string[], query: string): boolean {
  const targets = names.map((n) => skeleton(n)).filter(Boolean);
  const ok = (raw: string) => {
    const q = skeleton(ALIASES[raw.trim().toLowerCase()] ?? raw);
    return q.length >= 3 && targets.some((t) => similarity(t, q) >= 0.78);
  };
  if (ok(query)) return true;
  // Retry per token with Nepali case/possessive endings removed, so an alias or
  // an inflected form inside a longer sentence still resolves.
  for (const token of query.split(/[\s,।?]+/)) {
    if (ok(stripAffixes(token))) return true;
  }
  return false;
}

function findSector(text: string): SectorId | undefined {
  for (const [id, re] of SECTOR_WORDS) if (re.test(text)) return id;
  return undefined;
}

/**
 * Resolves the place a question is about.
 *
 * Membership uses `nameHit`, so "भक्तपुरको" and "बिराजनगर" still resolve even
 * though they carry case endings or a colloquial spelling. Ranking then prefers
 * the match closest to the whole question, which keeps "Tell me about Kathmandu"
 * on the city while "Bhaktapur district flood" lands on the district.
 */
function findPlace(text: string): { district?: District; city?: City } {
  const rank = <T extends { name: string }>(list: T[], names: (x: T) => string[]) => {
    const hits = list.filter((x) => nameHit(names(x), text));
    if (!hits.length) return undefined;
    const q = skeleton(text);
    return hits.sort(
      (a, b) =>
        Math.max(...names(b).map((n) => similarity(skeleton(n), q))) -
        Math.max(...names(a).map((n) => similarity(skeleton(n), q))),
    )[0];
  };
  return {
    district: rank(districts, (d) => [d.name, d.ne, d.hq, d.hqNe]),
    city: rank(cities, (c) => [c.name, c.ne]),
  };
}

function routeIntent(raw: string): Intent {
  const q = raw.trim();
  const t = q.toLowerCase();

  if (/\b(hello|hi|namaste|hey|स्वागत|नमस्ते)\b/.test(t)) return { kind: 'greeting' };

  if (/emergency|helpline|ambulance|\bpolice\b|\bfire\b|आपतकाल|एम्बुलेन्स|प्रहरी|दमकल/.test(t)) {
    return { kind: 'emergency' };
  }

  // Monsoon road closures have to beat the traffic sector, or "which roads close
  // in monsoon" gets answered with a congestion briefing.
  if (/road|highway|monsoon|closure|\bbans?\b|बाटो|हाइवे|मनसुन/.test(t) && !/traffic|jam|congestion|जाम/.test(t)) {
    return { kind: 'national', topics: ['monsoon'] };
  }

  const sector = findSector(t);
  const { district, city } = findPlace(q);

  if (/\b(compare|versus|vs\.?|difference between|तुलना|फरक|भन्दा)\b/.test(t)) {
    const named = districts.filter((d) => nameHit([d.name, d.ne, d.hq], q));
    if (named.length >= 2) return { kind: 'compare', places: named.slice(0, 3), sector };
    const cs = cities.filter((c) => nameHit([c.name, c.ne], q)).map((c) => districtById.get(c.district)!).filter(Boolean);
    if (cs.length >= 2) return { kind: 'compare', places: cs.slice(0, 3), sector };
  }

  if (/\b(rank|top|worst|highest|most exposed|which district|list all|सबैभन्दा|कुन जिल्ला|श्रेणी)\b/.test(t) && sector) {
    return { kind: 'rank', sector };
  }

  // A place plus a sector is the most common real question shape ("how exposed
  // is Bhaktapur to flood"). Answering about the place alone drops the actual
  // question, so this gets its own branch.
  if (sector && (city || district)) {
    const cityWins = city && (!district || similarity(skeleton(city.name), skeleton(q)) >= similarity(skeleton(district!.name), skeleton(q)));
    if (cityWins) return { kind: 'place-sector', place: city!, sector, asCity: true };
    return { kind: 'place-sector', place: district!, sector, asCity: false };
  }

  if (/\b(what should|how do|how to|solution|fix|के गर्ने|कसरी|उपाय|समाधान)\b/.test(t) && sector) {
    return { kind: 'solution', id: sector };
  }

  if (city) return { kind: 'city', city };
  if (district) return { kind: 'district', district };
  if (sector) return { kind: 'sector', id: sector };

  // Collect every national topic so "population and tourism" answers both.
  const topics: string[] = [];
  if (/population|जनसंख्या|कति जन/.test(t)) topics.push('population');
  if (/touris|foreign|arrival|पर्यटक/.test(t)) topics.push('tourism');
  if (/province|प्रदेश/.test(t)) topics.push('provinces');
  if (topics.length) return { kind: 'national', topics };

  // An explicit ask for a briefing, even without the word "Nepal" in it.
  // Word boundaries only apply to the Latin alternatives: \b is ASCII-based, so
  // wrapping the Devanagari ones in \b…\b would misfire.
  if (/\b(national|overview|brief me|briefing|big picture|summar\w*|overall)\b/.test(t) || /सारांश|समग्र|राष्ट्रीय|विशेष|समान्य/.test(t)) {
    return { kind: 'national', topics: ['overview'] };
  }

  // Only fall through to the national briefing when the country is actually named.
  if (/(^|\s)nepal(\s|$)|नेपाल|राष्ट्र|देश/.test(t)) return { kind: 'national', topics: ['overview'] };

  return { kind: 'unknown' };
}/* ──────────────────────────── composers ───────────────────────────── */

const B = (ne: boolean, en: string, np: string) => (ne ? np : en);
const N = (ne: boolean, n: number | string) => (ne ? toNepali(n) : nf(Number(n)));

function districtTable(ne: boolean, place: District): string {
  const rows = SECTOR_IDS.map((id) => {
    const s = sectorById.get(id)!;
    const v = severityOf(place, id);
    const bar = '█'.repeat(Math.max(1, Math.round(v / 9))) + '·'.repeat(Math.max(0, 11 - Math.round(v / 9)));
    return `| ${B(ne, s.name, s.ne)} | \`${bar}\` ${N(ne, v)} |`;
  });
  return ['| ' + B(ne, 'Sector', 'क्षेत्र') + ' | ' + B(ne, 'Pressure', 'चाप') + ' |', '| --- | --- |', ...rows].join('\n');
}

function topSectors(place: District, n = 3) {
  return SECTOR_IDS.map((id) => ({ id, s: sectorById.get(id)!, v: severityOf(place, id) }))
    .sort((a, b) => b.v - a.v)
    .slice(0, n);
}

function solutionBlock(s: Sector, ne: boolean, limit = 3): string {
  return s.solutions
    .slice()
    .sort((a, b) => b.impact - a.impact)
    .slice(0, limit)
    .map((x, i) => {
      const cost = { Low: 'Low', Medium: 'Medium', High: 'High', 'Very high': 'Very high' }[x.cost];
      return `${i + 1}. **${x.title}** — ${B(ne, `impact ${x.impact}/100`, `प्रभाव ${N(ne, x.impact)}/१००`)} · ${B(ne, cost, '')}${ne ? '' : ' cost'} · ${B(ne, x.horizon, x.horizon)}
   ${x.how}`;
    })
    .join('\n\n');
}

function aqiLabel(aqi: number): string {
  if (aqi <= 50) return 'Good';
  if (aqi <= 100) return 'Moderate';
  if (aqi <= 150) return 'Unhealthy for sensitive groups';
  if (aqi <= 200) return 'Unhealthy';
  if (aqi <= 300) return 'Very unhealthy';
  return 'Hazardous';
}

function answerFor(intent: Intent, question: string): KbAnswer {
  const ne = isNepali(question);
  const tools: KbAnswer['tools'] = [];
  const T = (name: string, args: Record<string, unknown>) => {
    tools.push({ name, args });
  };

  switch (intent.kind) {
    /* ── greeting ── */
    case 'greeting':
      return {
        text: [
          `**Namaste**${ne ? ' 🙏' : ''}. I am **Sakhi**${ne ? ' (सखी)' : ''}, the civic analyst inside **Nexa**.`,
          '',
          ne
            ? 'नेपालका ७७ जिल्ला, ७ प्रदेश र नौ क्षेत्रको तथ्याङ्क मसँछ। जिल्ला, सहर, क्षेत्र वा राष्ट्रिय तथ्य सोध्नुहोस्।'
            : 'I have Nepal loaded: 77 districts, 7 provinces and 9 problem sectors. Ask me about a district, a city, a sector, or a national figure.',
          '',
          `**${B(ne, 'Try', 'प्रयास गर्नुहोस्')}**`,
          ne
            ? '- काठमाडौँको वायु प्रदूषण कस्तो छ?'
            : '- How bad is air pollution in Kathmandu?',
          ne ? '- भक्तपुरमा बाढीको जोखिम कस्तो छ?' : '- Which districts are most exposed to GLOF?',
          ne ? '- दुर्गा क्षेत्रमा पानी कसरी सुधार्ने?' : '- What would fix waterlogging in Biratnagar?',
        ].join('\n'),
        tools,
      };

    /* ── emergency ── */
    case 'emergency': {
      const em = nationalFile.emergencies;
      T('nexa_lookup', { kind: 'emergency', query: 'national emergency numbers' });
      return {
        text: [
          `**${B(ne, 'Emergency numbers — Nepal', 'आपतकालीन नम्बरहरू — नेपाल')}**`,
          '',
          ...em.items.map((i) => `- **${i.name}** — \`${i.number}\`${i.note ? ` — ${i.note}` : ''}`),
          '',
          ne ? '*तत्काल जीवन जोखिम छ भने सबैभन्दा नजिकको स्थानीय कार्यालयमा सम्पर्क गर्नुहोस्।*' : em.note ?? '',
        ]
          .filter(Boolean)
          .join('\n'),
        tools,
      };
    }

    /* ── city ── */
    case 'city': {
      const c = intent.city;
      const d = districtById.get(c.district);
      T('nexa_lookup', { kind: 'city', query: c.name });
      const lines: string[] = [
        `**${c.name}**${ne ? ` (${c.ne})` : ''} — ${c.type}, ${d?.name ?? ''} district, ${N(ne, c.pop)} people, ${N(ne, c.alt)} m.`,
        '',
        c.blurb,
        '',
        `**${B(ne, 'Live pressure read', 'वर्तमान चाप') }**`,
        '',
        `| ${B(ne, 'Measure', 'सूचक')} | ${B(ne, 'Value', 'मान')} |`,
        '| --- | --- |',
        `| ${B(ne, 'Air quality (PM2.5)', 'वायु गुणस्तर (PM2.5)')} | ${N(ne, c.air.pm25)} µg/m³ — ${aqiLabel(c.air.aqi)} |`,
        `| ${B(ne, 'Congestion', 'यातायात जाम')} | ${N(ne, c.traffic.congestion)}/100 · ${B(ne, c.traffic.peakHours, c.traffic.peakHours)} |`,
        `| ${B(ne, 'Avg. speed', 'औसत गति')} | ${N(ne, c.traffic.avgSpeedKmph)} km/h |`,
        `| ${B(ne, 'Waste generated', 'उत्पादित फोहोर')} | ${N(ne, c.waste.tpd)} t/day · ${N(ne, c.waste.recycled)}% recycled |`,
        `| ${B(ne, 'Drain age', 'नालीको उमेर')} | ${B(ne, c.water.drainAge, c.water.drainAge)} |`,
        `| ${B(ne, 'Power outage', 'विद्युत कटौती')} | ${N(ne, c.energy.outageHours)} h${ne ? '' : ''} |`,
        `| ${B(ne, 'Health within 30 min', '३० मिनेटमा स्वास्थ्य सेवा')} | ${N(ne, c.health.phcReach30min)}% |`,
        `| ${B(ne, 'Doctors per 100k', '१ लाखमा चिकित्सक')} | ${N(ne, c.health.doctorsPer100k)} |`,
        `| ${B(ne, 'Digital literacy', 'डिजिटल साक्षरता')} | ${N(ne, c.connect.digitalLiteracy)}% |`,
        '',
        `**${B(ne, 'Watch for', 'ध्यान दिनुपर्ने')}**`,
        ...c.water.floodProne.map((f) => `- ${f}`),
        ...(c.landmarks.length ? ['', `**${B(ne, 'Known for', 'परिचित')}** — ${c.landmarks.slice(0, 6).join(' · ')}`] : []),
      ];
      if (d) {
        lines.push('', `**${B(ne, 'District pressure', 'जिल्ला चाप')}**`, '', districtTable(ne, d));
      }
      return { text: lines.join('\n'), tools };
    }

    /* ── district ── */
    case 'district': {
      const p = intent.district;
      const prov = provinceById.get(p.prov);
      const top = topSectors(p);
      T('nexa_lookup', { kind: 'district', query: p.name });
      const tags = p.tags.map((t) => TAG_LABEL[t] ?? t).filter(Boolean);
      const lines: string[] = [
        `**${p.name}**${ne ? ` (${p.ne})` : ''} — ${prov?.name ?? ''}${ne ? ` (${prov?.ne ?? ''})` : ''}. ${B(ne, 'District HQ', 'जिल्ला सदरमुकाम')} ${p.hq}, ${N(ne, p.pop)} people over ${N(ne, p.area)} km², ${N(ne, p.alt)} m, ${BELT_LABEL[p.belt]} belt.`,
        '',
        `**${B(ne, 'Highest pressure', 'सबैभन्दा बढी चाप')}** — ${top
          .map((t) => `${t.s.name} (${N(ne, t.v)})`)
          .join(', ')}.`,
        '',
        districtTable(ne, p),
      ];
      if (tags.length) lines.push('', `**${B(ne, 'Characteristics', 'विशेषता')}** — ${tags.join(' · ')}`);
      const lead = sectorById.get(top[0].id)!;
      lines.push(
        '',
        `**${B(ne, 'Why it dominates here', 'यहाँ किन प्रमुख')}**`,
        ...lead.mechanism.slice(0, 3).map((m) => `- ${m}`),
        '',
        `**${B(ne, 'What works', 'उपाय')}**`,
        solutionBlock(lead, ne, 2),
      );
      const city = cities.find((c) => c.district === p.id);
      if (city) lines.push('', `${B(ne, 'Largest city', 'सबैभन्दा ठूलो सहर')}: **${city.name}** — ${N(ne, city.pop)} · AQI ${N(ne, city.air.aqi)}.`);
      return { text: lines.join('\n'), tools };
    }

    /* ── compare ── */
    case 'compare': {
      const places = intent.places;
      const focus = intent.sector;
      T('nexa_lookup', { kind: 'search', query: places.map((p) => p.name).join(', ') });
      const compositeOf = (p: District) =>
        Math.round(SECTOR_IDS.reduce((a, id) => a + severityOf(p, id), 0) / SECTOR_IDS.length);
      const worst = places.map((p) => ({ p, v: compositeOf(p) })).sort((a, b) => b.v - a.v);

      const cols = focus
        ? [B(ne, 'District', 'जिल्ला'), B(ne, 'Belt', 'अञ्चल'), B(ne, 'Population', 'जनसंख्या'), B(ne, sectorById.get(focus)!.name, sectorById.get(focus)!.ne), B(ne, 'Composite', 'कुल')]
        : [B(ne, 'District', 'जिल्ला'), B(ne, 'Belt', 'अञ्चल'), B(ne, 'Population', 'जनसंख्या'), B(ne, 'Altitude', 'उचाई'), B(ne, 'Composite', 'कुल')];

      const rows = places.map((p) =>
        focus
          ? `| **${p.name}** | ${BELT_LABEL[p.belt]} | ${N(ne, p.pop)} | **${N(ne, severityOf(p, focus))}**/100 | ${N(ne, compositeOf(p))} |`
          : `| **${p.name}** | ${BELT_LABEL[p.belt]} | ${N(ne, p.pop)} | ${N(ne, p.alt)} m | ${N(ne, compositeOf(p))} |`,
      );

      const lines: string[] = [
        `**${focus ? `${B(ne, focus === 'health' ? 'Healthcare access' : sectorById.get(focus)!.name, sectorById.get(focus)!.ne)}: ` : ''}${B(ne, 'head to head', 'तुलनात्मक विश्लेषण')}**`,
        '',
        [`| ${cols[0]} | ${cols[1]} | ${cols[2]} | ${cols[3]} | ${cols[4]} |`, '| --- | --- | --- | --- | --- |', ...rows].join('\n'),
      ];

      if (focus) {
        const ranked = places
          .map((p) => ({ p, v: severityOf(p, focus) }))
          .sort((a, b) => b.v - a.v);
        const gap = ranked[0].v - ranked[ranked.length - 1].v;
        lines.push(
          '',
          `**${B(ne, 'The gap', 'फरक')}** — ${B(ne, `${ranked[0].p.name} scores ${ranked[0].v}/100 against ${ranked[ranked.length - 1].p.name} at ${ranked[ranked.length - 1].v}: a spread of ${gap} points.`, `${ranked[0].p.name} ${N(ne, ranked[0].v)}/१०० छ भने ${ranked[ranked.length - 1].p.name} ${N(ne, ranked[ranked.length - 1].v)}/१०० — ${N(ne, gap)} अङ्कको भिन्नता।`)}`,
        );
      }

      lines.push(
        '',
        `**${B(ne, 'Where each stands out', 'कहाँ के फरक छ')}**`,
        ...places.map((p) => {
          const t = topSectors(p, 1)[0];
          return `- **${p.name}** — ${B(ne, `driven by ${t.s.name} at ${t.v}/100`, `${t.s.ne} ${N(ne, t.v)}/१०० बाट प्रभावित`)}. ${p.tags.slice(0, 3).map((x) => TAG_LABEL[x] ?? x).join(', ')}.`;
        }),
        '',
        `**${B(ne, 'Read-across', 'निष्कर्ष')}** — ${
          ne
            ? `${worst[0].p.name} मा कुल चाप ${N(ne, worst[0].v)} सबैभन्दा बढी छ, जबकि ${worst[worst.length - 1].p.name} ${N(ne, worst[worst.length - 1].v)} मा छ। दुवै ${worst[0].p.belt === worst[worst.length - 1].p.belt ? 'एउटै अञ्चलमा' : 'फरक अञ्चलमा'} भएकाले उपाय पनि फरक हुनुपर्छ।`
            : `${worst[0].p.name} carries the highest composite pressure at ${worst[0].v}, against ${worst[worst.length - 1].v} in ${worst[worst.length - 1].p.name}. ${worst[0].p.belt === worst[worst.length - 1].p.belt ? 'Both sit in the same belt, so the same playbook mostly applies.' : 'They sit in different ecological belts, so the playbook has to differ — a Terai drainage fix does nothing in a mountain district.'}`
        }`,
      );
      return { text: lines.join('\n'), tools };
    }

    /* ── rank ── */
    case 'rank': {
      const s = sectorById.get(intent.sector)!;
      T('nexa_solutions', { sector: intent.sector, limit: 3 });
      const ranked = districts
        .map((d) => ({ d, v: severityOf(d, intent.sector) }))
        .sort((a, b) => b.v - a.v)
        .slice(0, 8);
      const lines: string[] = [
        `**${s.name} — ${B(ne, 'most exposed districts', 'सबैभन्दा प्रभावित जिल्ला')}**`,
        '',
        s.headline,
        '',
        `| # | ${B(ne, 'District', 'जिल्ला')} | ${B(ne, 'Belt', 'अञ्चल')} | ${B(ne, 'HQ', 'सदरमुकाम')} | ${B(ne, 'Pressure', 'चाप')} |`,
        '| --- | --- | --- | --- | --- |',
        ...ranked.map((r, i) => `| ${i + 1} | **${r.d.name}** | ${BELT_LABEL[r.d.belt]} | ${r.d.hq} | ${N(ne, r.v)} |`),
        '',
        `**${B(ne, 'Anchor figure', 'मुख्य तथ्य')}** — ${s.anchor.label}: **${N(ne, s.anchor.value)} ${s.anchor.unit}** against a target of ${N(ne, s.anchor.target)} ${s.anchor.targetLabel}.`,
        '',
        `**${B(ne, 'What works', 'उपाय')}**`,
        solutionBlock(s, ne, 3),
      ];
      return { text: lines.join('\n'), tools };
    }

    /* ── sector ── */
    case 'sector': {
      const s = sectorById.get(intent.id)!;
      T('nexa_lookup', { kind: 'sector', query: intent.id });
      const worst = districts
        .map((d) => ({ d, v: severityOf(d, intent.id) }))
        .sort((a, b) => b.v - a.v)
        .slice(0, 5);
      const lines: string[] = [
        `**${s.name}**${ne ? ` — ${s.ne}` : ''} · ${B(ne, 'national pressure', 'राष्ट्रिय चाप')} ${N(ne, s.severity)}/100`,
        '',
        s.headline,
        '',
        `**${B(ne, 'The problem', 'समस्या')}**`,
        s.problem,
        '',
        `**${B(ne, 'Mechanism', 'कारण') }**`,
        ...s.mechanism.map((m) => `- ${m}`),
        '',
        `**${B(ne, 'Anchor', 'तथ्य')}** — ${s.anchor.label}: **${N(ne, s.anchor.value)} ${s.anchor.unit}**, target ${N(ne, s.anchor.target)} ${s.anchor.targetLabel}.`,
        '',
        `**${B(ne, 'Signals to watch', 'निगरानीका संकेत')}**`,
        ...s.signals.map((x) => `- ${x}`),
        '',
        `**${B(ne, 'Hardest-hit districts', 'सबैभन्दा प्रभावित')}** — ${worst
          .map((w) => `${w.d.name} (${N(ne, w.v)})`)
          .join(', ')}`,
        '',
        `**${B(ne, 'What works', 'उपाय')}**`,
        solutionBlock(s, ne, 3),
      ];
      return { text: lines.join('\n'), tools };
    }

    /* ── solution ── */
    case 'solution': {
      const s = sectorById.get(intent.id)!;
      T('nexa_solutions', { sector: intent.id, limit: 4 });
      return {
        text: [
          `**${B(ne, `Fixing ${s.name.toLowerCase()} in Nepal`, `नेपालमा ${s.ne} समाधान`)}**`,
          '',
          `**${B(ne, 'Mechanism first', 'कारण पहिले')}**`,
          ...s.mechanism.slice(0, 3).map((m) => `- ${m}`),
          '',
          `**${B(ne, 'The playbook', 'योजना')}**`,
          solutionBlock(s, ne, 4),
          '',
          `**${B(ne, 'Next steps', 'अबको कदम')}**`,
          `1. ${B(ne, 'Open the district profile in the atlas and check the local severity against the national baseline.', 'एटलसमा जिल्ला प्रोफाइल खोलेर स्थानीय चाप र राष्ट्रीय आधार तुलना गर्नुहोस्।')}`,
          `2. ${B(ne, 'Scope one intervention to a single ward and cost it before scaling.', 'एउटै वार्डमा एउटा उपाय सीमित गरी लागत निकाल्नुहोस्, त्यसपछि विस्तार गर्नुहोस्।')}`,
          `3. ${B(ne, 'File a civic signal so the baseline is recorded before you claim improvement.', 'आधार रेकर्ड गर्न नागरिक सङ्केत दर्ता गर्नुहोस्।')}`,
        ].join('\n'),
        tools,
      };
    }

    /* ── place + sector: the signature query ── */
    case 'place-sector': {
      const s = sectorById.get(intent.sector)!;
      const isCity = intent.asCity;
      const city = isCity ? (intent.place as City) : undefined;
      const district = isCity ? districtById.get(city!.district)! : (intent.place as District);
      const where = isCity ? `${city!.name}${ne ? ` (${city!.ne})` : ''}` : `${district.name}${ne ? ` (${district.ne})` : ''}`;
      const score = severityOf(district, intent.sector);
      T('nexa_lookup', { kind: 'district', query: district.name });
      T('nexa_solutions', { sector: intent.sector, limit: 3 });

      const nationalRank = districts
        .map((d) => ({ d, v: severityOf(d, intent.sector) }))
        .sort((a, b) => b.v - a.v);
      const rank = nationalRank.findIndex((r) => r.d.id === district.id) + 1;
      const national = nationalRank[0]?.v ?? score;

      const lines: string[] = [
        `**${where}** — ${s.name}${ne ? ` (${s.ne})` : ''}${B(ne, ' pressure', ' चाप')} **${N(ne, score)}/100**, ${B(ne, 'rank', 'स्थान')} ${N(ne, rank)} of ${N(ne, 77)} districts.`,
        '',
        s.headline,
        '',
        `**${B(ne, 'Where it sits', 'स्थिति')}**`,
        '',
        `| ${B(ne, 'Measure', 'सूचक')} | ${B(ne, 'Value', 'मान')} |`,
        '| --- | --- |',
        `| ${B(ne, `${where} pressure`, `${where} चाप`)} | **${N(ne, score)}/100** |`,
        `| ${B(ne, 'National worst', 'राष्ट्रिय उच्चतम')} | ${N(ne, national)}/100 |`,
        `| ${B(ne, 'Sector anchor', 'क्षेत्रीय आँकडा')} | ${s.anchor.label}: ${N(ne, s.anchor.value)} ${s.anchor.unit} |`,
        ...(isCity && city
          ? ([
              `| ${B(ne, 'Local AQI', 'स्थानीय AQI')} | ${N(ne, city.air.aqi)} (${aqiLabel(city.air.aqi)}) |`,
              `| ${B(ne, 'Congestion', 'यातायात जाम')} | ${N(ne, city.traffic.congestion)}/100 |`,
              `| ${B(ne, 'Waste per day', 'दैनिक फोहोर')} | ${N(ne, city.waste.tpd)} t |`,
              `| ${B(ne, 'Outage hours', 'विद्युत कटौती')} | ${N(ne, city.energy.outageHours)} h |`,
              `| ${B(ne, 'Health within 30 min', '३० मिनेटमा स्वास्थ्य सेवा')} | ${N(ne, city.health.phcReach30min)}% |`,
            ] as string[])
          : []),
      ];

      if (isCity && city) {
        const prone = city.water.floodProne.filter((f) =>
          intent.sector === 'flood' ? /flood|river|waterlog|बाढी|नदी/i.test(f) : true,
        );
        if (prone.length) lines.push('', `**${B(ne, 'Known exposure', 'ज्ञात जोखिम')}** — ${prone.join('; ')}`);
        if (intent.sector === 'flood') lines.push('', `${B(ne, 'Drain age', 'नालीको उमेर')}: ${city.water.drainAge}.`);
      }

      lines.push(
        '',
        `**${B(ne, 'Why the pressure sits there', 'यहाँ यति चाप किन')}**`,
        ...s.mechanism.slice(0, 3).map((m) => `- ${m}`),
        '',
        `**${B(ne, 'What works here', 'यहाँ कुन उपाय')}**`,
        solutionBlock(s, ne, 3),
        '',
        `**${B(ne, 'Hardest hit nationally', 'राष्ट्रिय रूपमा सबैभन्दा प्रभावित')}** — ${nationalRank
          .slice(0, 5)
          .map((r) => `${r.d.name} (${N(ne, r.v)})`)
          .join(', ')}`,
      );
      return { text: lines.join('\n'), tools };
    }

    /* ── national ── */
    case 'national': {
      T('nexa_lookup', { kind: 'national', query: intent.topics.join(', ') });
      const n = nationalFile;
      const lines: string[] = [`**Nepal — ${n.identity.mottoEn || n.headline[0]?.sub || ''}**`.trim()];
      for (const topic of intent.topics) {
        if (topic === 'provinces') {
          lines.push('', `**${B(ne, 'Seven provinces', 'सात प्रदेश')}**`, '', `| ${B(ne, 'Province', 'प्रदेश')} | ${B(ne, 'Capital', 'राजधानी')} | ${B(ne, 'Districts', 'जिल्ला')} | ${B(ne, 'Area', 'क्षेत्रफल')} | ${B(ne, 'Population', 'जनसंख्या')} |`, '| --- | --- | --- | --- | --- |',
            ...provinces.map((p) => `| **${p.name}**${ne ? ` (${p.ne})` : ''} | ${p.capital} | ${N(ne, p.districts)} | ${N(ne, p.area)} km² | ${N(ne, p.pop)} |`));
        } else if (topic === 'monsoon') {
          lines.push('', n.monsoon.note, '', `**${B(ne, 'Road closures', 'सडक बन्द')}**`, '',
            ...n.monsoon.bans.map((b) => `- **${b.road}** — ${b.window} · ${b.reason}`));
        } else if (topic === 'tourism') {
          const t = n.series.tourism;
          if (t) {
            lines.push('', `**${t.label}** (${t.unit}) — ${t.source}`, '', ...t.points.slice(-6).map((p) => `- ${p.y}: **${N(ne, p.v)}**`));
          }
          const mk = n.series.topMarkets;
          if (mk) lines.push('', `**${mk.label}** —`, ...mk.points.map((p) => `- ${p.y}: ${N(ne, p.v)} ${mk.unit}`));
        } else if (topic === 'population') {
          lines.push('', `**${B(ne, 'Headline indicators', 'प्रमुख सूचक')}**`, '',
            ...n.headline.map((h) => `- **${h.label}** — ${N(ne, h.value)}${h.suffix} · ${h.sub}`));
        } else {
          lines.push('', `**${B(ne, 'At a glance', 'एक नजरमा')}**`, '',
            ...n.headline.map((h) => `- **${h.label}** — ${N(ne, h.value)}${h.suffix} · ${h.sub}`),
            '', `**${B(ne, 'Key statistics', 'मुख्य तथ्याङ्क')}**`, '',
            ...n.stats.slice(0, 8).map((s) => `- **${s.label}** — ${N(ne, s.value)} ${s.unit} · ${s.note} _(source: ${s.source})_`),
            '', `**${B(ne, 'Nine sectors Nexa tracks', 'नक्सामा रहेका नौ क्षेत्र')}**`, '',
            ...sectors.map((s) => `- **${s.name}**${ne ? ` (${s.ne})` : ''} — pressure ${N(ne, s.severity)}/100 · ${s.anchor.label}: ${N(ne, s.anchor.value)} ${s.anchor.unit}`));
        }
      }
      return { text: lines.join('\n'), tools };
    }

    /* ── unknown ── */
    default: {
      T('nexa_lookup', { kind: 'search', query: question.slice(0, 60) });
      return {
        text: [
          ne
            ? `मलाई "${question}" बारेमा Nexa लेखमा भेटिएन।`
            : `I could not match that to anything in the Nexa dataset.`,
          '',
          `**${B(ne, 'What I can answer', 'म सक्ने प्रश्नहरू')}**`,
          '',
          ...(ne
            ? ['कुनै जिल्ला वा सहरको अवस्था — *भदौ १२ मा भक्तपुरको बाढी जोखिम कस्तो छ?*', 'कुनै क्षेत्रको राष्ट्रिय अवस्था — *वायु प्रदूषण कति छ?*', 'जिल्ला तुलना — *चितवन र जुम्लाको स्वास्थ्य सेवा फरक कस्तो छ?*', 'कुन क्षेत्र सबैभन्दा बढी प्रभावित — *GLOF मा कुन जिल्ला अगाडि छ?*', 'समाधान — *दुर्गा क्षेत्रमा के गर्ने?*', 'आपतकालीन नम्बर — *एम्बुलेन्सको नम्बर कुन हो?*']
            : ['Any district or city — *"How exposed is Bhaktapur to flood?"*', 'Any sector nationally — *"How bad is air pollution?"*', 'A comparison — *"Compare Chitwan and Jumla on health access"*', 'A ranking — *"Which districts are worst for water?"*', 'A solution — *"What should a ward do about waste?"*', 'Emergencies — *"What is the ambulance number?"*']),
          '',
          ne ? 'जिल्ला, सहर वा क्षेत्रको नाम लेख्नुहोस्।' : 'Name a district, city or sector and I will pull the actual figures.',
        ].join('\n'),
        tools,
      };
    }
  }
}

/**
 * Answer a question from the knowledge base. Used when no Gemini key is
 * configured, and as the graceful fallback if the live model call fails.
 */
export function answerFromKb(question: string): KbAnswer {
  return answerFor(routeIntent(question), question);
}

export const KB_MODES = ['ask', 'greeting', 'emergency', 'city', 'district', 'compare', 'rank', 'sector', 'solution', 'national', 'unknown'] as const;
export type KbMode = (typeof KB_MODES)[number];