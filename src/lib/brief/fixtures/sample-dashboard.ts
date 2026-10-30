import { KNOWN_MARKETS } from '$lib/markets';
import { marketDashboardSchema, type MarketDashboard } from '$lib/api/contracts';
import type { ClassifiedNews } from '../schema';

/** Fixture dates are relative to load time so the feed filters (7/30/60 days) stay meaningful. */
const DAY = 86_400_000;
const NOW = Date.now();
const ago = (days: number): string => new Date(NOW - days * DAY).toISOString();

const gt = KNOWN_MARKETS.find((m) => m.id === 'guatemala-city');
if (!gt) throw new Error('guatemala-city missing from KNOWN_MARKETS');

type Seed = Omit<ClassifiedNews, 'id' | 'confidence' | 'affectedEntities'> & {
	affectedEntities?: string[];
};

const seeds: Seed[] = [
	{
		title: 'Estado de prevención en tres municipios por extorsiones a transportistas',
		url: 'https://www.prensalibre.com/guatemala/justicia/estado-de-prevencion-municipios-extorsiones/',
		source: 'Prensa Libre',
		publishedAt: ago(2),
		snippet: null,
		category: 'security',
		severity: 4,
		timeHorizon: 'ongoing',
		soWhat:
			'Checkpoints and curfews around the metro area can slow crowd arrival; plan extra security staffing and shuttle routes.',
		weight: 0.92,
		mentionsSubject: false
	},
	{
		title: 'Congreso aprueba reforma de ley electoral; partidos inician precampaña',
		url: 'https://republica.gt/congreso-aprueba-reforma-ley-electoral-precampana',
		source: 'República',
		publishedAt: ago(5),
		snippet: null,
		category: 'political_unrest_elections',
		severity: 3,
		timeHorizon: 'after_window',
		soWhat:
			'Campaign rallies may compete for venues and police resources in the new year; avoid dates near large party events.',
		weight: 0.71,
		mentionsSubject: false
	},
	{
		title: 'Conred alerta por lluvias intensas y posible depresión tropical en el Pacífico',
		url: 'https://www.prensalibre.com/guatemala/comunitario/conred-alerta-lluvias-intensas-depresion-tropical/',
		source: 'Prensa Libre',
		publishedAt: ago(1),
		snippet: null,
		category: 'weather_climate',
		severity: 4,
		timeHorizon: 'in_window',
		soWhat:
			'Heavy rain is forecast for the coming weekend; an open-air show needs a weather contingency and flexible gates.',
		weight: 0.95,
		mentionsSubject: false
	},
	{
		title: 'Ministerio de Salud confirma aumento de casos de dengue en la capital',
		url: 'https://www.soy502.com/articulo/salud-confirma-aumento-casos-dengue-capital',
		source: 'Soy502',
		publishedAt: ago(9),
		snippet: null,
		category: 'health',
		severity: 2,
		timeHorizon: 'ongoing',
		soWhat:
			'Low direct impact on attendance, but mosquito control at an outdoor venue is a reasonable ask of the operator.',
		weight: 0.5,
		mentionsSubject: false
	},
	{
		title: 'Cierre parcial de la Calzada Roosevelt por obras durante dos semanas',
		url: 'https://www.prensalibre.com/guatemala/comunitario/cierre-calzada-roosevelt-obras/',
		source: 'Prensa Libre',
		publishedAt: ago(4),
		snippet: null,
		category: 'transport',
		severity: 3,
		timeHorizon: 'in_window',
		soWhat:
			'A main access road to the west side is reduced to one lane; publish alternate routes and add rideshare drop zones.',
		weight: 0.74,
		mentionsSubject: false
	},
	{
		title: 'Anuncian gira de Ricardo Arjona: dos fechas confirmadas en el Domo Polideportivo',
		url: 'https://www.soy502.com/articulo/arjona-gira-fechas-domo-polideportivo',
		source: 'Soy502',
		publishedAt: ago(6),
		snippet: null,
		category: 'competing_events',
		severity: 3,
		timeHorizon: 'in_window',
		soWhat:
			'The artist already has dates announced in the market; a second show nearby can split demand and sponsor attention.',
		weight: 0.66,
		mentionsSubject: true,
		affectedEntities: ['Ricardo Arjona']
	},
	{
		title:
			'Festival de música electrónica se traslada al Parque de la Industria el 21 de noviembre',
		url: 'https://republica.gt/festival-musica-electronica-parque-de-la-industria-21-noviembre',
		source: 'República',
		publishedAt: ago(11),
		snippet: null,
		category: 'competing_events',
		severity: 2,
		timeHorizon: 'in_window',
		soWhat:
			'Different audience, but it competes for the same Saturday night and for event security providers.',
		weight: 0.42,
		mentionsSubject: false
	},
	{
		title: 'Quetzal estable frente al dólar; Banguat mantiene la tasa líder en 4.50 %',
		url: 'https://www.prensalibre.com/economia/banguat-mantiene-tasa-lider-4-50/',
		source: 'Prensa Libre',
		publishedAt: ago(14),
		snippet: null,
		category: 'economic_shock',
		severity: 1,
		timeHorizon: 'ongoing',
		soWhat:
			'No currency shock expected; USD-priced production costs should hold through the window.',
		weight: 0.3,
		mentionsSubject: false
	},
	{
		title: 'Municipalidad exigirá nuevo permiso de ruido y aforo para eventos masivos',
		url: 'https://republica.gt/municipalidad-nuevo-permiso-ruido-aforo-eventos-masivos',
		source: 'República',
		publishedAt: ago(18),
		snippet: null,
		category: 'permits_regulation',
		severity: 3,
		timeHorizon: 'after_window',
		soWhat:
			'Start the permit process early; the new rule adds a capacity inspection that may add one to two weeks.',
		weight: 0.55,
		mentionsSubject: false
	},
	{
		title: 'Corte de energía afecta zonas 10 y 13 por falla en subestación',
		url: 'https://www.soy502.com/articulo/corte-energia-zonas-10-13-falla-subestacion',
		source: 'Soy502',
		publishedAt: ago(23),
		snippet: null,
		category: 'venue_infrastructure',
		severity: 2,
		timeHorizon: 'past',
		soWhat:
			'Resolved within hours, but confirm that the venue has backup generation sized for the full production.',
		weight: 0.33,
		mentionsSubject: false
	},
	{
		title: 'Polémica por declaraciones de un cantante invitado en festival regional',
		url: 'https://www.prensalibre.com/vida/polemica-declaraciones-cantante-festival-regional/',
		source: 'Prensa Libre',
		publishedAt: ago(33),
		snippet: null,
		category: 'artist_controversy',
		severity: 2,
		timeHorizon: 'past',
		soWhat:
			'Not about the headliner, but a possible support act; check the lineup for the same name before announcing.',
		weight: 0.22,
		mentionsSubject: false
	},
	{
		title: 'Bloqueos en la ruta al Pacífico por protesta de transportistas',
		url: 'https://republica.gt/bloqueos-ruta-pacifico-protesta-transportistas',
		source: 'República',
		publishedAt: ago(47),
		snippet: null,
		category: 'political_unrest_elections',
		severity: 4,
		timeHorizon: 'past',
		soWhat:
			'Road blockades have recurred; fans traveling from the coast may be delayed. Consider a later door time or earlier gate opening.',
		weight: 0.18,
		mentionsSubject: false
	}
];

