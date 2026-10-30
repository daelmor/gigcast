# Devpost submission text

Working copy of the description for the Qloo Agentic Hackathon entry. Keep it in English; update the live URL and numbers before submitting.

## Project name

gigcast

## Tagline

Booking Briefs for concert promoters, grounded in Qloo: where the audience lives, who to book, who to call for sponsorship, what could go wrong, and what the model would have guessed without the data.

## Inspiration

Independent promoters in Central America and the Caribbean decide on gut feel plus whatever the ticketing system sold last time. A sponsor meeting needs a document, and the data to write one is scattered or missing. Qloo's Taste AI already links artists, brands, places, neighbourhoods and demographics through one affinity graph. We wanted an agent that turns that graph into the document a promoter takes to a sponsor the same day, and that is honest about what it knows and what it does not.

## What it does

A promoter picks an artist, a city and a date window. An agent on Claude (Vertex AI) calls Qloo through twelve typed tools and produces a Booking Brief:

1. **Audience map**: Qloo heatmap cells on MapLibre with affinity, popularity, quality and price-level dimensions, the strongest neighbourhoods, and the candidate venues on the map.
2. **Demand and fit**: popularity and twelve-month trend, age and gender affinities, and the taste match between the artist and the city, labeled as affinity signals, not ticket forecasts.
3. **Lineup**: co-headliners and openers from artist-to-artist affinities in that city, with the Qloo explainability weights behind each pairing.
4. **Sponsors**: brands with cross-domain affinity to this audience, ranked, with a "why this brand" and a draft outreach email per brand (drafts only; nothing is ever sent).
5. **Venues and partners**: places near the heat for the show, pre-parties, hospitality and ticket bundles.
6. **Pricing guidance**: ticket tiers from the price-level distribution around the heat, labeled as a heuristic.
7. **Risk panel**: local news ingested from Google News and local outlets, classified by Claude Haiku into risk categories with severity and a one-line "so what", plus US and UK travel advisories, public holidays and long weekends, and the climate seen on those dates in previous years. Every risk links to its source.
8. **Would this work without Qloo?**: the same lineup and sponsor question asked with every tool removed, side by side with the grounded picks, and every LLM-only name checked against what Qloo actually returned.
9. **Agent trace**: every tool call streamed live while the brief is built and kept with the brief.

Every claim carries one of three labels. **Grounded**: the entity id or source url was returned by a tool in this run and the server verified it. **Inferred**: the model's reasoning on top of grounded data. **No coverage**: Qloo returned nothing usable, and the brief says so instead of inventing. Briefs are public links, printable to PDF, exportable as Markdown, and each market has a dashboard with the risk feed, calendar and climate.

## How we built it

TypeScript end to end: SvelteKit 2 and Svelte 5 with Tailwind, Postgres on Neon with Drizzle, Claude on Vertex AI through the Anthropic SDK's tool runner (`betaZodTool`, streaming, adaptive thinking, prompt caching), MapLibre GL with OpenFreeMap tiles, ECharts, Zod at every boundary, Vitest and Playwright, a Docker image on Azure Container Apps with a scheduled ingestion job.

Before writing the agent we probed the live Qloo API and wrote down what it really does (docs/qloo-findings.md): which parameters each entity type accepts, that invalid parameters are ignored silently, that `/v2/trending` caps at fifty points, and that "Panama City" resolves to Florida unless you check the country. The client has a per-type parameter whitelist, a Postgres cache keyed by the normalized request, replay mode for when the key dies, and Zod schemas derived from recorded samples.

The agent emits a structured draft through an `emit_brief` tool. The server attaches the raw artifacts (heatmap cells, candidate lists, demographics, trend series, calendar, risk feed) and verifies every grounded pick against the entity ids and source urls the tools returned, downgrading the rest to inferred. A second, cheaper run answers the lineup and sponsor question with no tools at all; the server matches those names against Qloo's results so the comparison panel can say "in Qloo's results", "also picked by the grounded run" or "not in Qloo's results for this run".

## Challenges

- Free-text locations: Qloo resolves "Panama City" to Florida in both `/search` and `filter.location.query`. We resolve localities through `/search` with a country check, persist the entity id, and pass only ids to insights.
- Silent parameter drops: a misplaced parameter is ignored, not rejected. The whitelist per entity type came out of the probe.
- Long compositions: the planner takes four to ten minutes at high effort. The UI streams the trace over SSE with resumable ids, and the brief link keeps working if the tab is closed. The first `emit_brief` of one run was rejected by our own schema for three silent minutes; rejected tool inputs are now surfaced in the trace.
- Dense heatmaps: 1,757 cells render as a blob unless intensity scales with density.
- Production-only bugs: MapLibre's worker URL does not survive bundling; Tailwind's layered utilities lose to MapLibre's stylesheet.

## Accomplishments

Three demo markets (Guatemala City, Santo Domingo, Mexico City) with real briefs, every lineup and sponsor pick grounded and verified, local brands surfacing from Qloo's brand affinities where a model alone guesses the usual suspects, and a risk layer that reads the city's own newspapers.

## What we learned

Grounding is a contract, not a prompt. The model proposes, the server verifies, and the labels make the difference visible. The counterfactual panel turned out to be the clearest way to show what Qloo adds.

## What's next

Competing-events detection from the news feed and ticketing APIs, venue capacity data, promoter accounts with private briefs, and more markets as Qloo coverage grows.

## Built with

TypeScript, SvelteKit, Svelte 5, Tailwind CSS, Zod, Drizzle ORM, PostgreSQL (Neon), Anthropic SDK, Claude on Vertex AI, Qloo Taste AI API, MapLibre GL JS, OpenFreeMap, ECharts, Vitest, Playwright, Docker, Azure Container Apps, Nager.Date, Open-Meteo, Google News RSS.

## Links

- Live demo: https://gigcast.gentlegrass-9cbc951b.eastus.azurecontainerapps.io
- Repository: https://github.com/daelmor/gigcast (MIT)
