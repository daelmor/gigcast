/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Qloo API probe (milestone M0).
 *
 * Hits the live Qloo hackathon API and records what it actually returns, so the
 * client, the Zod schemas and the demo-market choice are based on observed
 * behavior rather than on documentation.
 *
 * Writes (temp file first, then atomic rename):
 *   docs/qloo-findings.md         findings, endpoint shapes, parameter behavior, coverage table
 *   docs/qloo-probe-log.json      every request (endpoint + params, never the key), status, latency, count
 *   docs/qloo-samples/<id>.json   trimmed response samples, usable as test fixtures
 *   .cache/qloo-probe/<id>.json   full raw responses (gitignored)
 *
 * If docs/qloo-findings.notes.md exists, its content is appended to the findings
 * under "Analyst notes" so hand-written interpretation survives re-runs.
 *
 * Run:   pnpm probe                 (tsx)
 *   or:  node scripts/qloo-probe.ts (Node >= 22.18 strips types natively)
 * Env:   QLOO_API_KEY (required), QLOO_BASE_URL (default: hackathon base URL)
 */

import { mkdir, writeFile, rename, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const BASE_URL = process.env.QLOO_BASE_URL ?? 'https://hackathon.api.qloo.com';
const PRODUCTION_BASE_URL = 'https://api.qloo.com';
const API_KEY = process.env.QLOO_API_KEY;
if (!API_KEY) {
  console.error('QLOO_API_KEY is not set. Export it (never commit it) and re-run.');
  process.exit(1);
}
const KEY: string = API_KEY;

const ROOT = path.resolve(import.meta.dirname, '..');
const CACHE_DIR = path.join(ROOT, '.cache', 'qloo-probe');
const DOCS_DIR = path.join(ROOT, 'docs');
const SAMPLES_DIR = path.join(DOCS_DIR, 'qloo-samples');
const FINDINGS_FILE = path.join(DOCS_DIR, 'qloo-findings.md');
const NOTES_FILE = path.join(DOCS_DIR, 'qloo-findings.notes.md');
const LOG_FILE = path.join(DOCS_DIR, 'qloo-probe-log.json');

const DELAY_BETWEEN_CALLS_MS = 120;
/** QLOO_PROBE_REPLAY=1 serves any request already present in .cache/qloo-probe/ instead of calling the API. */
const REPLAY = process.env.QLOO_PROBE_REPLAY === '1';
const MAX_RETRIES = 3;
const MARKET_CONCURRENCY = 2;

interface Market {
  slug: string;
  label: string;
  /** Plain city name, used to prefer an exact locality name match. */
  cityName: string;
  /** Primary free-text query, also used for the `*.query` parameter variants. */
  query: string;
  /** Fallback queries for `/search` when the primary one resolves to the wrong place. */
  altQueries: string[];
  /** Lower-case substrings that must appear in the locality name or disambiguation. */
  countryHints: string[];
  /** Lower-case substrings that disqualify a locality candidate (e.g. the Florida namesakes). */
  rejectHints: string[];
  country: string;
  lat: number;
  lon: number;
  artists: string[];
}

const MARKETS: Market[] = [
  { slug: 'guatemala-city', label: 'Guatemala City', cityName: 'Guatemala City', query: 'Guatemala City, Guatemala', altQueries: ['Ciudad de Guatemala'],
    countryHints: ['guatemala'], rejectHints: ['united states'], country: 'GT', lat: 14.6349, lon: -90.5069,
    artists: ['Ricardo Arjona', 'Gaby Moreno', 'Alux Nahual', 'Bohemia Suburbana', 'Viernes Verde'] },
  { slug: 'san-salvador', label: 'San Salvador', cityName: 'San Salvador', query: 'San Salvador, El Salvador', altQueries: ['San Salvador'],
    countryHints: ['el salvador'], rejectHints: ['united states'], country: 'SV', lat: 13.6929, lon: -89.2182,
    artists: ['Álvaro Torres', 'Adhesivo', 'Frigüey', 'Los Hermanos Flores', 'Shaka y Dres'] },
  // "Panama City" in any spelling resolves to Florida; the capital is the locality "Distrito Panamá".
  { slug: 'panama-city', label: 'Panama City', cityName: 'Distrito Panamá', query: 'Panama City, Panama', altQueries: ['Distrito Panamá', 'Ciudad de Panamá'],
    countryHints: ['panama', 'panamá'], rejectHints: ['united states', 'florida'], country: 'PA', lat: 8.9824, lon: -79.5199,
    artists: ['Rubén Blades', 'Sech', 'Boza', 'Joey Montana', 'Los Rabanes'] },
  { slug: 'santo-domingo', label: 'Santo Domingo', cityName: 'Santo Domingo', query: 'Santo Domingo, Dominican Republic', altQueries: ['Santo Domingo, República Dominicana'],
    countryHints: ['dominican', 'dominicana'], rejectHints: ['united states'], country: 'DO', lat: 18.4861, lon: -69.9312,
    artists: ['Juan Luis Guerra', 'Romeo Santos', 'Natti Natasha', 'El Alfa', 'Aventura'] },
  { slug: 'managua', label: 'Managua', cityName: 'Managua', query: 'Managua, Nicaragua', altQueries: ['Managua'],
    countryHints: ['nicaragua'], rejectHints: ['united states'], country: 'NI', lat: 12.115, lon: -86.2362,
    artists: ['Luis Enrique', 'Carlos Mejía Godoy', 'Perrozompopo', 'Katia Cardenal', 'Dimensión Costeña'] },
  { slug: 'mexico-city', label: 'Mexico City', cityName: 'Mexico City', query: 'Mexico City, Mexico', altQueries: ['Ciudad de México'],
    countryHints: ['mexico', 'méxico'], rejectHints: ['united states'], country: 'MX', lat: 19.4326, lon: -99.1332,
    artists: ['Natalia Lafourcade', 'Café Tacvba', 'Carín León', 'Zoé', 'Los Ángeles Azules'] },
  { slug: 'miami', label: 'Miami (control)', cityName: 'Miami', query: 'Miami, Florida', altQueries: ['Miami'],
    countryHints: ['florida'], rejectHints: [], country: 'US', lat: 25.7617, lon: -80.1918,
    artists: ['Pitbull', 'Gloria Estefan', 'Camila Cabello', 'Nicky Jam', 'Marc Anthony'] },
];

const GLOBAL_ARTISTS = ['Bad Bunny', 'Karol G', 'Coldplay', 'Shakira', 'Daddy Yankee', 'Feid', 'Rauw Alejandro', 'Grupo Frontera', 'Peso Pluma', 'Taylor Swift'];
const ANCHOR_ARTIST = 'Bad Bunny';
const SECOND_ARTIST = 'Coldplay';

// Place categories we need for venues and partners. Resolved to tag IDs live.
const PLACE_TAG_QUERIES = ['bar', 'hotel', 'restaurant', 'night club', 'concert hall', 'stadium', 'arena', 'theater', 'performing arts theater', 'event venue', 'live music venue'];
const COVERAGE_TAGS = ['bar', 'hotel', 'night club', 'concert hall', 'stadium'];

// ---------------------------------------------------------------------------
// HTTP layer
// ---------------------------------------------------------------------------

type Json = any;
type Params = Record<string, string | number | boolean | undefined>;

interface CallRecord {
  id: string;
  endpoint: string;
  params: Params;
  base: string;
  status: number;
  ms: number;
  count: number | null;
  fetchedAt: string;
  replayed: boolean;
  error?: string;
  rateHeaders?: Record<string, string>;
}
interface CallResult extends CallRecord {
  body: Json;
}

const records: CallRecord[] = [];
const usedIds = new Set<string>();

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function compactParams(params: Params): string {
  return Object.entries(params)
    .filter(([, v]) => v !== undefined)
    .map(([k, v]) => `${k}=${String(v).length > 48 ? String(v).slice(0, 45) + '...' : v}`)
    .join(' ');
}

async function call(id: string, endpoint: string, params: Params = {}, opts: { base?: string } = {}): Promise<CallResult> {
  if (usedIds.has(id)) throw new Error(`duplicate probe id: ${id}`);
  usedIds.add(id);
  const base = opts.base ?? BASE_URL;
  const url = new URL(endpoint, base);
  for (const [k, v] of Object.entries(params)) if (v !== undefined) url.searchParams.set(k, String(v));
  const cacheFile = path.join(CACHE_DIR, `${id}.json`);
  if (REPLAY && existsSync(cacheFile)) {
    const cached = JSON.parse(await readFile(cacheFile, 'utf8'));
    const rec: CallRecord = { id, endpoint, params, base, status: cached.status, ms: cached.ms ?? 0, count: countResults(cached.body), fetchedAt: cached.fetchedAt ?? 'unknown', replayed: true, rateHeaders: cached.rateHeaders };
    records.push(rec);
    console.log(`${String(rec.status).padStart(3)} replay  ${rec.count === null ? '   -' : String(rec.count).padStart(4)}  ${id.padEnd(40)} ${endpoint} ${compactParams(params)}`);
    return { ...rec, body: cached.body };
  }

  let status = 0;
  let body: Json = null;
  let error: string | undefined;
  let ms = 0;
  let rateHeaders: Record<string, string> | undefined;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const t0 = performance.now();
    try {
      const res = await fetch(url, { headers: { 'X-Api-Key': KEY, accept: 'application/json' } });
      ms = Math.round(performance.now() - t0);
      status = res.status;
      const text = await res.text();
      try { body = JSON.parse(text); } catch { body = text.slice(0, 500); }
      for (const [h, v] of res.headers) if (/ratelimit|retry-after/i.test(h)) (rateHeaders ??= {})[h] = v;
      error = undefined;
      if ((status === 429 || status >= 500) && attempt < MAX_RETRIES) { await sleep(1000 * 2 ** attempt); continue; }
      break;
    } catch (e) {
      ms = Math.round(performance.now() - t0);
      error = (e as Error).message;
      if (attempt < MAX_RETRIES) { await sleep(1000 * 2 ** attempt); continue; }
    }
  }
  const count = countResults(body);
  const fetchedAt = new Date().toISOString();
  const rec: CallRecord = { id, endpoint, params, base, status, ms, count, fetchedAt, replayed: false, error, rateHeaders };
  records.push(rec);
  await writeAtomic(cacheFile, JSON.stringify({ request: { base, endpoint, params }, status, ms, fetchedAt, rateHeaders, body }, null, 2));
  console.log(`${String(status).padStart(3)} ${String(ms).padStart(5)}ms ${count === null ? '   -' : String(count).padStart(4)}  ${id.padEnd(40)} ${endpoint} ${compactParams(params)}`);
  await sleep(DELAY_BETWEEN_CALLS_MS);
  return { ...rec, body };
}

