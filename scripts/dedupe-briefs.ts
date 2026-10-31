/**
 * CLI: find briefs that repeat the same artist in the same locality and keep
 * the most complete one of each group.
 *
 *   pnpm briefs:dedupe            # dry run: prints the groups and what would go
 *   pnpm briefs:dedupe --yes      # backs the losers up to .cache/backups and deletes them
 *
 * Completeness, in order: status (complete > partial > failed), fewer missing
 * sections, more grounded items, more cited sources, longer Markdown, newest.
 * Runs and agent events go with their brief (cascade). Reads the local env
 * file for DATABASE_URL and never prints it.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { parseArgs } from 'node:util';
import postgres from 'postgres';

try {
	process.loadEnvFile?.(path.resolve(process.cwd(), '.env'));
} catch {
	// No local env file: rely on the process environment.
}

const { values } = parseArgs({
	options: { yes: { type: 'boolean', default: false }, help: { type: 'boolean', default: false } }
});
if (values.help) {
	console.error('Usage: pnpm briefs:dedupe [--yes]');
	process.exit(0);
}
const url = process.env.DATABASE_URL;
if (!url) {
	console.error('DATABASE_URL is not set');
	process.exit(2);
}

interface Row {
	id: string;
	status: string;
	artist_name: string;
	city: string | null;
	market_id: string | null;
	locality_entity_id: string | null;
	created_at: Date;
	missing: number;
	grounded: number;
	sources: number;
	md_len: number;
}

const sql = postgres(url, { ssl: url.includes('localhost') ? false : 'require', max: 1 });
const rows = await sql<Row[]>`
	select b.id, b.status, b.artist_name, b.city, b.market_id, b.locality_entity_id, b.created_at,
		coalesce(jsonb_array_length(b.brief->'run'->'missingSections'), 0)::int as missing,
		(select count(*) from regexp_matches(b.brief::text, '"label":\\s*"grounded"', 'g'))::int as grounded,
		(select count(*) from regexp_matches(b.brief::text, '"sources":\\s*\\[\\s*"', 'g'))::int as sources,
		coalesce(length(b.markdown), 0)::int as md_len
	from briefs b
	order by b.created_at`;

const STATUS_RANK: Record<string, number> = { complete: 3, partial: 2, failed: 1, running: 0, queued: 0 };
const normalize = (s: string) =>
	s
		.normalize('NFD')
		.replace(/[̀-ͯ]/g, '')
		.toLowerCase()
		.replace(/\s+/g, ' ')
		.trim();
const groupKey = (r: Row) =>
	`${normalize(r.artist_name)}|${r.locality_entity_id ?? r.market_id ?? normalize(r.city ?? '')}`;
const score = (r: Row) => [
	STATUS_RANK[r.status] ?? 0,
	-r.missing,
	r.grounded,
	r.sources,
	r.md_len,
	r.created_at.getTime()
];
const better = (a: Row, b: Row) => {
	const sa = score(a);
	const sb = score(b);
	for (let i = 0; i < sa.length; i++) if (sa[i] !== sb[i]) return sa[i] > sb[i];
	return false;
};

const groups = new Map<string, Row[]>();
for (const r of rows) groups.set(groupKey(r), [...(groups.get(groupKey(r)) ?? []), r]);
const losers: Row[] = [];
for (const [key, g] of groups) {
	if (g.length < 2) continue;
	// Never delete a brief that is still running or waiting.
	const settled = g.filter((r) => r.status !== 'running' && r.status !== 'queued');
	if (settled.length < 2) continue;
	const keeper = settled.reduce((best, r) => (better(r, best) ? r : best));
	console.log(`\n${key} (${g.length} briefs)`);
	for (const r of settled) {
		const mark = r === keeper ? 'keep  ' : 'delete';
		console.log(
			`  ${mark} ${r.id}  ${r.status.padEnd(8)} missing=${r.missing} grounded=${r.grounded} sources=${r.sources} md=${r.md_len} created=${r.created_at.toISOString().slice(0, 16)}`
		);
		if (r !== keeper) losers.push(r);
	}
}
if (!losers.length) {
	console.log('No duplicates.');
} else if (!values.yes) {
	console.log(`\nDry run: ${losers.length} brief(s) would be deleted. Re-run with --yes to apply.`);
} else {
	const ids = losers.map((r) => r.id);
	const backup = {
		takenAt: new Date().toISOString(),
		briefs: await sql`select * from briefs where id in ${sql(ids)}`,
		runs: await sql`select * from brief_runs where brief_id in ${sql(ids)}`,
		events: await sql`select e.* from agent_events e join brief_runs r on r.id = e.run_id where r.brief_id in ${sql(ids)}`
	};
	const dir = path.resolve(process.cwd(), '.cache/backups');
	await mkdir(dir, { recursive: true });
	const file = path.join(dir, `briefs-dedupe-${backup.takenAt.replace(/[:.]/g, '-')}.json`);
	await writeFile(file, JSON.stringify(backup, null, 2));
	console.log(`\nBacked up ${backup.briefs.length} briefs, ${backup.runs.length} runs, ${backup.events.length} events to ${file}`);
	const deleted = await sql`delete from briefs where id in ${sql(ids)} returning id`;
	console.log(`Deleted ${deleted.length} brief(s): ${deleted.map((d) => d.id).join(', ')}`);
}
await sql.end();