const items: ClassifiedNews[] = seeds.map((s, i) => ({
	id: `news_${String(i + 1).padStart(3, '0')}`,
	confidence: 0.6 + ((i * 7) % 4) / 10,
	affectedEntities: [],
	...s
}));

const raw: MarketDashboard = {
	market: {
		id: gt.id,
		name: gt.name,
		country: gt.country,
		countryName: gt.countryName,
		localityName: gt.localityName,
		lat: gt.lat,
		lon: gt.lon,
		timezone: gt.timezone,
		note: gt.note,
		sampleArtists: gt.sampleArtists,
		outlets: gt.outlets
	},
	feed: {
		marketId: gt.id,
		country: 'GT',
		city: 'Guatemala City',
		from: '2026-08-31',
		to: '2026-10-30',
		items,
		advisories: [
			{
				source: 'US State Department',
				title: 'Guatemala Travel Advisory (Level 3: Reconsider Travel)',
				url: 'https://travel.state.gov/content/travel/en/traveladvisories/traveladvisories/guatemala-travel-advisory.html',
				publishedAt: ago(120),
				level: 3,
				summary:
					'Reconsider travel because of crime. Violent crime such as extortion, armed robbery and murder is common; gang activity is widespread.'
			},
			{
				source: 'UK FCDO',
				title: 'Guatemala travel advice',
				url: 'https://www.gov.uk/foreign-travel-advice/guatemala',
				publishedAt: ago(16),
				level: null,
				summary:
					'Latest update: information on the rainy season and hurricane preparedness. Violent crime is a risk in Guatemala City.'
			}
		],
		score: {
			value: 47,
			byCategory: {
				security: 78,
				weather_climate: 66,
				political_unrest_elections: 41,
				competing_events: 38,
				transport: 33,
				permits_regulation: 18,
				health: 12,
				venue_infrastructure: 8,
				economic_shock: 4,
				artist_controversy: 3
			},
			itemCount: items.length,
			recentCount: items.filter((i) => i.publishedAt && NOW - Date.parse(i.publishedAt) < 7 * DAY)
				.length
		},
		ingestedAt: ago(0.1),
		storedItems: 187
	},
	calendar: {
		country: 'GT',
		from: '2026-10-30',
		to: '2027-04-30',
		holidays: [
			{
				date: '2026-11-01',
				localName: 'Día de Todos los Santos',
				name: "All Saints' Day",
				inWindow: true,
				weekday: 'Sunday'
			},
			{
				date: '2026-12-08',
				localName: 'Inmaculada Concepción',
				name: 'Immaculate Conception',
				inWindow: true,
				weekday: 'Tuesday'
			},
			{
				date: '2026-12-24',
				localName: 'Nochebuena (medio día)',
				name: 'Christmas Eve (half day)',
				inWindow: false,
				weekday: 'Thursday'
			},
			{
				date: '2026-12-25',
				localName: 'Navidad',
				name: 'Christmas Day',
				inWindow: false,
				weekday: 'Friday'
			},
			{
				date: '2026-12-31',
				localName: 'Fin de Año (medio día)',
				name: "New Year's Eve (half day)",
				inWindow: false,
				weekday: 'Thursday'
			},
			{
				date: '2027-01-01',
				localName: 'Año Nuevo',
				name: "New Year's Day",
				inWindow: false,
				weekday: 'Friday'
			},
			{
				date: '2027-03-25',
				localName: 'Jueves Santo',
				name: 'Maundy Thursday',
				inWindow: false,
				weekday: 'Thursday'
			},
			{
				date: '2027-03-26',
				localName: 'Viernes Santo',
				name: 'Good Friday',
				inWindow: false,
				weekday: 'Friday'
			},
			{
				date: '2027-03-27',
				localName: 'Sábado Santo',
				name: 'Holy Saturday',
				inWindow: false,
				weekday: 'Saturday'
			},
			{
				date: '2027-05-01',
				localName: 'Día del Trabajo',
				name: 'Labour Day',
				inWindow: false,
				weekday: 'Saturday'
			},
			{
				date: '2027-06-30',
				localName: 'Día del Ejército',
				name: 'Army Day',
				inWindow: false,
				weekday: 'Wednesday'
			},
			{
				date: '2027-08-15',
				localName: 'Día de la Asunción (capital)',
				name: 'Assumption Day (capital)',
				inWindow: false,
				weekday: 'Sunday'
			},
			{
				date: '2027-09-15',
				localName: 'Día de la Independencia',
				name: 'Independence Day',
				inWindow: false,
				weekday: 'Wednesday'
			}
		],
		longWeekends: [
			{
				start: '2026-12-24',
				end: '2026-12-27',
				days: 4,
				holidays: ['Christmas Eve (half day)', 'Christmas Day'],
				inWindow: false
			},
			{
				start: '2027-03-25',
				end: '2027-03-28',
				days: 4,
				holidays: ['Maundy Thursday', 'Good Friday', 'Holy Saturday'],
				inWindow: false
			}
		],
		climate: {
			years: [2021, 2022, 2023, 2024, 2025],
			tmaxMean: 25.8,
			tminMean: 15.9,
			precipMean: 18.4,
			rainDayShare: 0.27,
			precipMaxDay: 31.2,
			note: 'Late November is the start of the dry season, with cool nights.'
		},
		climateMonths: [
			{ month: 1, tmaxMean: 25.9, tminMean: 13.6, precipMean: 4, rainDays: 1 },
			{ month: 2, tmaxMean: 27.2, tminMean: 14.1, precipMean: 6, rainDays: 1 },
			{ month: 3, tmaxMean: 28.6, tminMean: 15.3, precipMean: 14, rainDays: 2 },
			{ month: 4, tmaxMean: 29.2, tminMean: 16.8, precipMean: 52, rainDays: 6 },
			{ month: 5, tmaxMean: 28.4, tminMean: 17.6, precipMean: 170, rainDays: 15 },
			{ month: 6, tmaxMean: 27.1, tminMean: 17.7, precipMean: 262, rainDays: 20 },
			{ month: 7, tmaxMean: 27.0, tminMean: 17.4, precipMean: 187, rainDays: 17 },
			{ month: 8, tmaxMean: 27.1, tminMean: 17.4, precipMean: 200, rainDays: 18 },
			{ month: 9, tmaxMean: 26.3, tminMean: 17.4, precipMean: 260, rainDays: 21 },
			{ month: 10, tmaxMean: 26.0, tminMean: 16.9, precipMean: 150, rainDays: 15 },
			{ month: 11, tmaxMean: 25.7, tminMean: 15.2, precipMean: 38, rainDays: 5 },
			{ month: 12, tmaxMean: 25.3, tminMean: 14.1, precipMean: 9, rainDays: 2 }
		]
	},
	recentBriefs: [
		{
			id: 'brief_01JBRIEFSAMPLE0001',
			marketId: 'guatemala-city',
			status: 'complete',
			artistName: 'Ricardo Arjona',
			city: 'Guatemala City',
			country: 'GT',
			localityName: 'Ciudad de Guatemala',
			dateFrom: '2026-11-20',
			dateTo: '2026-11-22',
			headline: 'Strong fit for a two-night run with a hospitality partner.',
			verdict: 'promising',
			createdAt: ago(0.5)
		},
		{
			id: 'brief_01JBRIEFSAMPLE0002',
			marketId: 'guatemala-city',
			status: 'complete',
			artistName: 'Gaby Moreno',
			city: 'Guatemala City',
			country: 'GT',
			localityName: 'Ciudad de Guatemala',
			dateFrom: '2027-02-12',
			dateTo: '2027-02-13',
			headline: 'Mixed demand signal; a smaller venue fits better.',
			verdict: 'mixed',
			createdAt: ago(6)
		}
	],
	generatedAt: new Date(NOW).toISOString()
};

export const sampleDashboard: MarketDashboard = marketDashboardSchema.parse(raw);
