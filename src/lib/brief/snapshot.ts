/**
 * The decision snapshot at the top of a brief: six lines a promoter can read in under a minute.
 * Every line is derived from fields already in the brief record; nothing here calls a model or
 * invents a number, and anything the brief does not carry renders as "Not available". Pure,
 * shared by the UI component and the Markdown renderer.
 */
import { rankNeighbourhoods } from './neighbourhoods';
import type { Brief, Label, PromoterInputs } from './schema';
import { VERDICT_LABEL, VERDICT_NEXT_STEP, type Verdict } from './verdict';

export const NOT_AVAILABLE = 'Not available';
export const SPONSOR_SUFFIX = 'audience affinity only; interest not confirmed';

/** The five sections whose labels say how much cultural evidence the brief rests on. */
export const CULTURAL_SECTIONS = [
	'audience',
	'demandAndFit',
	'lineup',
	'sponsors',
	'venuesAndPartners'
] as const;

export type CulturalEvidence = 'strong' | 'mixed' | 'sparse';

export interface SnapshotLine {
	text: string;
	label?: Label;
	/** Tool call ids behind the line, for the [S#] marks. */
	sources: string[];
}

export interface DecisionSnapshot {
	verdict: Verdict;
	/** Verdict label plus one clause from the headline. */
	assessment: string;
	headlineClause: string;
	strongestSignal: SnapshotLine & {
		kind: 'taste_match' | 'neighbourhood' | 'brand' | 'none';
	};
	topSponsor: (SnapshotLine & { name: string; affinity?: number }) | undefined;
	/** Deterministic, from what the promoter did not supply. */
	unknowns: string[];
	nextStep: string;
	confidence: {
		cultural: CulturalEvidence;
		grounded: number;
		noCoverage: number;
		culturalText: string;
		businessText: string;
	};
}

const pct = (v: number): string => `${Math.round(v * 100)}%`;

const CLAUSE_MAX = 160;

/**
 * One clause from the headline. Headlines usually read "Artist in City: claim — more claims";
 * the first clause after the colon is the claim, unless there is no title part.
 */
export function headlineClause(headline: string): string {
	const parts = headline
		.split(/\s+[—–]\s+|:\s+|;\s+|\s+\|\s+|\s+-\s+/)
		.map((s) => s.trim())
		.filter(Boolean);
	if (parts.length === 0) return '';
	let clause = parts[0];
	// "Artist in City (dates)" or a two-word label before the colon is a title, not the claim.
	const titleLike =
		parts.length > 1 &&
		parts[0].length < 70 &&
		(/\b(in|at)\b/i.test(parts[0]) || parts[0].split(/\s+/).length <= 3);
	if (titleLike) clause = parts[1];
	clause = clause.replace(/[.\s]+$/, '');
	if (clause.length > CLAUSE_MAX) {
		const cut = clause.slice(0, CLAUSE_MAX);
		clause = `${cut.slice(0, Math.max(cut.lastIndexOf(' '), 40))}…`;
	}
	return clause.charAt(0).toUpperCase() + clause.slice(1);
}

/** What the promoter did not supply, named by the real promoterInputs fields. */
export function criticalUnknowns(promoter: PromoterInputs | undefined): string[] {
	const out = ['Artist fee and availability: not in the data; request a quote and a hold.'];
	const hasCapacity = (promoter?.venues ?? []).some((v) => typeof v.capacity === 'number');
	if (!hasCapacity)
		out.push('Venue capacity: no venue with a capacity was supplied (venues[].capacity).');
	if (!promoter?.pastSales?.length)
		out.push('Comparable sales history: no past sales were supplied (pastSales).');
	if (!promoter?.ticketPriceRange)
		out.push('Ticket price range: no range was supplied (ticketPriceRange).');
	return out;
}

export function buildDecisionSnapshot(brief: Brief): DecisionSnapshot {
	const { draft, artifacts, input } = brief;
	const verdict = draft.verdict;
	const clause = headlineClause(draft.headline);
	const assessment = clause
		? `${VERDICT_LABEL[verdict]}. ${clause}.`
		: `${VERDICT_LABEL[verdict]}.`;

	// Strongest cultural signal, in order of preference, from grounded data that is present.
	let strongestSignal: DecisionSnapshot['strongestSignal'] = {
		kind: 'none',
		text: NOT_AVAILABLE,
		sources: []
	};
	const taste = draft.demandAndFit.tasteMatch;
	if (taste && typeof taste.score === 'number' && taste.label === 'grounded') {
		strongestSignal = {
			kind: 'taste_match',
			text: `Taste match with the city ${pct(taste.score)}`,
			label: 'grounded',
			sources: [
				artifacts.artistTags?.source.toolCallId,
				artifacts.cityTags?.source.toolCallId
			].filter((x): x is string => !!x)
		};
	} else if (
		artifacts.neighbourhoods &&
		artifacts.neighbourhoods.items.length > 0 &&
		draft.audience.note.label === 'grounded'
	) {
		const ranking = rankNeighbourhoods(artifacts.neighbourhoods.items);
		const top = ranking.items[0];
		strongestSignal = {
			kind: 'neighbourhood',
			text: ranking.flat
				? `Broad audience affinity across ${ranking.items.length} neighbourhoods at about ${pct(top.affinity)}, with no meaningful differentiation`
				: `Strongest neighbourhood: ${top.name}, affinity ${pct(top.affinity)}`,
			label: 'grounded',
			sources: [artifacts.neighbourhoods.source.toolCallId]
		};
	} else {
		const brand = draft.sponsors.picks.find(
			(p) => p.label === 'grounded' && typeof p.affinity === 'number'
		);
		if (brand) {
			strongestSignal = {
				kind: 'brand',
				text: `Top brand affinity: ${brand.name} ${pct(brand.affinity as number)}`,
				label: 'grounded',
				sources: brand.sources
			};
		}
	}

	const sponsor = draft.sponsors.picks.find((p) => p.label === 'grounded');
	const topSponsor = sponsor
		? {
				name: sponsor.name,
				affinity: sponsor.affinity,
				text: `${sponsor.name}${typeof sponsor.affinity === 'number' ? ` (affinity ${pct(sponsor.affinity)})` : ''}, ${SPONSOR_SUFFIX}`,
				label: 'grounded' as const,
				sources: sponsor.sources
			}
		: undefined;

	let grounded = 0;
	let noCoverage = 0;
	for (const section of CULTURAL_SECTIONS) {
		const label = draft[section].note.label;
		if (label === 'grounded') grounded++;
		if (label === 'no_coverage') noCoverage++;
	}
	const total = CULTURAL_SECTIONS.length;
	const cultural: CulturalEvidence =
		grounded === total ? 'strong' : noCoverage >= 2 || grounded <= 2 ? 'sparse' : 'mixed';
	const culturalText = `Cultural evidence ${cultural}: ${grounded} of ${total} sections grounded${
		noCoverage ? `, ${noCoverage} with no coverage` : ''
	}.`;
	const businessText = input.promoter?.pastSales?.length
		? 'Business case not validated: promoter-supplied sales history is in the inputs but was not verified.'
		: 'Business case not validated: no sales history, fee, capacity or cost data in this brief.';

	return {
		verdict,
		assessment,
		headlineClause: clause,
		strongestSignal,
		topSponsor,
		unknowns: criticalUnknowns(input.promoter),
		nextStep: VERDICT_NEXT_STEP[verdict],
		confidence: { cultural, grounded, noCoverage, culturalText, businessText }
	};
}