// ---------------------------------------------------------------------------
// Response helpers
// ---------------------------------------------------------------------------

function firstArray(body: Json): Json[] {
  if (!body || typeof body !== 'object') return [];
  const r = body.results;
  if (Array.isArray(r)) return r;
  if (r && typeof r === 'object') for (const v of Object.values(r)) if (Array.isArray(v)) return v as Json[];
  return [];
}
function countResults(body: Json): number | null {
  if (!body || typeof body !== 'object' || !('results' in body)) return null;
  return firstArray(body).length;
}
function names(body: Json): string[] {
  return firstArray(body).map((e: Json) => e?.name).filter((n: unknown): n is string => typeof n === 'string');
}
function errorMessage(body: Json): string | undefined {
  if (!body || typeof body !== 'object') return typeof body === 'string' ? body : undefined;
  if (body.error) return typeof body.error === 'string' ? body.error : body.error.message ?? body.error.reason ?? JSON.stringify(body.error);
  if (Array.isArray(body.errors)) return body.errors.map((e: Json) => e?.message ?? JSON.stringify(e)).join('; ');
  return undefined;
}
function jaccard(a: string[], b: string[]): number {
  const A = new Set(a), B = new Set(b);
  if (A.size === 0 && B.size === 0) return 1;
  let inter = 0;
  for (const x of A) if (B.has(x)) inter++;
  return inter / (A.size + B.size - inter);
}
function normalize(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}
function nameMatches(query: string, candidate: string | undefined): boolean {
  if (!candidate) return false;
  const q = normalize(query), c = normalize(candidate);
  return q === c || c.startsWith(q) || q.startsWith(c);
}
function pct(part: number, total: number): string {
  return total === 0 ? '-' : `${Math.round((100 * part) / total)}%`;
}

/** JSON skeleton: types instead of values, arrays reduced to their first item, short strings kept as examples. */
function shapeOf(v: Json, depth = 0): Json {
  if (v === null || v === undefined) return 'null';
  if (Array.isArray(v)) {
    if (v.length === 0) return [];
    return v.length > 1 ? [shapeOf(v[0], depth + 1), `... ${v.length - 1} more`] : [shapeOf(v[0], depth + 1)];
  }
  if (typeof v === 'object') {
    if (depth >= 6) return '{...}';
    const out: Record<string, Json> = {};
    const keys = Object.keys(v);
    for (const k of keys.slice(0, 40)) out[k] = shapeOf(v[k], depth + 1);
    if (keys.length > 40) out['...'] = `${keys.length - 40} more keys`;
    return out;
  }
  if (typeof v === 'string') return v.length <= 40 ? `string "${v}"` : 'string';
  return typeof v;
}

/** Trim a response for a committed fixture: first 2 items per array, strings capped. */
function trimSample(v: Json, depth = 0): Json {
  if (Array.isArray(v)) return v.slice(0, depth === 0 ? 2 : 3).map((x) => trimSample(x, depth + 1));
  if (v && typeof v === 'object') {
    const out: Record<string, Json> = {};
    for (const [k, val] of Object.entries(v)) out[k] = trimSample(val, depth + 1);
    return out;
  }
  if (typeof v === 'string' && v.length > 300) return v.slice(0, 300) + '...';
  return v;
}

async function writeAtomic(file: string, content: string, validate?: (s: string) => void): Promise<void> {
  if (!content || content.trim().length === 0) throw new Error(`refusing to write empty content to ${file}`);
  validate?.(content);
  await mkdir(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  await writeFile(tmp, content, 'utf8');
  await rename(tmp, file);
}

async function saveSample(res: CallResult, note?: string): Promise<void> {
  const sample = { note, request: { endpoint: res.endpoint, params: res.params }, status: res.status, body: trimSample(res.body) };
  await writeAtomic(path.join(SAMPLES_DIR, `${res.id}.json`), JSON.stringify(sample, null, 2), (s) => void JSON.parse(s));
}

async function pool<T, R>(items: T[], size: number, fn: (item: T, index: number) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(size, items.length) }, async () => {
      while (next < items.length) { const i = next++; out[i] = await fn(items[i], i); }
    }),
  );
  return out;
}

// ---------------------------------------------------------------------------
// Findings model
// ---------------------------------------------------------------------------

interface ShapeNote { id: string; title: string; request: string; status: number; count: number | null; shape: Json; note?: string }
interface ArtistResolution { query: string; found: boolean; name?: string; entityId?: string; popularity?: number; disambiguation?: string; market?: string }
interface ParamExperiment { group: string; label: string; id: string; count: number | null; status: number; similarity: number | null; verdict: string }
interface EndpointTrial { id: string; endpoint: string; params: string; status: number; count: number | null; message?: string; keys?: string }

