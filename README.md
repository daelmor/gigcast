# gigcast

Qloo-grounded Booking Briefs for concert promoters.

A promoter picks an artist, a city and a date window. An agent on Claude (Vertex AI) calls Qloo's Taste AI and produces a document the promoter can take to a sponsor the same day: where the artist's audience lives (heatmap), demand and fit, a lineup, sponsors with outreach drafts, venues and partners near the heat, ticket tiers, a risk panel, and the full agent trace. Every claim carries one of three labels: **grounded** (a Qloo result the server verified against the entity ids Qloo returned), **inferred** (the model's reasoning on top of grounded data) or **no coverage** (Qloo returned nothing usable, and the brief says so instead of inventing).

Built for the Qloo Agentic Hackathon. Progress lives in [STATUS.md](STATUS.md); routine decisions in [docs/decisions.md](docs/decisions.md); what the Qloo API really does in [docs/qloo-findings.md](docs/qloo-findings.md).

## How a brief is built

1. `/new` resolves the market (quick picks or a locality search with a country check, because "Panama City" resolves to Florida) and the artist (autocomplete through Qloo `/search`), takes the dates and optional promoter numbers, and calls `POST /api/briefs`.
2. The server starts the agent loop: Claude on the Anthropic SDK tool runner with twelve typed Qloo tools plus `emit_brief`, streaming, adaptive thinking, a cached system prompt and a tool budget. Every tool records the Qloo request behind it.
3. Events stream to the browser over SSE (`/api/briefs/:id/events`) and are persisted with the brief; `/brief/:id` shows the live trace, then the document.
4. In parallel, a second run answers the lineup and sponsor question with every tool removed. The server checks each of those LLM-only names against what Qloo actually returned, and the brief shows the two columns side by side: what the model guessed and what the data says.
5. Two more tools cover what Qloo does not know: `market_calendar` (public holidays, long weekends and the climate observed on the dates in previous years) and `risk_feed` (local news ingested from Google News and local outlets, classified by Claude Haiku into risk categories with severity and a one-line "so what", plus US and UK travel advisories and a decayed market risk score). Every risk in the brief links to its source; the server rejects any that the feed did not return.
6. The server attaches the raw artifacts (heatmap cells, neighbourhoods, demographics, trend series, candidate lists), verifies every `grounded` pick and downgrades what it cannot verify, renders Markdown, and stores everything in Postgres. The brief is a public read-only link, printable to PDF, with the sponsor outreach drafts on their own page.

## Stack

TypeScript end to end: SvelteKit 2, Svelte 5 (runes), Tailwind 4, adapter-node · Postgres with Drizzle · Claude on Vertex AI through `@anthropic-ai/vertex-sdk` (beta tool runner, `betaZodTool`) · MapLibre GL with OpenFreeMap tiles · ECharts · Zod at every boundary · Vitest and Playwright · Docker on Cloud Run.

## Run it locally

Prerequisites: Node 22+ (developed on 26), pnpm 12, Docker (for Postgres), a Qloo hackathon API key, and a Google Cloud project with Claude enabled on Vertex AI plus Application Default Credentials (a service-account JSON kept outside the repo).

```sh
pnpm install
cp .env.example .env      # fill in the values; names and comments are in the template
pnpm db:start             # Postgres 16 in Docker Compose
pnpm db:migrate
pnpm dev                  # http://localhost:5173
```

The dev server reads `.env` itself. In production the variables come from the environment (Cloud Run secrets); there is no dotenv loading.

### CLI

```sh
pnpm brief --city "Guatemala City" --country GT --artist "Ricardo Arjona" --from 2026-11-20 --to 2026-11-22
```

Streams the trace to stderr, prints the Markdown brief to stdout and writes `.cache/briefs/<id>.{json,events.json,md}`. `--mode replay` serves Qloo responses from the cache only; `--effort medium` is faster; `--json` prints the structured brief.

### Tests and checks

```sh
pnpm check      # svelte-check, TypeScript strict
pnpm lint       # prettier + eslint
pnpm test       # vitest: Qloo client against recorded samples, schemas, tools, assembly, renderer, UI helpers
pnpm test:e2e   # playwright: builds, starts the preview with the fake agent runner, needs the local Postgres
```

The end-to-end suite uses `AGENT_RUNNER=fake`, a canned trace plus the sample brief, so it needs neither a Qloo key nor Vertex. Briefs it creates land in the local database.

### Qloo probe

`pnpm probe` reruns the M0 probe against the live API and regenerates `docs/qloo-findings.md` and the samples under `docs/qloo-samples/` that the client tests replay.

## Environment

| Variable | Required | Notes |
| --- | --- | --- |
| `QLOO_API_KEY` | yes | Hackathon key; server only. |
| `QLOO_BASE_URL` | yes | `https://hackathon.api.qloo.com` for hackathon keys. |
| `DATABASE_URL` | yes | Postgres connection string. |
| `GOOGLE_CLOUD_PROJECT` | yes | Project with Claude on Vertex AI. |
| `GOOGLE_APPLICATION_CREDENTIALS` | local only | Path to a service-account JSON outside the repo; unset on Cloud Run. |
| `ANTHROPIC_VERTEX_REGION` | no | `global` by default. |
| `CLAUDE_PLANNER_MODEL` / `CLAUDE_CLASSIFIER_MODEL` | no | Defaults `claude-opus-4-6` and `claude-haiku-4-5`. |
| `QLOO_MODE` | no | `live` (cache first, API on miss), `replay` (cache only), `refresh`. |
| `QLOO_CACHE_BACKEND` / `QLOO_CACHE_DIR` | no | `postgres` (default) or `file` for offline work and tests. |
| `MAX_CONCURRENT_RUNS` | no | Briefs running at once per instance, default 2; extra requests get 429. |
| `AGENT_RUNNER` | no | `vertex` (default) or `fake` for tests. |
| `MIGRATE_ON_START` | no | `true` applies Drizzle migrations on boot (Cloud Run). |
| `PUBLIC_MAP_STYLE_URL` | no | MapLibre style; OpenFreeMap Positron by default. |
| `APP_BASE_URL`, `ORIGIN` | deploy | Public URL of the app; adapter-node reads `ORIGIN`. |
| `INGEST_JOB_SECRET` | deploy | Bearer secret for `POST /api/jobs/ingest`; the scheduled job sends it. Unset means the endpoint answers 503. |

## Market dashboards and ingestion

`/market/:slug` shows each known market's risk feed with filters, the score, travel advisories, the next six months of holidays and long weekends, monthly climate normals and the market's recent briefs. The news store is refreshed by `POST /api/jobs/ingest` (all markets, or `?market=slug`) with `Authorization: Bearer $INGEST_JOB_SECRET`; on Azure a scheduled job calls it every six hours, and a brief refreshes its market inline when the store is older than twelve hours.

## Deploy

One Docker image on Azure Container Apps, Postgres on Neon, Claude on Vertex AI: `deploy/azure-container-apps.sh` creates the resource group, registry, environment, secrets and app, and [docs/deploy.md](docs/deploy.md) explains every setting. A Google Cloud Run script is kept as the alternative.

## Repository layout

```
src/lib/server/qloo/      typed Qloo client, parameter whitelist, cache stores, locality resolver
src/lib/server/agent/     tools, system prompt, Vertex agent loop, brief assembly and verification
src/lib/server/briefs/    Postgres store, run manager with the SSE event hub, fake runner
src/lib/server/risk/      RSS ingestion, Haiku classification, holidays and climate, advisories, score, dashboard
src/lib/brief/            Brief contract (Zod), agent events, Markdown renderer, fixtures
src/lib/components/       UI: brief document sections, maps, trace, the /new form, shell
src/routes/               pages (/, /new, /brief/[id]) and API routes (/api/briefs, /api/search, SSE)
scripts/                  qloo-probe.ts (M0) and brief.ts (CLI)
drizzle/                  SQL migrations
docs/                     Qloo findings and samples, decisions, deploy guide
deploy/                   Cloud Run deploy script
```

## License

MIT, see [LICENSE](LICENSE).
