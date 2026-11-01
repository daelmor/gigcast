/**
 * Product wording, applied to stored prose at read time. Pure, shared by server and tests.
 *
 * Two rule sets:
 * 1. The data provider is named only where provenance is shown (sources, trace, about page,
 *    footer). Prose the model writes, and briefs stored before this rule, may still name it;
 *    `neutralizeProvider` rewrites that prose to "the taste graph".
 * 2. Affinity is cultural overlap, not demand, price, fee or commitment. `calibrateClaims`
 *    rewrites the worst overclaims the planner used to write (sponsor drafts that "are producing"
 *    a concert, "willingness to pay" read off a price-level affinity, "the audience lives here").
 *    The list is short and precise on purpose: a safety net for briefs stored before the prompt
 *    said otherwise, not a style engine. Negated, honest uses ("not willingness to pay") are left
 *    alone.
 */

/** Keys whose values are identifiers, urls or tool names, never prose. */
const SKIP_KEYS = new Set([
	'id',
	'entityId',
	'entity_id',
	'toolCallId',
	'url',
	'sourceUrl',
	'key',
	'sources',
	'tool',
	'endpoint',
	'params',
	'requestKey'
]);

const PROVIDER_RULES: [RegExp, string][] = [
	[/\bQloo's\b/g, "the taste graph's"],
	[/\bQloo\b/g, 'the taste graph']
];

/** "according to Qloo's data" -> "according to the taste graph's data"; sentence starts keep a capital. */
export function neutralizeProvider(text: string): string {
	if (!text.includes('Qloo')) return text;
	let out = text;
	for (const [re, to] of PROVIDER_RULES) out = out.replace(re, to);
	return out.replace(/(^|[.!?]\s+|\n\s*)the taste graph/g, '$1The taste graph');
}

/**
 * Overclaim rewrites. Each rule names the claim it removes; the replacement keeps the sentence
 * grammatical and says what the data supports instead.
 */
export const CLAIM_RULES: ReadonlyArray<{ name: string; re: RegExp; to: string }> = [
	{
		// A sponsor draft must not present the concert as booked.
		name: 'producing -> exploring',
		re: /\b(we|We) are (?:producing|organizing|organising|planning|hosting) (a|an|the|this|our)\b/g,
		to: '$1 are exploring $2 potential'
	},
	{
		name: 'bringing -> exploring bringing',
		re: /\b(we|We) are bringing\b/g,
		to: '$1 are exploring bringing'
	},
	{
		// Price-level affinity is consumption context, not a ticket-price curve; negations stay.
		name: 'willingness to pay -> price-level affinity',
		re: /(?<!\b(?:not|nor|never) (?:a |an |the )?)\bwillingness[- ]to[- ]pay\b/gi,
		to: 'price-level affinity'
	},
	{
		// Affinity concentrates somewhere; it does not say where people live.
		name: 'audience lives -> affinity concentrates',
		re: /\baudience lives (?=(?:here|in|around|across|near|along|north|south|east|west)\b)/gi,
		to: 'audience affinity concentrates '
	},
	{
		name: 'deep demand -> strong cultural affinity',
		re: /\bdeep (hometown |local |home-market |home market )?demand\b/gi,
		to: 'strong $1cultural affinity'
	},
	{
		name: 'accepts premium prices -> affinity for premium price levels',
		re: /\baccepts? premium prices?\b/gi,
		to: 'shows affinity for premium price levels'
	},
	{
		// Fees are not in the data; "cost-effective" only ever meant lower popularity.
		name: 'cost-effective opener -> lower-popularity opener',
		re: /\bcost-effective ((?:\w+ )?opener)\b/gi,
		to: 'lower-popularity $1 (fee unknown)'
	},
	{
		name: 'will sponsor -> sponsorship prospect',
		re: /\bwill sponsor\b/gi,
		to: 'may be a sponsorship prospect'
	}
];

/** Rewrite the overclaims listed in CLAIM_RULES; everything else is untouched. */
export function calibrateClaims(text: string): string {
	let out = text;
	for (const rule of CLAIM_RULES) out = out.replace(rule.re, rule.to);
	return out;
}

/** Both passes on one string. */
export function calibrateText(text: string): string {
	return calibrateClaims(neutralizeProvider(text));
}

function walk<T>(value: T, fn: (text: string) => string): T {
	if (typeof value === 'string') return fn(value) as T;
	if (Array.isArray(value)) return value.map((v) => walk(v, fn)) as T;
	if (value && typeof value === 'object') {
		const out: Record<string, unknown> = {};
		for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
			out[k] = SKIP_KEYS.has(k) ? v : walk(v, fn);
		}
		return out as T;
	}
	return value;
}

/** Deep copy with the provider name rewritten in every prose string; identifiers, urls and tool names untouched. */
export function neutralizeProse<T>(value: T): T {
	return walk(value, neutralizeProvider);
}

/** Deep copy with both the provider rule and the overclaim rules applied to every prose string. */
export function calibrateProse<T>(value: T): T {
	return walk(value, calibrateText);
}