interface LocalityResolution {
  name: string;
  entityId: string;
  lat?: number;
  lon?: number;
  disambiguation?: string;
  matchedQuery: string;
}

interface MarketCoverage {
  market: Market;
  locality?: LocalityResolution;
  localityParamUsed: string;
  /** What Qloo resolved the free-text `filter.location.query` to (from `query.localities.filter`). */
  queryResolvedTo?: string;
  heatmapById: number | null;
  placesById: number | null;
  placesByQuery: number | null;
  placesBaseline: number | null;
  placesBaselineMessage?: string;
  placesPriceLevelPct: string;
  placesRatingPct: string;
  placeSamples: string[];
  placesByTag: Record<string, number | null>;
  brandsLoc: number | null;
  brandsLocSimilarityToGlobal: number | null;
  brandSamples: string[];
  heatmapByQuery: number | null;
  heatmapByPoint: number | null;
  heatmapCellKeys: string[];
  cityTags: number | null;
  cityTagSamples: string[];
  cityArtists: number | null;
  cityArtistSamples: string[];
  regional: ArtistResolution[];
  regionalAffinity: { artist: string; count: number | null } | null;
}

const shapes: ShapeNote[] = [];
const localityAttempts: string[] = [];
const artistResolutions: ArtistResolution[] = [];
const paramExperiments: ParamExperiment[] = [];
const endpointTrials: EndpointTrial[] = [];
const observations: string[] = [];
const openQuestions: string[] = [];

function requestString(res: CallRecord): string {
  const q = Object.entries(res.params).filter(([, v]) => v !== undefined).map(([k, v]) => `${k}=${v}`).join('&');
  return `GET ${res.endpoint}${q ? '?' + q : ''}`;
}
async function noteShape(res: CallResult, title: string, note?: string): Promise<void> {
  shapes.push({ id: res.id, title, request: requestString(res), status: res.status, count: res.count, shape: shapeOf(res.body), note });
  await saveSample(res, title);
}

// ---------------------------------------------------------------------------
// Probe sections
// ---------------------------------------------------------------------------

async function probeAuth(): Promise<void> {
  const ok = await call('auth.hackathon', '/search', { query: ANCHOR_ARTIST, types: 'urn:entity:artist', take: 2 });
  const prod = await call('auth.production', '/search', { query: ANCHOR_ARTIST, types: 'urn:entity:artist', take: 2 }, { base: PRODUCTION_BASE_URL });
  observations.push(`Hackathon base URL \`${BASE_URL}\` answered ${ok.status} with ${ok.count ?? 0} results; production base \`${PRODUCTION_BASE_URL}\` answered ${prod.status} (${errorMessage(prod.body) ?? 'no error body'}). A wrong base URL is the usual cause of 401.`);
  await noteShape(ok, '/search (artist)', 'Entity resolution. Note the `types` array on each result and the `disambiguation` string.');
  await noteShape(prod, '/search on the production base URL (expected rejection)');
}

async function probeSearchVariants(): Promise<void> {
  const variants: Array<[string, Params]> = [
    ['search.types-urn', { query: ANCHOR_ARTIST, types: 'urn:entity:artist', take: 3 }],
    ['search.types-short', { query: ANCHOR_ARTIST, types: 'artist', take: 3 }],
    ['search.filter-type', { query: ANCHOR_ARTIST, 'filter.type': 'urn:entity:artist', take: 3 }],
    ['search.no-types', { query: ANCHOR_ARTIST, take: 3 }],
  ];
  const rows: string[] = [];
  for (const [id, params] of variants) {
    const res = await call(id, '/search', params);
    const first = firstArray(res.body)[0];
    rows.push(`| \`${compactParams(params)}\` | ${res.status} | ${res.count ?? '-'} | ${first ? `${first.name} (${(first.types ?? []).join(', ')})` : errorMessage(res.body) ?? '-'} |`);
  }
  observations.push(['`/search` parameter variants (which `types` spelling works):', '', '| params | status | count | first result (types) |', '|---|---|---|---|', ...rows].join('\n'));
}

async function resolveArtist(id: string, query: string, market?: string): Promise<ArtistResolution> {
  const res = await call(id, '/search', { query, types: 'urn:entity:artist', take: 3 });
  const top = firstArray(res.body)[0];
  const found = nameMatches(query, top?.name);
  const r: ArtistResolution = {
    query,
    found,
    name: top?.name,
    entityId: top?.entity_id,
    popularity: typeof top?.popularity === 'number' ? top.popularity : undefined,
    disambiguation: top?.disambiguation,
    market,
  };
  artistResolutions.push(r);
  return r;
}

function localityCandidateOk(market: Market, cand: Json): boolean {
  const text = normalize(`${cand?.name ?? ''} ${cand?.disambiguation ?? ''}`);
  if (market.rejectHints.some((h) => text.includes(normalize(h)))) return false;
  return market.countryHints.some((h) => text.includes(normalize(h)));
}

/** Try the primary query and the fallbacks until a candidate sits in the right country; prefer an exact city-name match. */
async function resolveLocality(market: Market): Promise<LocalityResolution | undefined> {
  const attempts: string[] = [];
  const queries = [market.query, ...market.altQueries];
  let picked: LocalityResolution | undefined;
  for (let i = 0; i < queries.length && !picked; i++) {
    const q = queries[i];
    const res = await call(`locality.${market.slug}${i === 0 ? '' : `.alt${i}`}`, '/search', { query: q, types: 'urn:entity:locality', take: 5 });
    const cands = firstArray(res.body);
    attempts.push(`"${q}" -> ${cands.slice(0, 3).map((c: Json) => `${c.name} (${c.disambiguation ?? '?'})`).join('; ') || 'nothing'}`);
    const exact = cands.find((c: Json) => normalize(c?.name ?? '') === normalize(market.cityName) && localityCandidateOk(market, c));
    const pick = exact ?? cands.find((c: Json) => localityCandidateOk(market, c));
    if (pick) {
      const loc = pick.location ?? pick.properties?.geocode ?? {};
      picked = { name: pick.name, entityId: pick.entity_id, lat: loc.lat ?? loc.latitude, lon: loc.lon ?? loc.longitude, disambiguation: pick.disambiguation, matchedQuery: q };
    }
  }
  localityAttempts.push(`**${market.label}** -> ${picked ? `picked "${picked.name}" (${picked.disambiguation ?? '?'}) via query "${picked.matchedQuery}"` : 'NO acceptable candidate'}. Attempts: ${attempts.join(' | ')}`);
  return picked;
}

interface ResolvedTags { byQuery: Record<string, { id: string; name: string; type?: string } | undefined> }

