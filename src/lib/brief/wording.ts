/**
 * Product wording: the data provider is named only where provenance is shown (sources, trace,
 * about page, footer). Prose the model writes, and briefs stored before this rule, may still name
 * it; these helpers rewrite that prose to "the taste graph" at read time. Pure, shared by server
 * and tests.
 */

/** Keys whose values are identifiers, urls or tool names, never prose. */
const SKIP_KEYS = new Set([
	'id',
	'entityId',
	'entity_id',
	'toolCallId',
	'url',
	'key',
	'sources',
	'tool',
	'endpoint',
	'params',
	'requestKey'
]);

const RULES: [RegExp, string][] = [
	[/\bQloo's\b/g, "the taste graph's"],
	[/\bQloo\b/g, 'the taste graph']
];

/** "according to Qloo's data" -> "according to the taste graph's data"; sentence starts keep a capital. */
export function neutralizeProvider(text: string): string {
	if (!text.includes('Qloo')) return text;
	let out = text;
	for (const [re, to] of RULES) out = out.replace(re, to);
	return out.replace(/(^|[.!?]\s+|\n\s*)the taste graph/g, '$1The taste graph');
}

/** Deep copy with every prose string rewritten; identifiers, urls and tool names untouched. */
export function neutralizeProse<T>(value: T): T {
	if (typeof value === 'string') return neutralizeProvider(value) as T;
	if (Array.isArray(value)) return value.map((v) => neutralizeProse(v)) as T;
	if (value && typeof value === 'object') {
		const out: Record<string, unknown> = {};
		for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
			out[k] = SKIP_KEYS.has(k) ? v : neutralizeProse(v);
		}
		return out as T;
	}
	return value;
}
