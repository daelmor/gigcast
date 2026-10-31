/**
 * Pre-computed "what changes when the agent has the taste graph" comparison, shown on /compare.
 *
 * Taken verbatim from one stored brief that still carries the counterfactual panel
 * (COUNTERFACTUAL_RUN was on when it ran). Both arms answered the same artist, city, dates and
 * model: the main run with the twelve typed tools, the model-alone run with no tools at all.
 * The match statuses were computed by src/lib/server/agent/counterfactual-compare.ts at the time
 * and are copied here untouched. Nothing on this page is recomputed per visit.
 *
 * Source numbers (S#) are the brief's own numbering (src/lib/components/brief/sources.ts), so
 * [S10] here is [S10] on the brief page.
 */
import type { CounterfactualDraft, CounterfactualMatch } from '../schema';

export interface ComparisonPick {
	name: string;
	role?: 'co_headliner' | 'opener' | 'support';
	category?: string;
	affinity?: number;
	label: 'grounded' | 'inferred' | 'no_coverage';
	/** Tags the taste graph attaches to the entity (first eight), not a similarity output. */
	tags: string[];
	/** [S#] numbers as on the brief page. */
	sourceNumbers: number[];
	why: string;
}

export interface ComparisonSource {
	n: number;
	tool: string;
	endpoint: string;
	requestKey: string;
	cacheHit: boolean;
	fetchedAt: string;
}

export interface ComparisonSnapshot {
	briefId: string;
	briefCreatedAt: string;
	/** YYYY-MM-DD of the run both arms belong to. */
	runDate: string;
	model: string;
	input: {
		artist: string;
		city: string;
		country: string;
		dateFrom: string;
		dateTo: string;
		localityName?: string;
	};
	resolution: { artist: string; locality: string };
	mainRun: {
		model: string;
		status: string;
		startedAt: string;
		finishedAt: string;
		toolCalls: number;
		qlooCalls: number;
	};
	counterfactualRun: { model: string; status: string; startedAt: string; finishedAt: string };
	grounded: { lineup: ComparisonPick[]; sponsors: ComparisonPick[] };
	modelAlone: CounterfactualDraft;
	/** Parallel to modelAlone.lineup and modelAlone.sponsors. */
	matches: { lineup: CounterfactualMatch[]; sponsors: CounterfactualMatch[] };
	summary: {
		lineupTotal: number;
		lineupInQloo: number;
		lineupOverlap: number;
		sponsorsTotal: number;
		sponsorsInQloo: number;
		sponsorsOverlap: number;
	};
	sources: ComparisonSource[];
	/** Size of the result lists the model-alone names were checked against. */
	candidatePool: { lineup: number; sponsors: number };
}