async function probeTags(): Promise<ResolvedTags> {
  const out: ResolvedTags = { byQuery: {} };
  let first = true;
  for (const q of PLACE_TAG_QUERIES) {
    const res = await call(`tags.place.${q.replace(/\s+/g, '-')}`, '/v2/tags', { 'filter.query': q, 'filter.parents.types': 'urn:entity:place', take: 10 });
    const tags = firstArray(res.body);
    const hit = tags.find((t: Json) => normalize(t?.name ?? '') === normalize(q)) ?? tags[0];
    out.byQuery[q] = hit ? { id: hit.id ?? hit.tag_id, name: hit.name, type: hit.type ?? hit.subtype } : undefined;
    if (first) { await noteShape(res, '/v2/tags (place tags)', 'Tag resolution for place categories.'); first = false; }
  }
  const genre = await call('tags.music.reggaeton', '/v2/tags', { 'filter.query': 'reggaeton', 'filter.parents.types': 'urn:entity:artist', take: 10 });
  const g = firstArray(genre.body)[0];
  out.byQuery['reggaeton'] = g ? { id: g.id ?? g.tag_id, name: g.name, type: g.type ?? g.subtype } : undefined;
  await noteShape(genre, '/v2/tags (music genre)', 'Genre tag resolution for artists.');
  const resolved = Object.entries(out.byQuery).map(([q, t]) => `| ${q} | ${t ? `\`${t.id}\`` : 'not found'} | ${t?.name ?? '-'} | ${t?.type ?? '-'} |`);
  observations.push(['Tag IDs resolved through `/v2/tags` (used by the coverage calls below):', '', '| query | tag id | name | type |', '|---|---|---|---|', ...resolved].join('\n'));
  return out;
}

async function probeMarket(market: Market, anchorId: string, tags: ResolvedTags, globalBrandNames: string[], index: number): Promise<MarketCoverage> {
  const cov: MarketCoverage = {
    market, localityParamUsed: 'free-text query', placesById: null, placesByQuery: null, placesBaseline: null, placesPriceLevelPct: '-', placesRatingPct: '-', placeSamples: [],
    placesByTag: {}, brandsLoc: null, brandsLocSimilarityToGlobal: null, brandSamples: [], heatmapById: null, heatmapByQuery: null, heatmapByPoint: null,
    heatmapCellKeys: [], cityTags: null, cityTagSamples: [], cityArtists: null, cityArtistSamples: [], regional: [], regionalAffinity: null,
  };
  const s = market.slug;
  cov.locality = await resolveLocality(market);
  // Prefer the resolved locality entity id; fall back to the free-text query when /search found nothing acceptable.
  const locFilter: Params = cov.locality ? { 'filter.location': cov.locality.entityId } : { 'filter.location.query': market.query };
  const locSignal: Params = cov.locality ? { 'signal.location': cov.locality.entityId } : { 'signal.location.query': market.query };
  cov.localityParamUsed = cov.locality ? 'locality entity id' : 'free-text query';

  // Places with the anchor artist as taste signal: locality id vs. free-text query.
  let placeSource: CallResult | undefined;
  if (cov.locality) {
    const byId = await call(`places.${s}.by-id`, '/v2/insights', { 'filter.type': 'urn:entity:place', 'filter.location': cov.locality.entityId, 'signal.interests.entities': anchorId, take: 50, 'feature.explainability': true });
    cov.placesById = byId.count;
    placeSource = byId;
    if (index === 0) await noteShape(byId, `/v2/insights place, filter.location=<locality id> (${market.label})`, 'Places with artist signal, explainability on.');
  }
  const byQuery = await call(`places.${s}.by-query`, '/v2/insights', { 'filter.type': 'urn:entity:place', 'filter.location.query': market.query, 'signal.interests.entities': anchorId, take: 50 });
  cov.placesByQuery = byQuery.count;
  const resolvedByQuery = byQuery.body?.query?.localities?.filter?.[0];
  cov.queryResolvedTo = resolvedByQuery ? `${resolvedByQuery.name} (${resolvedByQuery.disambiguation ?? '?'})` : undefined;
  placeSource ??= byQuery;
  const placeItems = firstArray(placeSource.body);
  if (placeItems.length) {
    cov.placesPriceLevelPct = pct(placeItems.filter((p: Json) => p?.properties?.price_level != null).length, placeItems.length);
    cov.placesRatingPct = pct(placeItems.filter((p: Json) => p?.properties?.business_rating != null).length, placeItems.length);
    cov.placeSamples = names(placeSource.body).slice(0, 3);
  }
  if (index === 0) await noteShape(byQuery, `/v2/insights place, filter.location.query (${market.label})`);

  // Places without any taste signal (pure inventory).
  const baseline = await call(`places.${s}.baseline`, '/v2/insights', { 'filter.type': 'urn:entity:place', ...locFilter, take: 50 });
  cov.placesBaseline = baseline.count;
  cov.placesBaselineMessage = errorMessage(baseline.body);

  // Places by category tag.
  for (const q of COVERAGE_TAGS) {
    const tag = tags.byQuery[q];
    if (!tag) { cov.placesByTag[q] = null; continue; }
    const res = await call(`places.${s}.tag.${q.replace(/\s+/g, '-')}`, '/v2/insights', { 'filter.type': 'urn:entity:place', ...locFilter, 'filter.tags': tag.id, 'signal.interests.entities': anchorId, take: 50 });
    cov.placesByTag[q] = res.count;
  }

  // Brands with a location signal: does geography change the ranking at all?
  let brands = await call(`brands.${s}`, '/v2/insights', { 'filter.type': 'urn:entity:brand', 'signal.interests.entities': anchorId, ...locSignal, take: 20 });
  if (!brands.count && cov.locality) {
    observations.push(`${market.label}: brands with \`signal.location=<locality id>\` returned ${brands.count ?? 0} results (status ${brands.status}${errorMessage(brands.body) ? `, ${errorMessage(brands.body)}` : ''}); retried with \`signal.location.query\`.`);
    brands = await call(`brands.${s}.by-query`, '/v2/insights', { 'filter.type': 'urn:entity:brand', 'signal.interests.entities': anchorId, 'signal.location.query': market.query, take: 20 });
  }
  cov.brandsLoc = brands.count;
  cov.brandSamples = names(brands.body).slice(0, 3);
  cov.brandsLocSimilarityToGlobal = brands.count ? jaccard(names(brands.body), globalBrandNames) : null;

  // Heatmap: locality id vs. locality query vs. WKT point + radius.
  if (cov.locality) {
    const hmId = await call(`heatmap.${s}.by-id`, '/v2/insights', { 'filter.type': 'urn:heatmap', 'filter.location': cov.locality.entityId, 'signal.interests.entities': anchorId });
    cov.heatmapById = hmId.count;
  }
  const hmQuery = await call(`heatmap.${s}.by-query`, '/v2/insights', { 'filter.type': 'urn:heatmap', 'filter.location.query': market.query, 'signal.interests.entities': anchorId });
  cov.heatmapByQuery = hmQuery.count;
  const hmPoint = await call(`heatmap.${s}.by-point`, '/v2/insights', { 'filter.type': 'urn:heatmap', 'filter.location': `POINT(${market.lon} ${market.lat})`, 'filter.location.radius': 25000, 'signal.interests.entities': anchorId });
  cov.heatmapByPoint = hmPoint.count;
  const cell = firstArray(hmQuery.body)[0] ?? firstArray(hmPoint.body)[0];
  cov.heatmapCellKeys = cell?.query ? Object.keys(cell.query) : cell ? Object.keys(cell) : [];
  if (index === 0) {
    await noteShape(hmQuery, `/v2/insights heatmap, filter.location.query (${market.label})`);
    await noteShape(hmPoint, `/v2/insights heatmap, filter.location=POINT + radius (${market.label})`);
  }

  // City taste profile: tags and artists with the city as the only signal (locality id first, free text as fallback).
  let cityTags = await call(`citytags.${s}`, '/v2/insights', { 'filter.type': 'urn:tag', ...locSignal, 'filter.parents.types': 'urn:entity:artist', take: 20 });
  if (!cityTags.count && cov.locality) {
    observations.push(`${market.label}: tags with \`signal.location=<locality id>\` returned ${cityTags.count ?? 0} results (status ${cityTags.status}${errorMessage(cityTags.body) ? `, ${errorMessage(cityTags.body)}` : ''}); retried with \`signal.location.query\`.`);
    cityTags = await call(`citytags.${s}.by-query`, '/v2/insights', { 'filter.type': 'urn:tag', 'signal.location.query': market.query, 'filter.parents.types': 'urn:entity:artist', take: 20 });
  }
  cov.cityTags = cityTags.count;
  cov.cityTagSamples = names(cityTags.body).slice(0, 5);
  let cityArtists = await call(`cityartists.${s}`, '/v2/insights', { 'filter.type': 'urn:entity:artist', ...locSignal, take: 20 });
  if (!cityArtists.count && cov.locality) {
    observations.push(`${market.label}: artists with \`signal.location=<locality id>\` returned ${cityArtists.count ?? 0} results (status ${cityArtists.status}${errorMessage(cityArtists.body) ? `, ${errorMessage(cityArtists.body)}` : ''}); retried with \`signal.location.query\`.`);
    cityArtists = await call(`cityartists.${s}.by-query`, '/v2/insights', { 'filter.type': 'urn:entity:artist', 'signal.location.query': market.query, take: 20 });
  }
  cov.cityArtists = cityArtists.count;
  cov.cityArtistSamples = names(cityArtists.body).slice(0, 5);
  if (index === 0) {
    await noteShape(cityTags, `/v2/insights tag, signal.location (${market.label})`, 'City taste profile as music tags.');
    await noteShape(cityArtists, `/v2/insights artist, signal.location (${market.label})`, 'Artists with affinity to the city.');
  }

  // Regional artists: resolution plus whether Qloo has an affinity graph for the first one found.
  for (const a of market.artists) cov.regional.push(await resolveArtist(`artist.${s}.${normalize(a).replace(/\s+/g, '-')}`, a, market.label));
  const firstFound = cov.regional.find((r) => r.found && r.entityId);
  if (firstFound?.entityId) {
    const sim = await call(`similar.${s}`, '/v2/insights', { 'filter.type': 'urn:entity:artist', 'signal.interests.entities': firstFound.entityId, take: 10, 'feature.explainability': true });
    cov.regionalAffinity = { artist: firstFound.name ?? firstFound.query, count: sim.count };
  }
  return cov;
}

