import { briefSchema, type Brief, type SourceRef } from '../schema';

const ARTIST_ID = 'CA98034C-6AD8-44AA-898E-038495C4E116';
const LOCALITY_ID = '3E843C82-ACFE-48BB-9C76-FC9A2781530D';
const FETCHED_AT = '2026-10-30T14:02:11.000Z';

function ref(tool: string, toolCallId: string, query: string, cacheHit = false): SourceRef {
	return {
		tool,
		toolCallId,
		endpoint: '/v2/insights',
		requestKey: `/v2/insights?${query}`,
		cacheHit,
		fetchedAt: FETCHED_AT
	};
}

const heatmapRef = ref(
	'qloo_heatmap',
	'toolu_01A',
	`filter.location=${LOCALITY_ID}&filter.type=urn%3Aheatmap&signal.interests.entities=${ARTIST_ID}`
);
const demographicsRef = ref(
	'qloo_demographics',
	'toolu_01B',
	`filter.type=urn%3Ademographics&signal.interests.entities=${ARTIST_ID}`,
	true
);
const trendingRef = ref(
	'qloo_trending',
	'toolu_01C',
	`filter.type=urn%3Aentity%3Aartist&signal.interests.entities=${ARTIST_ID}&take=3`
);
const cityTagsRef = ref(
	'qloo_city_tags',
	'toolu_01D',
	`filter.type=urn%3Atag&signal.location=${LOCALITY_ID}&take=10`
);
const artistTagsRef = ref(
	'qloo_artist_tags',
	'toolu_01E',
	`filter.type=urn%3Atag&signal.interests.entities=${ARTIST_ID}&take=10`,
	true
);
const lineupRef = ref(
	'qloo_similar_artists',
	'toolu_01F',
	`filter.type=urn%3Aentity%3Aartist&signal.interests.entities=${ARTIST_ID}&take=10`
);
const sponsorRef = ref(
	'qloo_brands',
	'toolu_01G',
	`filter.type=urn%3Aentity%3Abrand&signal.interests.entities=${ARTIST_ID}&signal.location=${LOCALITY_ID}&take=20`
);
const barsRef = ref(
	'qloo_places',
	'toolu_01H',
	`filter.type=urn%3Aentity%3Aplace&filter.location=${LOCALITY_ID}&filter.tags=urn%3Atag%3Agenre%3Aplace%3Abar&signal.interests.entities=${ARTIST_ID}&take=50`
);
const hotelsRef = ref(
	'qloo_places',
	'toolu_01I',
	`filter.type=urn%3Aentity%3Aplace&filter.location=${LOCALITY_ID}&filter.tags=urn%3Atag%3Agenre%3Aplace%3Ahotel&signal.interests.entities=${ARTIST_ID}&take=50`,
	true
);

const sponsorBody = (brand: string, angle: string) =>
	`Hola equipo de ${brand},\n\nEstamos organizando un concierto de Ricardo Arjona en Ciudad de Guatemala del 20 al 22 de noviembre de 2026. ${angle}\n\nNos gustaria compartir una propuesta de patrocinio con visibilidad en escenario, activaciones en el lobby y contenido digital. Podemos coordinar una llamada esta semana?\n\nSaludos cordiales,\nEquipo de produccion`;