export const comparisonSnapshot: ComparisonSnapshot = {
	briefId: 'brief_EKSh8E9vLF',
	briefCreatedAt: '2026-10-30T18:43:21.597Z',
	runDate: '2026-10-30',
	model: 'claude-opus-4-6',
	input: {
		artist: 'Natalia Lafourcade',
		city: 'Mexico City',
		country: 'MX',
		dateFrom: '2027-03-05',
		dateTo: '2027-03-07',
		localityName: 'Ciudad de México'
	},
	resolution: {
		artist: 'Natalia Lafourcade',
		locality: 'Ciudad de México'
	},
	mainRun: {
		model: 'claude-opus-4-6',
		status: 'complete',
		startedAt: '2026-10-30T18:36:23.755Z',
		finishedAt: '2026-10-30T18:43:21.597Z',
		toolCalls: 22,
		qlooCalls: 20
	},
	counterfactualRun: {
		model: 'claude-opus-4-6',
		status: 'complete',
		startedAt: '2026-10-30T18:36:23.764Z',
		finishedAt: '2026-10-30T18:36:47.116Z'
	},
	grounded: {
		lineup: [
			{
				name: 'Julieta Venegas',
				role: 'co_headliner',
				affinity: 0.985,
				label: 'grounded',
				tags: [
					'Melodic',
					'Indie Pop',
					'Vocals',
					'Passionate',
					'Emotions',
					'Mercedes Sosa',
					'Engaged',
					'Self Discovery'
				],
				sourceNumbers: [8, 10, 11],
				why: "Highest affinity (0.985) among similar artists in CDMX. Comparison shows 15 shared tags with Natalia including Diverse, Latin, Engaging, Love, Passionate, Loyal, Guitar, Innovative, Authentic, Intimate, Melodic, and Self-discovery (scores 0.73). Julieta's unique tags (Introspective, Relationships, Mexican) complement rather than duplicate. She appears in CDMX's top-25 city artists (affinity 1.0). Genres: Latin Pop, Pop Rock, Alternative Rock."
			},
			{
				name: 'Mon Laferte',
				role: 'support',
				affinity: 0.982,
				label: 'grounded',
				tags: [
					'Latin',
					'Love',
					'Eclectic',
					'Latin Rock',
					'Indie Folk',
					'Indie Folk Fusion',
					'Diverse',
					'Social Issues'
				],
				sourceNumbers: [8, 10, 12],
				why: "Second-highest affinity (0.982). Comparison reveals 15 shared tags including Latin, Love, Guitar, Intimate, Melodic, Piano, Versatile, Expressive, and Emotive (scores 0.72-0.73). Mon's unique tags — Personal struggle, Heartbreak, Powerful, Charismatic — add emotional range and draw a slightly edgier crowd. Chilean origin provides geographic diversity. Genres: Latin Pop, Rock, Folk."
			},
			{
				name: 'Caloncho',
				role: 'opener',
				affinity: 0.978,
				label: 'grounded',
				tags: [
					'Vocals',
					'Indie',
					'Guitar',
					'Happiness',
					'Singer-Songwriter',
					'Indie Pop',
					'Love',
					'Warm'
				],
				sourceNumbers: [8, 10, 13],
				why: "Affinity 0.978. Comparison shows 15 shared tags: Diverse, Latin, Mexico, Engaging, Love, Passionate, Guitar, Intimate, Melodic, Nature, Alternative, Lively, Percussion (scores 0.56-0.73). Caloncho's unique tags — Positive, Indie, Happiness — set an upbeat, warm tone ideal for opening. Lower popularity (0.93) keeps costs manageable. Genres: Indie Pop, Latin Pop, Folk."
			},
			{
				name: 'El David Aguilar',
				role: 'opener',
				affinity: 0.976,
				label: 'grounded',
				tags: [
					'Expressive',
					'Engaging',
					'Guitar',
					'Love',
					'Intimate',
					'Latin Indie',
					'Social Issues',
					'Folk'
				],
				sourceNumbers: [10],
				why: "Affinity 0.976 with lower popularity (0.65), making him a cost-effective emerging opener. Genre profile — Latin, Folk, Singer-Songwriter from Culiacán — mirrors Natalia's acoustic sensibility. His smaller footprint warms the room without overshadowing the headliner."
			}
		],
		sponsors: [
			{
				name: 'Pineda Covalin',
				category: 'Fashion & Apparel / Art & Design',
				affinity: 0.947,
				label: 'grounded',
				tags: [
					'Casual',
					'Fashion',
					'Bold Geometric Patterns',
					'Saturated Color Palettes',
					'Traditional Motifs',
					'Lustrous Fabric Textures',
					'Sophisticated Drapes',
					'World Traveler'
				],
				sourceNumbers: [14, 15],
				why: "Affinity 0.947 in general audience, 0.927 among women 35-44. Mexican folk art fashion brand with MOMA and cultural institution partnerships. Direct cultural overlap with Natalia's identity — traditional Mexican aesthetics reimagined for contemporary audiences. Key markets: Mexico and United States. An on-site pop-up booth with limited-edition concert merchandise co-design is a natural activation."
			},
			{
				name: 'Pai Pai',
				category: 'Beauty & Personal Care / Cosmetics',
				affinity: 0.947,
				label: 'grounded',
				tags: [
					'Health & Beauty',
					'Artistic Illustration',
					'Vibrant Color Palette',
					'Modern Minimalism',
					'Tactile Packaging',
					'Artistic Living',
					'Conscious Consumption',
					'Cultural Pride'
				],
				sourceNumbers: [14, 15],
				why: "Top brand when filtering for women 35-44 (affinity 0.947). Mexican clean-beauty brand aligned with the audience's wellness and cultural values. On-site sampling stations and VIP gift bags are natural activations for a concert with this demographic."
			},
			{
				name: 'Ben & Frank',
				category: 'Fashion & Apparel / Eyewear',
				affinity: 0.941,
				label: 'grounded',
				tags: [
					'Eyewear',
					'Fashion',
					'Accessories',
					'Minimalist',
					'Colorful',
					'Contemporary',
					'Geometric',
					'Graphic'
				],
				sourceNumbers: [14, 15],
				why: "Affinity 0.941 overall, 0.925 among women 35-44. Mexican eyewear brand rooted in modern design and youth culture with Star Wars partnership history. High brand awareness among CDMX's creative class. Activation: branded photo booth or on-site try-on station."
			},
			{
				name: 'GNP Seguros',
				category: 'Finance / Insurance',
				affinity: 0.946,
				label: 'grounded',
				tags: [
					'Financial Services',
					'Professional',
					'Clean',
					'Corporate',
					'Accessible',
					'Financial Freedom',
					'Work-Life Balance',
					'Long-Term Stability'
				],
				sourceNumbers: [14],
				why: "Affinity 0.946 overall. Major Mexican insurance brand targeting middle-class families — aligns with Natalia's 35-44 core and mainstream reach. Higher budget potential than indie brands. Activation: title sponsor or ticket-insurance bundle."
			},
			{
				name: 'Rapsodia México',
				category: 'Fashion & Apparel / Home Goods',
				affinity: 0.948,
				label: 'grounded',
				tags: [
					'Casual',
					'Fashion',
					'Intricate Prints',
					'Earth Tones',
					'Textured Fabrics',
					'Embroidered Details',
					'Flowing Silhouettes',
					'Global Travel'
				],
				sourceNumbers: [14, 15],
				why: "Affinity 0.948 overall, 0.939 among women 35-44. Bohemian fashion brand with 'Artistic Lifestyle Culture' positioning — a natural aesthetic match for Natalia's folk-pop identity. Activation: branded lounge area with retail pop-up."
			}
		]
	},
	modelAlone: {
		lineup: [
			{
				name: 'Mon Laferte',
				role: 'co_headliner',
				why: 'Chilean-Mexican singer-songwriter with a similar Latin alternative/folk sensibility and a massive Mexican fanbase. The two have collaborated before and share overlapping audiences.',
				confidence: 'high'
			},
			{
				name: 'Silvana Estrada',
				role: 'support',
				why: "Rising Mexican folk/jazz vocalist whose intimate, acoustic style complements Lafourcade's sound perfectly and appeals to the same culturally-engaged audience.",
				confidence: 'high'
			},
			{
				name: 'Ed Maverick',
				role: 'support',
				why: "Young Mexican indie-folk artist from Chihuahua with a devoted Gen-Z following in Mexico City; his mellow guitar-driven songs fit the evening's tone.",
				confidence: 'medium'
			},
			{
				name: 'Carla Morrison',
				role: 'support',
				why: "Acclaimed Mexican indie-pop singer whose emotive ballads and Latin Grammy pedigree align well with Lafourcade's audience demographic.",
				confidence: 'high'
			},
			{
				name: 'Caloncho',
				role: 'opener',
				why: 'Mexican singer-songwriter blending folk, pop and tropical rhythms; a feel-good opener whose laid-back energy would warm up the crowd nicely.',
				confidence: 'medium'
			}
		],
		sponsors: [
			{
				name: 'Corona (Grupo Modelo)',
				category: 'Beer / Beverages',
				why: 'Iconic Mexican beer brand that regularly sponsors large-scale concerts and cultural events across Mexico; strong alignment with a proudly Mexican headliner.',
				confidence: 'high'
			},
			{
				name: 'Mastercard',
				category: 'Financial Services / Payments',
				why: "Mastercard has a well-known 'Priceless Experiences' music platform in Latin America and frequently sponsors premium concert events in Mexico City.",
				confidence: 'medium'
			},
			{
				name: 'Tequila Herradura',
				category: 'Premium Spirits',
				why: "Heritage Mexican tequila brand seeking upscale cultural positioning; Lafourcade's audience skews toward adults who appreciate artisanal Mexican products.",
				confidence: 'medium'
			},
			{
				name: 'Apple Music',
				category: 'Music Streaming',
				why: 'Apple Music has invested heavily in Latin music curation and could leverage the event for exclusive content or playlist promotion.',
				confidence: 'medium'
			},
			{
				name: 'Liverpool (El Puerto de Liverpool)',
				category: 'Retail / Department Store',
				why: 'Major Mexican retailer that sponsors entertainment and cultural events domestically; broad brand awareness and logistical presence in CDMX.',
				confidence: 'medium'
			}
		],
		caveats: [
			'I have no access to actual audience affinity data, ticket-buying demographics, or streaming overlap metrics for any of these artists.',
			'I cannot verify current touring schedules, exclusivity clauses, or artist availability for March 2027.',
			'Sponsor suitability depends on brand budgets, existing endorsement conflicts, and campaign calendars I have no visibility into.',
			'Venue size and format (arena vs. outdoor festival vs. theater) would significantly change which pairings make sense.',
			'Local market conditions, competing events in CDMX that weekend, and political/regulatory factors are unknown to me.'
		]
	},
	matches: {
		lineup: [
			{
				entityId: '85185E8B-ABB8-4602-B156-3F5AC935221A',
				qlooName: 'Mon Laferte',
				affinity: 0.982,
				pickedByGroundedRun: true
			},
			{
				pickedByGroundedRun: false
			},
			{
				pickedByGroundedRun: false
			},
			{
				entityId: 'A4C34902-0559-440F-A03E-31DBD6C45DBD',
				qlooName: 'Carla Morrison',
				affinity: 0.977,
				pickedByGroundedRun: false
			},
			{
				entityId: '7B2CAC5A-8398-4287-9024-431AA961D2FE',
				qlooName: 'Caloncho',
				affinity: 0.978,
				pickedByGroundedRun: true
			}
		],
		sponsors: [
			{
				pickedByGroundedRun: false
			},
			{
				pickedByGroundedRun: false
			},
			{
				pickedByGroundedRun: false
			},
			{
				pickedByGroundedRun: false
			},
			{
				pickedByGroundedRun: false
			}
		]
	},
	summary: {
		lineupTotal: 5,
		lineupInQloo: 3,
		lineupOverlap: 2,
		sponsorsTotal: 5,
		sponsorsInQloo: 0,
		sponsorsOverlap: 0
	},
	sources: [
		{
			n: 8,
			tool: 'qloo_city_taste',
			endpoint: '/v2/insights',
			requestKey:
				'/v2/insights?filter.parents.types=urn%3Aentity%3Aartist&filter.type=urn%3Atag&signal.location=6A479AAF-1D8D-4EA2-AC1E-29B0906063AC&take=25',
			cacheHit: false,
			fetchedAt: '2026-10-30T18:37:47.704Z'
		},
		{
			n: 10,
			tool: 'qloo_similar_artists',
			endpoint: '/v2/insights',
			requestKey:
				'/v2/insights?feature.explainability=true&filter.exclude.entities=7FDE68C0-E3AE-418B-8527-DBFA9F972971&filter.type=urn%3Aentity%3Aartist&signal.interests.entities=7FDE68C0-E3AE-418B-8527-DBFA9F972971&signal.location=6A479AAF-1D8D-4EA2-AC1E-29B0906063AC&take=15',
			cacheHit: false,
			fetchedAt: '2026-10-30T18:37:47.892Z'
		},
		{
			n: 11,
			tool: 'qloo_compare',
			endpoint: '/v2/insights/compare',
			requestKey:
				'/v2/insights/compare?a.signal.interests.entities=7FDE68C0-E3AE-418B-8527-DBFA9F972971&b.signal.interests.entities=9CA4C037-8CCA-4342-8315-00CAB34C081F&filter.type=urn%3Atag&take=20',
			cacheHit: false,
			fetchedAt: '2026-10-30T18:38:17.421Z'
		},
		{
			n: 12,
			tool: 'qloo_compare',
			endpoint: '/v2/insights/compare',
			requestKey:
				'/v2/insights/compare?a.signal.interests.entities=7FDE68C0-E3AE-418B-8527-DBFA9F972971&b.signal.interests.entities=85185E8B-ABB8-4602-B156-3F5AC935221A&filter.type=urn%3Atag&take=20',
			cacheHit: false,
			fetchedAt: '2026-10-30T18:38:34.152Z'
		},
		{
			n: 13,
			tool: 'qloo_compare',
			endpoint: '/v2/insights/compare',
			requestKey:
				'/v2/insights/compare?a.signal.interests.entities=7FDE68C0-E3AE-418B-8527-DBFA9F972971&b.signal.interests.entities=7B2CAC5A-8398-4287-9024-431AA961D2FE&filter.type=urn%3Atag&take=20',
			cacheHit: false,
			fetchedAt: '2026-10-30T18:38:17.405Z'
		},
		{
			n: 14,
			tool: 'qloo_brand_affinities',
			endpoint: '/v2/insights',
			requestKey:
				'/v2/insights?feature.explainability=true&filter.type=urn%3Aentity%3Abrand&signal.interests.entities=7FDE68C0-E3AE-418B-8527-DBFA9F972971&signal.location=6A479AAF-1D8D-4EA2-AC1E-29B0906063AC&take=20',
			cacheHit: false,
			fetchedAt: '2026-10-30T18:37:47.937Z'
		},
		{
			n: 15,
			tool: 'qloo_brand_affinities',
			endpoint: '/v2/insights',
			requestKey:
				'/v2/insights?feature.explainability=true&filter.type=urn%3Aentity%3Abrand&signal.demographics.age=35_to_44&signal.demographics.gender=female&signal.interests.entities=7FDE68C0-E3AE-418B-8527-DBFA9F972971&signal.location=6A479AAF-1D8D-4EA2-AC1E-29B0906063AC&take=10',
			cacheHit: false,
			fetchedAt: '2026-10-30T18:38:34.970Z'
		}
	],
	candidatePool: {
		lineup: 15,
		sponsors: 20
	}
};