async function probeGlobalShapes(anchorId: string, secondId: string | undefined, tags: ResolvedTags): Promise<string[]> {
  const similar = await call('similar.anchor', '/v2/insights', { 'filter.type': 'urn:entity:artist', 'signal.interests.entities': anchorId, take: 10, 'feature.explainability': true });
  await noteShape(similar, '/v2/insights artist -> artist with explainability', 'Lineup candidates. Look for the explainability block per entity.');

  const brands = await call('brands.anchor.global', '/v2/insights', { 'filter.type': 'urn:entity:brand', 'signal.interests.entities': anchorId, take: 20, 'feature.explainability': true });
  await noteShape(brands, '/v2/insights artist -> brand with explainability', 'Sponsor candidates, no location signal.');

  const demo = await call('demographics.anchor', '/v2/insights', { 'filter.type': 'urn:demographics', 'signal.interests.entities': anchorId });
  await noteShape(demo, '/v2/insights demographics (urn:demographics)', 'Age and gender affinity buckets for the artist audience.');

  const artistTags = await call('tags.anchor', '/v2/insights', { 'filter.type': 'urn:tag', 'signal.interests.entities': anchorId, take: 20 });
  await noteShape(artistTags, '/v2/insights artist -> tags', 'Artist taste profile as tags.');

  const hmDims = await call('heatmap.dimensions', '/v2/insights', { 'filter.type': 'urn:heatmap', 'filter.location.query': MARKETS[5].query, 'signal.interests.entities': anchorId, 'heatmap.dimensions': 'quality,popularity,price_level' });
  const hmPlain = records.find((r) => r.id === `heatmap.${MARKETS[5].slug}.by-query`);
  const dimCell = firstArray(hmDims.body)[0];
  observations.push(`Heatmap \`heatmap.dimensions=quality,popularity,price_level\` (as described in the kickoff brief) returned ${hmDims.count ?? 0} cells with status ${hmDims.status}; cell keys: ${dimCell ? JSON.stringify(Object.keys(dimCell.query ?? dimCell)) : 'none'}${hmPlain ? ` (plain heatmap for the same city: ${hmPlain.count ?? 0} cells)` : ''}.`);
  await noteShape(hmDims, '/v2/insights heatmap with heatmap.dimensions', 'Checks whether the dimensions parameter adds per-cell columns.');

  const hmSignalLoc = await call('heatmap.signal-location', '/v2/insights', { 'filter.type': 'urn:heatmap', 'signal.location.query': MARKETS[5].query, 'signal.interests.entities': anchorId });
  observations.push(`Heatmap with \`signal.location.query\` instead of \`filter.location.query\`: status ${hmSignalLoc.status}, ${hmSignalLoc.count ?? 0} cells${errorMessage(hmSignalLoc.body) ? ` (${errorMessage(hmSignalLoc.body)})` : ''}.`);

  const hmLocalityBoundary = await call('heatmap.boundary-locality', '/v2/insights', { 'filter.type': 'urn:heatmap', 'filter.location.query': MARKETS[5].query, 'signal.interests.entities': anchorId, 'output.heatmap.boundary': 'locality' });
  observations.push(`Heatmap with \`output.heatmap.boundary=locality\`: status ${hmLocalityBoundary.status}, ${hmLocalityBoundary.count ?? 0} cells${errorMessage(hmLocalityBoundary.body) ? ` (${errorMessage(hmLocalityBoundary.body)})` : ''}.`);
  if (hmLocalityBoundary.count) await noteShape(hmLocalityBoundary, '/v2/insights heatmap, output.heatmap.boundary=locality');

  const audTypes = await call('audiences.types', '/v2/audiences/types', { take: 50 });
  await noteShape(audTypes, '/v2/audiences/types');
  const firstType = firstArray(audTypes.body)[0];
  const typeId: string | undefined = firstType?.type ?? firstType?.id ?? firstType?.urn;
  if (typeId) {
    const aud = await call('audiences.list', '/v2/audiences', { 'filter.parents.types': typeId, take: 20 });
    await noteShape(aud, `/v2/audiences (filter.parents.types=${typeId})`);
    if (!aud.count) {
      const aud2 = await call('audiences.list-alt', '/v2/audiences', { 'filter.audience.types': typeId, take: 20 });
      await noteShape(aud2, `/v2/audiences (filter.audience.types=${typeId})`);
    }
  }

  const ent = await call('entities.anchor', '/entities', { entity_ids: anchorId });
  await noteShape(ent, '/entities?entity_ids=...', 'Entity details by ID (properties, external IDs, tags).');

  // Trends: /v2/trending exists and demands a signal plus a date window (first run showed the 400 message).
  const trending = await call('trending.anchor', '/v2/trending', { 'signal.interests.entities': anchorId, 'filter.type': 'urn:entity:artist', 'filter.start_date': '2025-01-01', 'filter.end_date': '2025-12-31', take: 5 });
  await noteShape(trending, '/v2/trending (artist, calendar year 2025)', 'Trend series for an entity. Path and required parameters confirmed live.');
  const trendingRecent = await call('trending.anchor-recent', '/v2/trending', { 'signal.interests.entities': anchorId, 'filter.type': 'urn:entity:artist', 'filter.start_date': '2026-08-01', 'filter.end_date': '2026-10-29', take: 5 });
  const trendingBrand = await call('trending.anchor-brand', '/v2/trending', { 'signal.interests.entities': anchorId, 'filter.type': 'urn:entity:brand', 'filter.start_date': '2025-01-01', 'filter.end_date': '2025-12-31', take: 5 });
  observations.push(`\`/v2/trending\` requires \`signal.interests.entities\`, \`filter.type\`, \`filter.start_date\` and \`filter.end_date\`. Calendar year 2025, artist: status ${trending.status}, ${trending.count ?? 0} results. Aug–Oct 2026, artist: status ${trendingRecent.status}, ${trendingRecent.count ?? 0} results (the series lags the present). 2025, brand: status ${trendingBrand.status}, ${trendingBrand.count ?? 0} results.`);

  const hmLocBoundary = await call('heatmap.boundary-urn-locality', '/v2/insights', { 'filter.type': 'urn:heatmap', 'filter.location.query': MARKETS[5].query, 'signal.interests.entities': anchorId, 'output.heatmap.boundary': 'urn:entity:locality' });
  await noteShape(hmLocBoundary, '/v2/insights heatmap, output.heatmap.boundary=urn:entity:locality', 'Heatmap aggregated by locality instead of geohash.');
  observations.push(`Heatmap with \`output.heatmap.boundary=urn:entity:locality\`: status ${hmLocBoundary.status}, ${hmLocBoundary.count ?? 0} results${errorMessage(hmLocBoundary.body) ? ` (${errorMessage(hmLocBoundary.body)})` : ''}.`);

  const cmpCity = await call('compare.artist-vs-city', '/v2/insights/compare', { 'a.signal.interests.entities': anchorId, 'b.signal.location.query': MARKETS[0].query, take: 10 });
  await noteShape(cmpCity, '/v2/insights/compare artist vs. city (b.signal.location.query)', 'Taste overlap between an artist audience and a city, as shared tags.');
  observations.push(`\`/v2/insights/compare\` artist vs. city (\`b.signal.location.query\`): status ${cmpCity.status}, ${cmpCity.count ?? 0} shared tags${errorMessage(cmpCity.body) ? ` (${errorMessage(cmpCity.body)})` : ''}.`);

  // Endpoints whose exact paths the brief asked us to confirm live.
  const trials: Array<[string, string, Params]> = [
    ['trends.v2-category', '/v2/trends/category', { type: 'urn:entity:artist', take: 5 }],
    ['trends.v2-trending', '/v2/trending', { 'filter.type': 'urn:entity:artist', take: 5 }],
    ['trends.v1-category', '/trends/category', { type: 'urn:entity:artist', take: 5 }],
    ['trends.v2-entity', '/v2/trends/entity', { entity_id: anchorId, start_date: '2026-08-01', end_date: '2026-10-29' }],
    ['trends.bias', '/v2/insights', { 'filter.type': 'urn:entity:artist', 'signal.interests.entities': anchorId, 'bias.trends': 'high', take: 5 }],
    ['compare.v2-artist', '/v2/insights/compare', { 'a.signal.interests.entities': anchorId, 'b.signal.interests.entities': secondId ?? anchorId, 'filter.type': 'urn:entity:artist', take: 5 }],
    ['compare.v2-tag', '/v2/insights/compare', { 'a.signal.interests.entities': anchorId, 'b.signal.interests.entities': secondId ?? anchorId, 'filter.type': 'urn:tag', take: 5 }],
    ['analysis.v1', '/analysis', { entity_ids: `${anchorId}${secondId ? ',' + secondId : ''}`, 'filter.type': 'urn:entity:artist', take: 5 }],
    ['analysis.v2', '/v2/analysis', { entity_ids: `${anchorId}${secondId ? ',' + secondId : ''}`, 'filter.type': 'urn:entity:artist', take: 5 }],
    ['analysis.v1-compare', '/analysis/compare', { 'entities.a': anchorId, 'entities.b': secondId ?? anchorId, 'filter.type': 'urn:entity:artist' }],
  ];
  for (const [id, endpoint, params] of trials) {
    const res = await call(id, endpoint, params);
    const first = firstArray(res.body)[0];
    endpointTrials.push({ id, endpoint, params: compactParams(params), status: res.status, count: res.count, message: errorMessage(res.body), keys: first ? Object.keys(first).join(', ') : res.body && typeof res.body === 'object' ? Object.keys(res.body).join(', ') : undefined });
    if (res.status === 200) await noteShape(res, `${endpoint} (${id})`);
  }

  // Error shapes for the mistakes the brief warns about.
  const bad: Array<[string, Params, string]> = [
    ['errors.type-music', { 'filter.type': 'urn:entity:music', 'signal.interests.entities': anchorId, take: 5 }, 'filter.type=urn:entity:music (should be artist)'],
    ['errors.type-food', { 'filter.type': 'urn:entity:food_and_drink', 'signal.interests.entities': anchorId, take: 5 }, 'filter.type=urn:entity:food_and_drink (should be place or brand)'],
    ['errors.no-type', { 'signal.interests.entities': anchorId, take: 5 }, 'missing filter.type'],
    ['errors.no-signal', { 'filter.type': 'urn:entity:artist', take: 5 }, 'no signal and no filter'],
    ['errors.bad-entity', { 'filter.type': 'urn:entity:artist', 'signal.interests.entities': 'not-a-real-id', take: 5 }, 'unknown entity id as signal'],
  ];
  const rows: string[] = [];
  for (const [id, params, label] of bad) {
    const res = await call(id, '/v2/insights', params);
    rows.push(`| ${label} | ${res.status} | ${res.count ?? '-'} | ${(errorMessage(res.body) ?? (res.count ? 'results returned, no error' : '-')).replace(/\|/g, '\\|')} |`);
  }
  observations.push(['Error behavior for common mistakes:', '', '| request | status | count | message |', '|---|---|---|---|', ...rows].join('\n'));

  // Parameter behavior per entity type: does the parameter change the result set, or is it silently ignored?
  const mx = MARKETS[5];
  const barTag = tags.byQuery['bar']?.id;
  const genreTag = tags.byQuery['reggaeton']?.id;
  const groups: Array<{ group: string; baseline: Params; experiments: Array<[string, Params]> }> = [
    {
      group: 'place (Mexico City, anchor artist signal)',
      baseline: { 'filter.type': 'urn:entity:place', 'filter.location.query': mx.query, 'signal.interests.entities': anchorId, take: 20 },
      experiments: [
        ['filter.price_level.min=3', { 'filter.price_level.min': 3 }],
        ['filter.price_level.max=1', { 'filter.price_level.max': 1 }],
        ['filter.popularity.min=0.8', { 'filter.popularity.min': 0.8 }],
        ['filter.rating.min=4.5', { 'filter.rating.min': 4.5 }],
        ['filter.tags=<bar>', barTag ? { 'filter.tags': barTag } : { 'filter.tags': 'urn:tag:unresolved' }],
        ['filter.exclude.tags=<bar>', barTag ? { 'filter.exclude.tags': barTag } : { 'filter.exclude.tags': 'urn:tag:unresolved' }],
        ['signal.demographics.age=36_to_55', { 'signal.demographics.age': '36_to_55' }],
        ['page=2', { page: 2 }],
        ['filter.bogus_parameter=1 (expect ignored)', { 'filter.bogus_parameter': 1 }],
      ],
    },
    {
      group: 'place by WKT point (Mexico City)',
      baseline: { 'filter.type': 'urn:entity:place', 'filter.location': `POINT(${mx.lon} ${mx.lat})`, 'filter.location.radius': 15000, 'signal.interests.entities': anchorId, take: 20 },
      experiments: [
        ['filter.location.radius=2000', { 'filter.location.radius': 2000 }],
        ['filter.location.radius=50000', { 'filter.location.radius': 50000 }],
      ],
    },
    {
      group: 'artist (anchor artist signal)',
      baseline: { 'filter.type': 'urn:entity:artist', 'signal.interests.entities': anchorId, take: 20 },
      experiments: [
        ['signal.demographics.age=36_to_55', { 'signal.demographics.age': '36_to_55' }],
        ['signal.demographics.age=24_and_younger', { 'signal.demographics.age': '24_and_younger' }],
        ['signal.demographics.gender=female', { 'signal.demographics.gender': 'female' }],
        ['signal.location.query=Mexico City', { 'signal.location.query': mx.query }],
        ['signal.location.query=Guatemala City', { 'signal.location.query': MARKETS[0].query }],
        ['filter.popularity.min=0.9', { 'filter.popularity.min': 0.9 }],
        ['filter.tags=<reggaeton>', genreTag ? { 'filter.tags': genreTag } : { 'filter.tags': 'urn:tag:unresolved' }],
        ['filter.location.query=Mexico City (expect ignored)', { 'filter.location.query': mx.query }],
        ['filter.price_level.min=3 (expect ignored)', { 'filter.price_level.min': 3 }],
      ],
    },
    {
      group: 'brand (anchor artist signal)',
      baseline: { 'filter.type': 'urn:entity:brand', 'signal.interests.entities': anchorId, take: 20 },
      experiments: [
        ['signal.demographics.age=36_to_55', { 'signal.demographics.age': '36_to_55' }],
        ['signal.demographics.gender=female', { 'signal.demographics.gender': 'female' }],
        ['signal.location.query=Mexico City', { 'signal.location.query': mx.query }],
        ['filter.popularity.min=0.5', { 'filter.popularity.min': 0.5 }],
        ['filter.location.query=Mexico City (expect ignored)', { 'filter.location.query': mx.query }],
      ],
    },
  ];
  let gi = 0;
  for (const g of groups) {
    gi++;
    const base = await call(`params.g${gi}.baseline`, '/v2/insights', g.baseline);
    const baseNames = names(base.body);
    paramExperiments.push({ group: g.group, label: 'baseline', id: base.id, count: base.count, status: base.status, similarity: null, verdict: '-' });
    let ei = 0;
    for (const [label, extra] of g.experiments) {
      ei++;
      const res = await call(`params.g${gi}.e${ei}`, '/v2/insights', { ...g.baseline, ...extra });
      const sim = res.status === 200 && base.status === 200 ? jaccard(names(res.body), baseNames) : null;
      let verdict: string;
      if (res.status !== 200) verdict = `error: ${errorMessage(res.body) ?? res.status}`;
      else if (sim === null) verdict = '-';
      else if (sim >= 0.999) verdict = 'no effect (identical results)';
      else if (sim >= 0.6) verdict = 'minor reordering / partial change';
      else verdict = 'changes results';
      paramExperiments.push({ group: g.group, label, id: res.id, count: res.count, status: res.status, similarity: sim, verdict });
    }
  }
  return names(brands.body);
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

function md(s: unknown): string {
  return String(s ?? '-').replace(/\|/g, '\\|').replace(/\n/g, ' ');
}
function table(headers: string[], rows: unknown[][]): string {
  return [`| ${headers.join(' | ')} |`, `|${headers.map(() => '---').join('|')}|`, ...rows.map((r) => `| ${r.map(md).join(' | ')} |`)].join('\n');
}
function fence(obj: unknown): string {
  return '```json\n' + JSON.stringify(obj, null, 2) + '\n```';
}
function n(v: number | null | undefined): string {
  return v === null || v === undefined ? '–' : String(v);
}

function renderFindings(coverage: MarketCoverage[], notes: string | null): string {
  const ok = records.filter((r) => r.status === 200).length;
  const latencies = records.filter((r) => r.status === 200).map((r) => r.ms).sort((a, b) => a - b);
  const median = latencies.length ? latencies[Math.floor(latencies.length / 2)] : 0;
  const p90 = latencies.length ? latencies[Math.floor(latencies.length * 0.9)] : 0;
  const rate = records.find((r) => r.rateHeaders && Object.keys(r.rateHeaders).length)?.rateHeaders;
  const now = new Date().toISOString();
  const fetched = records.map((r) => r.fetchedAt).filter((f) => f && f !== 'unknown').sort();
  const replayed = records.filter((r) => r.replayed).length;

  const out: string[] = [];
  out.push('# Qloo API findings (M0 probe)');
  out.push('');
  out.push(`Generated ${now} by \`scripts/qloo-probe.ts\` against \`${BASE_URL}\`. ${records.length} requests${replayed ? ` (${replayed} replayed from the local cache)` : ''}, ${ok} returned 200, median latency ${median} ms, p90 ${p90} ms. Responses fetched between ${fetched[0] ?? 'n/a'} and ${fetched[fetched.length - 1] ?? 'n/a'}. ${rate ? `Rate-limit headers seen: \`${JSON.stringify(rate)}\`.` : 'No rate-limit headers were returned on any response.'}`);
  out.push('');
  out.push('Everything below is observed behavior from live responses on the date above. Where the public docs or the kickoff brief disagree with what the API did, the API wins. Raw request log: `docs/qloo-probe-log.json`. Trimmed samples (test fixtures): `docs/qloo-samples/`. Full bodies: `.cache/qloo-probe/` (gitignored).');
  out.push('');

  // 1. Coverage
  out.push('## 1. Coverage table');
  out.push('');
  out.push('Anchor taste signal for every market: the resolved `' + ANCHOR_ARTIST + '` entity. "Locality resolved" is the `/search` locality the probe accepted after checking the country in its disambiguation (see the attempts list in Observations); "(id)" columns use `filter.location=<that entity id>`, "(query)" columns use `filter.location.query=<city, country>` and the next column shows what Qloo resolved that free text to. Bars, hotels, night clubs, concert halls and stadiums are `filter.tags` counts with the id filter; `take=50`, so 50 means "at least 50". Heatmap counts are geohash cells. "City artists/tags" use the city as the only signal (`signal.location=<id>`). "Regional resolved" counts the market\'s own artists found through `/search`; "Regional affinity" is the number of similar artists Qloo returns for the first regional artist found.');
  out.push('');
  out.push(table(
    ['Market', 'Locality resolved (id)', 'Free-text query resolved to', 'Places (id)', 'Places (query)', 'Places (no signal)', 'Bars', 'Hotels', 'Night clubs', 'Concert halls', 'Stadiums', 'Price level %', 'Rating %', 'Brands (loc.)', 'Heatmap (id)', 'Heatmap (query)', 'Heatmap (point 25 km)', 'City artists', 'City tags', 'Regional resolved', 'Regional affinity'],
    coverage.map((c) => [
      c.market.label,
      c.locality ? `${c.locality.name} (${c.locality.disambiguation ?? '?'})` : 'NOT FOUND',
      c.queryResolvedTo ?? '–',
      n(c.placesById), n(c.placesByQuery), c.placesBaseline === null ? (c.placesBaselineMessage ? `error: ${c.placesBaselineMessage}` : '–') : String(c.placesBaseline),
      n(c.placesByTag['bar']), n(c.placesByTag['hotel']), n(c.placesByTag['night club']), n(c.placesByTag['concert hall']), n(c.placesByTag['stadium']),
      c.placesPriceLevelPct, c.placesRatingPct,
      c.brandsLoc === null ? '–' : `${c.brandsLoc}${c.brandsLocSimilarityToGlobal !== null ? ` (J=${c.brandsLocSimilarityToGlobal.toFixed(2)})` : ''}`,
      n(c.heatmapById), n(c.heatmapByQuery), n(c.heatmapByPoint),
      n(c.cityArtists), n(c.cityTags),
      `${c.regional.filter((r) => r.found).length}/${c.regional.length}`,
      c.regionalAffinity ? `${c.regionalAffinity.count ?? 0} (${c.regionalAffinity.artist})` : '–',
    ]),
  ));
  out.push('');
  out.push('J = Jaccard similarity between the location-biased brand list and the global brand list for the same artist (1.00 means the location signal changed nothing).');
  out.push('');
  out.push('### Samples per market');
  out.push('');
  out.push(table(
    ['Market', 'Locality id', 'Location param used', 'Place samples (artist signal)', 'Brand samples (loc. signal)', 'City artist samples', 'City tag samples', 'Heatmap cell query keys'],
    coverage.map((c) => [c.market.label, c.locality?.entityId ?? '–', c.localityParamUsed, c.placeSamples.join('; ') || '–', c.brandSamples.join('; ') || '–', c.cityArtistSamples.join('; ') || '–', c.cityTagSamples.join('; ') || '–', c.heatmapCellKeys.join(', ') || '–']),
  ));
  out.push('');

  // 2. Artists
  out.push('## 2. Artist resolution through `/search`');
  out.push('');
  out.push('"Found" means the top result name matches the query after accent and case folding. Popularity is Qloo\'s 0–1 percentile.');
  out.push('');
  out.push('### Global and regional artists');
  out.push('');
  out.push(table(
    ['Query', 'Market', 'Found', 'Top result', 'Entity id', 'Popularity', 'Disambiguation'],
    artistResolutions.map((a) => [a.query, a.market ?? 'global', a.found ? 'yes' : 'NO', a.name ?? '–', a.entityId ?? '–', a.popularity !== undefined ? a.popularity.toFixed(3) : '–', a.disambiguation ?? '–']),
  ));
  out.push('');

  // 3. Parameter behavior
  out.push('## 3. Parameter behavior per entity type');
  out.push('');
  out.push('Each experiment adds one parameter to the group baseline. Similarity is the Jaccard index between result names with and without the parameter: 1.00 means the parameter was silently ignored.');
  out.push('');
  out.push(table(
    ['Group', 'Parameter', 'Status', 'Count', 'Similarity to baseline', 'Verdict'],
    paramExperiments.map((e) => [e.group, e.label, e.status, n(e.count), e.similarity === null ? '–' : e.similarity.toFixed(2), e.verdict]),
  ));
  out.push('');

  // 4. Endpoints to confirm
  out.push('## 4. Trends, compare, analysis endpoints (paths confirmed live)');
  out.push('');
  out.push(table(
    ['Probe', 'Endpoint', 'Params', 'Status', 'Count', 'Message / first result keys'],
    endpointTrials.map((t) => [t.id, t.endpoint, t.params, t.status, n(t.count), t.message ?? t.keys ?? '–']),
  ));
  out.push('');

  // 5. Observations
  out.push('## 5. Observations');
  out.push('');
  for (const o of observations) { out.push(o); out.push(''); }

  // 6. Shapes
  out.push('## 6. Endpoint response shapes (observed)');
  out.push('');
  out.push('Skeletons: values replaced by their JSON type, arrays reduced to their first item, short strings kept as examples. Full trimmed samples live in `docs/qloo-samples/<probe id>.json`.');
  out.push('');
  for (const s of shapes) {
    out.push(`### ${s.title}`);
    out.push('');
    out.push(`Probe \`${s.id}\` · status ${s.status} · ${s.count === null ? 'no results array' : `${s.count} results`}${s.note ? ` · ${s.note}` : ''}`);
    out.push('');
    out.push('```');
    out.push(s.request);
    out.push('```');
    out.push('');
    out.push(fence(s.shape));
    out.push('');
  }

  // 7. Open questions
  out.push('## 7. Open questions');
  out.push('');
  if (openQuestions.length === 0) out.push('- None recorded by the script. See analyst notes.');
  for (const q of openQuestions) out.push(`- ${q}`);
  out.push('');

  if (notes) {
    out.push('## 8. Analyst notes');
    out.push('');
    out.push(notes.trim());
    out.push('');
  }
  return out.join('\n');
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const started = Date.now();
  await mkdir(CACHE_DIR, { recursive: true });
  await mkdir(SAMPLES_DIR, { recursive: true });
  console.log(`Qloo probe against ${BASE_URL}\n`);

  await probeAuth();
  await probeSearchVariants();

  const globals: ArtistResolution[] = [];
  for (const a of GLOBAL_ARTISTS) globals.push(await resolveArtist(`artist.global.${normalize(a).replace(/\s+/g, '-')}`, a));
  const anchor = globals.find((g) => g.query === ANCHOR_ARTIST && g.found && g.entityId) ?? globals.find((g) => g.found && g.entityId);
  if (!anchor?.entityId) throw new Error('could not resolve any anchor artist; aborting');
  const second = globals.find((g) => g.query === SECOND_ARTIST && g.found && g.entityId);
  observations.push(`Anchor artist for all coverage calls: ${anchor.name} (\`${anchor.entityId}\`).`);

  const tags = await probeTags();
  const globalBrandNames = await probeGlobalShapes(anchor.entityId, second?.entityId, tags);

  // Disambiguation check: a bare city name without country.
  const bare = await call('locality.bare-panama-city', '/search', { query: 'Panama City', types: 'urn:entity:locality', take: 3 });
  const bareNames = firstArray(bare.body).map((e: Json) => `${e.name}${e.disambiguation ? ` (${e.disambiguation})` : ''}`);
  observations.push(`Locality disambiguation: \`/search?query=Panama City&types=urn:entity:locality\` returned: ${bareNames.join('; ') || 'nothing'}. Always pass "city, country" or use the locality entity id.`);

  const coverage = await pool(MARKETS, MARKET_CONCURRENCY, (m, i) => probeMarket(m, anchor.entityId as string, tags, globalBrandNames, i));

  observations.push(['Locality resolution attempts through `/search?types=urn:entity:locality` (query -> top 3 candidates), and which candidate the probe accepted:', '', ...localityAttempts.map((a) => `- ${a}`)].join('\n'));

  // Derived observations.
  const idBetter = coverage.filter((c) => (c.placesById ?? 0) > (c.placesByQuery ?? 0)).length;
  const queryBetter = coverage.filter((c) => (c.placesByQuery ?? 0) > (c.placesById ?? 0)).length;
  observations.push(`Places by locality id vs. by free-text query: id returned more in ${idBetter} markets, query in ${queryBetter}, equal in ${coverage.length - idBetter - queryBetter}.`);
  const noHeatmap = coverage.filter((c) => !c.heatmapById && !c.heatmapByQuery && !c.heatmapByPoint).map((c) => c.market.label);
  if (noHeatmap.length) openQuestions.push(`No heatmap cells for: ${noHeatmap.join(', ')}. Check whether a larger radius or a polygon helps before ruling these markets out.`);
  const noLocality = coverage.filter((c) => !c.locality).map((c) => c.market.label);
  if (noLocality.length) openQuestions.push(`Locality not found through /search for: ${noLocality.join(', ')}.`);
  const missing = artistResolutions.filter((a) => !a.found);
  if (missing.length) openQuestions.push(`${missing.length} of ${artistResolutions.length} artist queries did not resolve to a matching top result: ${missing.map((m) => m.query).join(', ')}.`);
  const failed = records.filter((r) => r.status !== 200);
  observations.push(`${failed.length} of ${records.length} requests returned a non-200 status (expected ones included: production base URL, invalid types, missing signals, path trials).`);

  const notes = existsSync(NOTES_FILE) ? await readFile(NOTES_FILE, 'utf8') : null;
  const findings = renderFindings(coverage, notes);
  await writeAtomic(FINDINGS_FILE, findings, (s) => { if (!s.includes('## 1. Coverage table')) throw new Error('findings missing coverage table'); });
  await writeAtomic(LOG_FILE, JSON.stringify({ generatedAt: new Date().toISOString(), baseUrl: BASE_URL, requests: records }, null, 2), (s) => void JSON.parse(s));

  console.log(`\nDone in ${Math.round((Date.now() - started) / 1000)} s. ${records.length} requests. Wrote ${path.relative(ROOT, FINDINGS_FILE)}, ${path.relative(ROOT, LOG_FILE)}, ${shapes.length} samples in ${path.relative(ROOT, SAMPLES_DIR)}/.`);
}

main().catch((err) => {
  console.error('probe failed:', err instanceof Error ? err.message : err);
  process.exit(1);
});