const rawBrief: Brief = {
	version: 1,
	id: 'brief_01JBRIEFSAMPLE0001',
	createdAt: '2026-10-30T14:05:42.000Z',
	input: {
		artist: 'Ricardo Arjona',
		city: 'Guatemala City',
		country: 'GT',
		dateFrom: '2026-11-20',
		dateTo: '2026-11-22',
		promoter: {
			venues: [{ name: 'Estadio Cementos Progreso', capacity: 12000 }],
			ticketPriceRange: { min: 150, max: 900, currency: 'GTQ' },
			budget: { amount: 400000, currency: 'GTQ' },
			notes: 'Weekend run; the promoter prefers one anchor sponsor and one hospitality partner.'
		}
	},
	resolution: {
		artist: {
			entityId: ARTIST_ID,
			name: 'Ricardo Arjona',
			popularity: 0.93,
			disambiguation: 'Guatemalan singer-songwriter'
		},
		locality: {
			method: 'entity_id',
			entityId: LOCALITY_ID,
			name: 'Ciudad de Guatemala',
			disambiguation: 'Ciudad de Guatemala, Departamento de Guatemala, Guatemala',
			lat: 14.6349,
			lon: -90.5069,
			candidates: [
				{
					entityId: LOCALITY_ID,
					name: 'Ciudad de Guatemala',
					disambiguation: 'Ciudad de Guatemala, Departamento de Guatemala, Guatemala',
					acceptable: true
				},
				{
					entityId: '8A1F5E02-5C44-4C0B-9A57-2B7C0E6D9F11',
					name: 'Guatemala',
					disambiguation: 'Guatemala',
					acceptable: false
				}
			]
		}
	},
	draft: {
		headline: 'Arjona in Guatemala City: strong home-market demand with a clear sponsor fit',
		verdict: 'promising',
		keyPoints: [
			'Arjona is the top local artist in Guatemala City and his audience concentrates around Zona 10 and Zona 4.',
			'The core audience skews 35 to 54; the 25 to 34 band is the growth lever.',
			'Gaby Moreno is the strongest grounded co-headliner; the younger support slot is inferred only.',
			'Adidas, Puma and Converse show the highest brand affinity in the city.',
			'No risk layer exists in this build; check security and weather independently.'
		],
		audience: {
			note: {
				label: 'grounded',
				summary:
					'Qloo returned 855 heatmap cells for the locality with Arjona as the signal. Affinity peaks in the central business district and the historic centre.',
				caveats: ['Heatmap cells are coarse geohashes, not venue-level data.']
			},
			hotspots: [
				{
					name: 'Zona 10 (Zona Viva)',
					lat: 14.6007,
					lon: -90.5133,
					geohash: 'd4g8x3',
					why: 'Highest affinity cell with price-level data pointing to upper-mid spend.',
					label: 'grounded',
					sources: ['toolu_01A']
				},
				{
					name: 'Zona 4 (4 Grados Norte)',
					lat: 14.6232,
					lon: -90.5189,
					geohash: 'd4g8xk',
					why: 'Cultural cluster with high affinity and strong evening footfall.',
					label: 'grounded',
					sources: ['toolu_01A']
				},
				{
					name: 'Zona 1 (Centro Historico)',
					lat: 14.6407,
					lon: -90.5133,
					why: 'Older, broader audience; adjacent cells carry above-average affinity.',
					label: 'inferred',
					sources: ['toolu_01A']
				}
			]
		},
		demandAndFit: {
			note: {
				label: 'grounded',
				summary:
					'Arjona is highly popular locally and his tag profile overlaps strongly with the city. Demand is stable with a mild upward drift.',
				caveats: ['Trending series has only three points.']
			},
			popularity: 0.93,
			trend: {
				direction: 'rising',
				detail: 'Percentile climbed from 0.88 to 0.93 over the last three observations.',
				label: 'grounded'
			},
			demographics: {
				topAgeBuckets: ['35_to_44', '45_to_54', '30_to_34'],
				genderSkew: 'balanced',
				label: 'grounded'
			},
			tasteMatch: {
				score: 0.86,
				sharedTags: ['ballad', 'latin culture', 'guatemala'],
				detail: 'The city tag list and the artist tag list share three of the top five tags.',
				label: 'grounded'
			}
		},
		lineup: {
			note: {
				label: 'grounded',
				summary:
					'Two of three picks come from the similar-artist query with explainability. The third is the model suggestion for a younger opening slot.',
				caveats: ['Availability and fees were not checked.']
			},
			picks: [
				{
					entityId: '27B180A1-3E0A-4340-81A3-57FB51816E2D',
					name: 'Gaby Moreno',
					role: 'co_headliner',
					affinity: 0.89,
					why: 'Top local artist for the city and a close taste neighbour of Arjona.',
					label: 'grounded',
					sources: ['toolu_01F']
				},
				{
					entityId: 'DE6DDFEA-E568-47F6-9176-9AAFDAFD213C',
					name: 'Bohemia Suburbana',
					role: 'opener',
					affinity: 0.82,
					why: 'Local rock act with a shared audience in the 35 to 54 band.',
					label: 'grounded',
					sources: ['toolu_01F']
				},
				{
					entityId: 'B50AA982-30F0-437C-934A-EF7521E5D779',
					name: 'Viernes Verde',
					role: 'support',
					why: 'Younger local act that could widen the 25 to 34 share; the pairing is a model judgement.',
					label: 'inferred',
					sources: ['toolu_01F']
				}
			]
		},
		sponsors: {
			note: {
				label: 'grounded',
				summary:
					'Sportswear and lifestyle brands rank highest for Arjona fans in the city. Outreach drafts are starting points only.',
				caveats: ['Drafts are in Spanish and have not been reviewed by a human.']
			},
			picks: [
				{
					entityId: 'F3A10C55-1B2D-4E7A-8C10-6A5B1D0E7701',
					name: 'Adidas',
					affinity: 0.91,
					category: 'Sportswear',
					why: 'Top brand by affinity among Arjona fans in Guatemala City.',
					outreachDraft: {
						subject: 'Propuesta de patrocinio: Ricardo Arjona en Ciudad de Guatemala',
						body: sponsorBody('Adidas', 'Su marca tiene una afinidad muy alta con esta audiencia.')
					},
					label: 'grounded',
					sources: ['toolu_01G']
				},
				{
					entityId: 'F3A10C55-1B2D-4E7A-8C10-6A5B1D0E7702',
					name: 'Puma',
					affinity: 0.84,
					category: 'Sportswear',
					why: 'Second-ranked brand and a fit for the 25 to 34 growth segment.',
					outreachDraft: {
						subject: 'Colaboracion en el concierto de Ricardo Arjona',
						body: sponsorBody(
							'Puma',
							'Buscamos una marca que conecte con el publico de 25 a 34 anos.'
						)
					},
					label: 'grounded',
					sources: ['toolu_01G']
				},
				{
					entityId: 'F3A10C55-1B2D-4E7A-8C10-6A5B1D0E7703',
					name: 'Converse',
					affinity: 0.78,
					category: 'Footwear',
					why: 'Lifestyle fit with the cultural audience around Zona 4.',
					outreachDraft: {
						subject: 'Activacion de marca en el concierto de Arjona',
						body: sponsorBody(
							'Converse',
							'Imaginamos una activacion cultural en la zona de acceso.'
						)
					},
					label: 'grounded',
					sources: ['toolu_01G']
				}
			]
		},
		venuesAndPartners: {
			note: {
				label: 'grounded',
				summary:
					'Qloo has thin venue inventory for Guatemala City, so most picks are bars and hotels close to the hotspots.',
				caveats: ['Only one place of each kind was verified against Qloo results.']
			},
			picks: [
				{
					entityId: 'A1B2C3D4-0001-4000-8000-000000000001',
					name: 'Estadio Cementos Progreso',
					kind: 'venue',
					address: 'Zona 5, Ciudad de Guatemala',
					lat: 14.6258,
					lon: -90.5036,
					why: 'The promoter venue; capacity of 12,000 matches the demand estimate.',
					label: 'inferred',
					sources: ['toolu_01H']
				},
				{
					entityId: 'A1B2C3D4-0002-4000-8000-000000000002',
					name: 'Bazar Casa Vieja',
					kind: 'pre_party',
					address: 'Zona 10, Ciudad de Guatemala',
					priceLevel: 2,
					rating: 4.4,
					why: 'High-affinity bar near the top hotspot, suited to a pre-show activation.',
					label: 'grounded',
					sources: ['toolu_01H']
				},
				{
					entityId: 'A1B2C3D4-0003-4000-8000-000000000003',
					name: 'Hotel Camino Real',
					kind: 'hospitality',
					address: 'Zona 10, Ciudad de Guatemala',
					priceLevel: 4,
					rating: 4.5,
					why: 'Upscale hotel with strong affinity; candidate for artist and VIP packages.',
					label: 'grounded',
					sources: ['toolu_01I']
				},
				{
					entityId: 'A1B2C3D4-0004-4000-8000-000000000004',
					name: 'La Pradera',
					kind: 'bundle_partner',
					address: 'Zona 10, Ciudad de Guatemala',
					priceLevel: 3,
					why: 'Ticket and dinner bundle partner; plausible but not directly ranked by Qloo.',
					label: 'inferred',
					sources: ['toolu_01H']
				}
			]
		},
		pricing: {
			note: {
				label: 'inferred',
				summary:
					'Tiers sit inside the promoter range of GTQ 150 to 900 and weight capacity toward the mid tier, based on price-level affinity in the heatmap.',
				caveats: ['No past sales were provided, so the shares are assumptions.']
			},
			currency: 'GTQ',
			tiers: [
				{
					name: 'General',
					price: 250,
					share: 0.55,
					rationale: 'Broad 25 to 44 audience; mid price level dominates the heatmap.'
				},
				{
					name: 'Preferente',
					price: 500,
					share: 0.35,
					rationale: 'Core 35 to 54 fans in Zona 10 and Zona 4 show higher spend.'
				},
				{
					name: 'VIP',
					price: 900,
					share: 0.1,
					rationale: 'Hospitality bundle with the hotel partner.'
				}
			],
			assumptions: [
				'Capacity of 12,000 per night.',
				'Price level 3 to 4 cells correlate with VIP demand.'
			]
		},
		risks: {
			note: {
				label: 'no_coverage',
				summary: 'M1 has no risk layer; no news or advisory sources were queried.',
				caveats: []
			},
			items: []
		},
		openQuestions: [
			'Is the date window one show or a multi-night run?',
			'Does the promoter already have a title sponsor that conflicts with sportswear brands?'
		]
	},
	artifacts: {
		calls: [],
		heatmap: {
			cells: [
				{
					geohash: 'd4g8x3',
					lat: 14.6007,
					lon: -90.5133,
					affinity: 0.97,
					popularity: 0.61,
					quality: 0.7,
					priceLevel: 0.64
				},
				{
					geohash: 'd4g8xk',
					lat: 14.6232,
					lon: -90.5189,
					affinity: 0.94,
					popularity: 0.55,
					quality: 0.68,
					priceLevel: 0.51
				},
				{
					geohash: 'd4g8xs',
					lat: 14.6407,
					lon: -90.5133,
					affinity: 0.9,
					popularity: 0.4,
					quality: 0.6,
					priceLevel: 0.33
				},
				{
					geohash: 'd4g8x9',
					lat: 14.5905,
					lon: -90.5133,
					affinity: 0.86,
					popularity: 0.3,
					quality: 0.62,
					priceLevel: 0.45
				},
				{
					geohash: 'd4g8xq',
					lat: 14.6349,
					lon: -90.5069,
					affinity: 0.8,
					popularity: 0.28,
					quality: null,
					priceLevel: 0.29
				},
				{
					geohash: 'd4g8xm',
					lat: 14.6258,
					lon: -90.5036,
					affinity: 0.75,
					popularity: null,
					quality: null,
					priceLevel: null
				}
			],
			hasDimensions: true,
			source: heatmapRef
		},
		demographics: {
			age: {
				'24_and_younger': -0.12,
				'25_to_29': 0.08,
				'30_to_34': 0.21,
				'35_to_44': 0.42,
				'45_to_54': 0.33,
				'55_and_older': 0.05
			},
			gender: { male: 0.04, female: 0.06 },
			source: demographicsRef
		},
		trending: {
			items: [
				{ date: '2026-10-16', percentile: 0.88, rank: 12, velocity: 0.01 },
				{ date: '2026-10-23', percentile: 0.9, rank: 10, velocity: 0.02 },
				{ date: '2026-10-30', percentile: 0.93, rank: 8, velocity: 0.03 }
			],
			source: trendingRef
		},
		cityTags: {
			items: [
				{ id: 'urn:tag:keyword:qloo:guatemala', name: 'guatemala', affinity: 0.9 },
				{ id: 'urn:tag:genre:media:ballad', name: 'Ballad', affinity: 0.7 },
				{ id: 'urn:tag:keyword:qloo:latin_culture', name: 'Latin Culture', affinity: 0.6 }
			],
			source: cityTagsRef
		},
		artistTags: {
			items: [
				{ id: 'urn:tag:genre:media:ballad', name: 'Ballad', affinity: 0.95 },
				{ id: 'urn:tag:genre:media:latin_pop', name: 'Latin Pop', affinity: 0.8 },
				{ id: 'urn:tag:keyword:qloo:guatemala', name: 'guatemala', affinity: 0.75 }
			],
			source: artistTagsRef
		},
		lineupCandidates: {
			items: [
				{
					entityId: '27B180A1-3E0A-4340-81A3-57FB51816E2D',
					name: 'Gaby Moreno',
					affinity: 0.89,
					popularity: 0.71,
					subtype: 'urn:entity:artist'
				},
				{
					entityId: 'DE6DDFEA-E568-47F6-9176-9AAFDAFD213C',
					name: 'Bohemia Suburbana',
					affinity: 0.82,
					popularity: 0.5
				},
				{
					entityId: 'B50AA982-30F0-437C-934A-EF7521E5D779',
					name: 'Viernes Verde',
					affinity: 0.64,
					popularity: 0.35
				},
				{
					entityId: 'E29B0DC4-D3B7-45C6-84E0-E3762FE14C67',
					name: 'Alux Nahual',
					affinity: 0.76,
					popularity: 0.45
				}
			],
			source: lineupRef
		},
		sponsorCandidates: {
			items: [
				{ entityId: 'F3A10C55-1B2D-4E7A-8C10-6A5B1D0E7701', name: 'Adidas', affinity: 0.91 },
				{ entityId: 'F3A10C55-1B2D-4E7A-8C10-6A5B1D0E7702', name: 'Puma', affinity: 0.84 },
				{ entityId: 'F3A10C55-1B2D-4E7A-8C10-6A5B1D0E7703', name: 'Converse', affinity: 0.78 },
				{ entityId: 'F3A10C55-1B2D-4E7A-8C10-6A5B1D0E7704', name: 'Vans', affinity: 0.7 }
			],
			source: sponsorRef
		},
		placeCandidates: [
			{
				kind: 'bar',
				items: [
					{
						entityId: 'A1B2C3D4-0002-4000-8000-000000000002',
						name: 'Bazar Casa Vieja',
						affinity: 0.8,
						priceLevel: 2,
						rating: 4.4,
						address: 'Zona 10, Ciudad de Guatemala'
					},
					{
						entityId: 'A1B2C3D4-0004-4000-8000-000000000004',
						name: 'La Pradera',
						affinity: 0.72,
						priceLevel: 3
					}
				],
				source: barsRef
			},
			{
				kind: 'hotel',
				items: [
					{
						entityId: 'A1B2C3D4-0003-4000-8000-000000000003',
						name: 'Hotel Camino Real',
						affinity: 0.77,
						priceLevel: 4,
						rating: 4.5
					},
					{ entityId: 'A1B2C3D4-0005-4000-8000-000000000005', name: 'Hotel Barcelo', affinity: 0.7 }
				],
				source: hotelsRef
			}
		]
	},
	verification: {
		checked: 12,
		downgraded: [
			{
				section: 'venuesAndPartners',
				entityId: 'A1B2C3D4-0001-4000-8000-000000000001',
				name: 'Estadio Cementos Progreso',
				reason: 'Entity id was not returned by the cited tool call; downgraded to inferred.'
			}
		]
	},
	run: {
		runId: 'run_01JRUNSAMPLE0001',
		kind: 'main',
		model: 'claude-sonnet-5-5',
		status: 'complete',
		startedAt: '2026-10-30T14:02:00.000Z',
		finishedAt: '2026-10-30T14:05:40.000Z',
		usage: {
			inputTokens: 48210,
			outputTokens: 6120,
			cacheReadInputTokens: 31000,
			cacheCreationInputTokens: 5200
		},
		toolCalls: 14,
		qlooCalls: 12,
		qlooCacheHits: 3,
		stopReason: 'end_turn',
		missingSections: ['risks']
	},
	counterfactual: {
		status: 'complete',
		model: 'claude-opus-4-6',
		run: {
			runId: 'run_01JRUNSAMPLE0002',
			kind: 'counterfactual',
			model: 'claude-opus-4-6',
			status: 'complete',
			startedAt: '2026-10-30T14:02:00.000Z',
			finishedAt: '2026-10-30T14:02:21.000Z',
			usage: {
				inputTokens: 1840,
				outputTokens: 1260,
				cacheReadInputTokens: 0,
				cacheCreationInputTokens: 0
			},
			toolCalls: 0,
			qlooCalls: 0,
			qlooCacheHits: 0,
			stopReason: 'end_turn',
			missingSections: []
		},
		draft: {
			lineup: [
				{
					name: 'Gaby Moreno',
					role: 'co_headliner',
					why: 'Guatemala most internationally known singer-songwriter, with a loyal home audience.',
					confidence: 'high'
				},
				{
					name: 'Ricardo Montaner',
					role: 'co_headliner',
					why: 'A Latin ballad figure whose audience probably overlaps with Arjona fans.',
					confidence: 'medium'
				},
				{
					name: 'Malacates Trebol Shop',
					role: 'opener',
					why: 'A long-running Guatemalan rock band that often opens large local shows.',
					confidence: 'medium'
				},
				{
					name: 'Alux Nahual',
					role: 'support',
					why: 'A classic national rock act; I am unsure whether it is currently active.',
					confidence: 'low'
				}
			],
			sponsors: [
				{
					name: 'Adidas',
					category: 'Sportswear',
					why: 'Global brand with a strong presence in Latin American live events.',
					confidence: 'medium'
				},
				{
					name: 'Coca-Cola',
					category: 'Beverages',
					why: 'Long history of concert sponsorship in Guatemala.',
					confidence: 'high'
				},
				{
					name: 'Banco Industrial',
					category: 'Banking',
					why: 'Largest local bank and a frequent sponsor of national cultural events.',
					confidence: 'medium'
				},
				{
					name: 'Tigo',
					category: 'Telecom',
					why: 'Leading mobile operator that tends to back large concerts.',
					confidence: 'low'
				}
			],
			caveats: [
				'I have no access to current audience data, so these picks come from general reputation.',
				'I cannot verify availability, recent activity or whether a brand matches this audience today.'
			]
		},
		matches: {
			lineup: [
				{
					entityId: '27B180A1-3E0A-4340-81A3-57FB51816E2D',
					qlooName: 'Gaby Moreno',
					affinity: 0.89,
					pickedByGroundedRun: true
				},
				{
					entityId: 'C0FFEE00-1111-4222-8333-444455556666',
					qlooName: 'Ricardo Montaner',
					affinity: 0.71,
					pickedByGroundedRun: false
				},
				{ pickedByGroundedRun: false },
				{ pickedByGroundedRun: false }
			],
			sponsors: [
				{
					entityId: 'F3A10C55-1B2D-4E7A-8C10-6A5B1D0E7701',
					qlooName: 'Adidas',
					affinity: 0.91,
					pickedByGroundedRun: true
				},
				{
					entityId: 'C0FFEE00-2222-4222-8333-444455556666',
					qlooName: 'Coca-Cola',
					affinity: 0.62,
					pickedByGroundedRun: false
				},
				{ pickedByGroundedRun: false },
				{ pickedByGroundedRun: false }
			]
		},
		summary: {
			lineupTotal: 4,
			lineupInQloo: 2,
			lineupOverlap: 1,
			sponsorsTotal: 4,
			sponsorsInQloo: 2,
			sponsorsOverlap: 1
		}
	}
};

export const sampleBrief: Brief = briefSchema.parse(rawBrief);
