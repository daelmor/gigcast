/**
 * CLI: build a Booking Brief from the terminal and print it as Markdown.
 *
 *   pnpm brief --city "Guatemala City" --country GT --artist "Ricardo Arjona" \
 *              --from 2026-11-20 --to 2026-11-22 [--mode live|replay|refresh] \
 *              [--model claude-opus-4-6] [--effort high] [--out .cache/briefs] [--json]
 *
 * Reads the local env file (never printed), streams the agent trace to stderr,
 * writes brief JSON, events and Markdown to the output directory and prints
 * the Markdown (or JSON with --json) to stdout.
 */
import { mkdir, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { renderBriefMarkdown } from '../src/lib/brief/markdown.ts';
import { briefInputSchema, type BriefInput } from '../src/lib/brief/schema.ts';
import type { AgentEvent } from '../src/lib/brief/events.ts';
import { runBrief, type Effort } from '../src/lib/server/agent/run.ts';
import { createQlooClient, type QlooMode } from '../src/lib/server/qloo/index.ts';

try {
	process.loadEnvFile?.(path.resolve(process.cwd(), '.env'));
} catch {
	// No local env file: rely on the process environment.
}

const { values } = parseArgs({
	options: {
		city: { type: 'string' },
		country: { type: 'string' },
		artist: { type: 'string' },
		from: { type: 'string' },
		to: { type: 'string' },
		mode: { type: 'string' },
		model: { type: 'string' },
		effort: { type: 'string', default: 'high' },
		out: { type: 'string', default: '.cache/briefs' },
		json: { type: 'boolean', default: false },
		quiet: { type: 'boolean', default: false },
		'max-tool-calls': { type: 'string' },
		help: { type: 'boolean', default: false }
	}
});

if (values.help || !values.city || !values.artist) {
	console.error(
		'Usage: pnpm brief --city "<city>" --country <ISO2> --artist "<name>" [--from YYYY-MM-DD --to YYYY-MM-DD] [--mode live|replay|refresh] [--model id] [--effort low|medium|high|max] [--out dir] [--json] [--quiet]'
	);
	process.exit(values.help ? 0 : 2);
}

const today = new Date();
const plus = (days: number) => new Date(today.getTime() + days * 86_400_000).toISOString().slice(0, 10);

const inputResult = briefInputSchema.safeParse({
	artist: values.artist,
	city: values.city,
	country: values.country ?? 'GT',
	dateFrom: values.from ?? plus(60),
	dateTo: values.to ?? plus(62)
} satisfies BriefInput);
if (!inputResult.success) {
	console.error('Invalid input:', inputResult.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '));
	process.exit(2);
}
const input = inputResult.data;

const mode = (values.mode as QlooMode | undefined) ?? undefined;
const qloo = createQlooClient({ mode });

const log = (line: string) => {
	if (!values.quiet) process.stderr.write(line + '\n');
};

const started = Date.now();
const onEvent = (event: AgentEvent) => {
	const t = `${String(Math.round((Date.now() - started) / 1000)).padStart(4)}s`;
	switch (event.type) {
		case 'run.started':
			log(`${t} run ${event.runId} on ${event.model} (${event.kind})`);
			break;
		case 'tool_call.started':
			log(`${t} -> ${event.tool} ${JSON.stringify(event.input).slice(0, 160)}`);
			break;
		case 'tool_call.finished':
			log(`${t} <- ${event.tool} ${event.ok ? 'ok' : 'FAILED'}: ${event.summary} [${event.durationMs} ms]`);
			break;
		case 'assistant.text':
			log(`${t} assistant: ${event.text.slice(0, 300)}`);
			break;
		case 'section.ready':
			log(`${t} section ready: ${event.section}`);
			break;
		case 'brief.complete':
			log(`${t} brief ${event.briefId} ${event.status}`);
			break;
		case 'error':
			log(`${t} ${event.fatal ? 'FATAL' : 'warning'}: ${event.message}`);
			break;
	}
};

async function writeAtomic(file: string, content: string): Promise<void> {
	await mkdir(path.dirname(file), { recursive: true });
	const tmp = `${file}.${process.pid}.tmp`;
	await writeFile(tmp, content, 'utf8');
	await rename(tmp, file);
}

const { brief, events } = await runBrief({
	input,
	qloo,
	model: values.model,
	effort: values.effort as Effort,
	maxToolCalls: values['max-tool-calls'] ? Number(values['max-tool-calls']) : undefined,
	onEvent
});

const markdown = renderBriefMarkdown(brief);
const outDir = path.resolve(process.cwd(), values.out as string);
await writeAtomic(path.join(outDir, `${brief.id}.json`), JSON.stringify(brief, null, 2));
await writeAtomic(path.join(outDir, `${brief.id}.events.json`), JSON.stringify(events, null, 2));
await writeAtomic(path.join(outDir, `${brief.id}.md`), markdown);

const u = brief.run.usage;
log('');
log(
	`status ${brief.run.status} | tool calls ${brief.run.toolCalls} | qloo calls ${brief.run.qlooCalls} (${brief.run.qlooCacheHits} cache hits) | tokens in ${u.inputTokens} out ${u.outputTokens} cache read ${u.cacheReadInputTokens} cache write ${u.cacheCreationInputTokens} | downgraded ${brief.verification.downgraded.length}/${brief.verification.checked} | ${Math.round((Date.now() - started) / 1000)} s`
);
if (brief.run.missingSections.length) log(`missing sections: ${brief.run.missingSections.join(', ')}`);
log(`written to ${outDir}/${brief.id}.{json,events.json,md}`);

process.stdout.write(values.json ? JSON.stringify(brief, null, 2) : markdown);
process.stdout.write('\n');
