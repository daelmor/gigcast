/**
 * CLI: print the activity and run statistics that /admin shows.
 *
 *   pnpm stats            # tables on stdout
 *   pnpm stats --json     # the AdminStats object
 *
 * Reads the local env file for DATABASE_URL (never printed). The live queue
 * numbers are those of this process, not of the server: zero here.
 */
import path from 'node:path';
import { parseArgs } from 'node:util';
import { getAdminStats, type AdminStats } from '../src/lib/server/activity/stats.ts';

try {
	process.loadEnvFile?.(path.resolve(process.cwd(), '.env'));
} catch {
	// No local env file: rely on the process environment.
}

const { values } = parseArgs({ options: { json: { type: 'boolean', default: false } } });

const stats: AdminStats = await getAdminStats();
if (values.json) {
	console.log(JSON.stringify(stats, null, 2));
	process.exit(0);
}

const pad = (v: unknown, n: number, right = false) => {
	const s = v == null ? '' : String(v);
	return right ? s.padStart(n) : s.padEnd(n);
};
const sec = (s: number | null) => (s == null ? '' : `${Math.round(s)}s`);
const k = (n: number | null) => (n == null ? '' : `${(n / 1000).toFixed(1)}k`);
const pct = (r: number | null) => (r == null ? '' : `${Math.round(r * 100)}%`);

console.log(`gigcast stats · ${stats.generatedAt}\n`);

console.log('Window   Briefs  Complete  Partial  Failed  Visitors  Views  Bot hits  Refused');
for (const w of stats.windows) {
	console.log(
		`${pad(w.label, 8)} ${pad(w.briefs, 6, true)}  ${pad(w.complete, 8, true)}  ${pad(w.partial, 7, true)}  ${pad(w.failed, 6, true)}  ${pad(w.visitors, 8, true)}  ${pad(w.views, 5, true)}  ${pad(w.botHits, 8, true)}  ${pad(w.refused, 7, true)}`
	);
}

console.log('\nLast 14 days      Briefs  Visitors  Views');
for (const d of stats.days) {
	console.log(`${pad(d.day, 16)}  ${pad(d.briefs, 6, true)}  ${pad(d.visitors, 8, true)}  ${pad(d.views, 5, true)}`);
}

console.log('\nMarkets (30 days)          Briefs  Complete');
for (const m of stats.markets) {
	console.log(`${pad(m.name, 26)} ${pad(m.briefs, 6, true)}  ${pad(m.complete, 8, true)}`);
}

const r = stats.runs;
console.log(
	`\nMain runs (30 days): ${r.count} finished · median ${sec(r.medianSec)} · p90 ${sec(r.p90Sec)} · avg input ${k(r.avgInputTokens)} (+${k(r.avgCacheReadInputTokens)} cached) · avg output ${k(r.avgOutputTokens)} · avg tool calls ${r.avgToolCalls?.toFixed(1) ?? ''} · avg Qloo requests ${r.avgQlooCalls?.toFixed(1) ?? ''} · cache hits ${pct(r.cacheHitRate)}`
);

console.log('\nRecent briefs');
console.log(
	`${pad('id', 17)} ${pad('status', 8)} ${pad('artist', 22)} ${pad('city', 16)} ${pad('created', 16)} ${pad('wait', 5, true)} ${pad('run', 5, true)} ${pad('in', 7, true)} ${pad('cached', 7, true)} ${pad('out', 6, true)} ${pad('qloo', 5, true)} ${pad('hits', 5, true)}`
);
for (const b of stats.recentBriefs) {
	console.log(
		`${pad(b.id, 17)} ${pad(b.status, 8)} ${pad(b.artistName, 22)} ${pad(b.city, 16)} ${pad(b.createdAt.slice(5, 16), 16)} ${pad(sec(b.waitedSec), 5, true)} ${pad(sec(b.durationSec), 5, true)} ${pad(k(b.inputTokens), 7, true)} ${pad(k(b.cacheReadInputTokens), 7, true)} ${pad(k(b.outputTokens), 6, true)} ${pad(b.qlooCalls, 5, true)} ${pad(b.qlooCacheHits, 5, true)}${b.error ? `  ${b.error.slice(0, 60)}` : ''}`
	);
}

console.log('\nTop pages (7 days)                 Hits');
for (const p of stats.topPaths) console.log(`${pad(p.path, 34)} ${pad(p.hits, 5, true)}`);
console.log('\nReferrers (7 days)                 Hits');
for (const h of stats.referrers) console.log(`${pad(h.host, 34)} ${pad(h.hits, 5, true)}`);
console.log('\n404 paths (7 days)                 Hits');
for (const p of stats.notFound) console.log(`${pad(p.path, 34)} ${pad(p.hits, 5, true)}`);
process.exit(0);
