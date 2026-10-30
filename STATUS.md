# Status

Last updated: 2026-10-30 (end of M4 and M5).

## Deployed

- **Live demo:** https://gigcast.gentlegrass-9cbc951b.eastus.azurecontainerapps.io (Azure Container Apps, subscription "Fegora", resource group `rg-gigcast`, one always-on replica). Postgres on Neon (project `gigcast`, branch `production`). Claude on Vertex AI in Google Cloud project `n1-data` through the mounted service-account file. A scheduled job (`gigcast-ingest`, every six hours) refreshes the news store through `POST /api/jobs/ingest`.
- Deploy with `./deploy/azure-container-apps.sh` after loading the local env file; `docs/deploy.md` explains every setting.
- Demo mode: the landing's "See a finished brief" cards open the newest complete brief of each featured market; every Qloo response behind them is cached in Postgres, so a rerun of the same inputs is fast even if the hackathon key slows down (`QLOO_MODE=replay` serves the cache only if the key dies).

## Design system — done (2026-10-30)

The gigcast design system is applied end to end on the `design-system` branch: semantic colour, type, spacing and radius tokens in `src/lib/styles/tokens.css` (the only file that holds hex), Light and Dark themes with a System/Light/Dark toggle in the header, self-hosted Sora and IBM Plex, brand SVGs, favicons, manifest and Open Graph image, the shared `Button`, `EvidenceLabel`, `Badge`, `Chip` and `Card` components with a tones map, themed ECharts and MapLibre (dark basemap, heat ramp from the heat tokens), and every page restyled on those pieces. Copy, behaviour and the Grounded / Inferred / No coverage labels did not change.

- Verification scripts: `scripts/screenshots.mts` (Light/Dark at 1280 and 390), `scripts/a11y-check.mts` (axe-core, no violations), `scripts/print-check.mts` (black on white, one section per page), `scripts/token-check.sh` (no palette classes or hex outside the token file).
- `/dev/ui` shows every component in both themes; it returns 404 in production like the other dev routes.
- Deviations from the design-system README are listed in `docs/decisions.md` (2026-10-30, design system).

## Milestones M4 Risk layer and M5 Ship — done

### What works (M4)

- **News ingestion** (`src/lib/server/risk/ingest.ts`): Google News RSS searches per market in Spanish and English (events, security, politics and health, weather and transport, plus artist and venue queries) and the market's local outlets, deduplicated by canonical url and title, stored as headline, snippet, source, date and link. First live run for Guatemala City: 10 of 10 feeds, 457 items seen, 202 stored.
- **Classification** on `claude-haiku-4-5` in batches of 15 with one structured tool call: category (eleven categories), severity 1 to 5, affected entities, time horizon, confidence, one-line "so what". Irrelevant items are kept out of the feed.
- **Deterministic context**: public holidays and long weekends (Nager.Date, long weekends computed locally), the climate observed on the window dates in the last five years and monthly normals (Open-Meteo ERA5 archive), US State Department and UK FCDO travel advisories. All cached in Postgres or memory.
- **Market risk score**: severity- and confidence-weighted, time-decayed, squashed to 0 to 100 with quiet / watch / loud wording; calibrated so ordinary news days read as quiet or watch.
- **Two new agent tools**: `market_calendar` and `risk_feed`. Their requests are recorded as external sources (not Qloo calls) and the server verifies every risk item's url against what the feed returned. Live CLI brief with the risk layer (Ricardo Arjona, Guatemala City): complete in 491 s, 23 tool calls, 21 Qloo calls with 9 cache hits, 1 of 22 checks downgraded (the model cited open-meteo.com as a risk source, which is not a feed item), six grounded risks with their source links, calendar and climate in the panel.
- **Risk panel** in the document (score, items grouped by category with source links and labels, context cards for holidays, long weekends, climate and advisories) and the **market dashboard** at `/market/:slug` (score, filters, feed, advisories, six months of calendar, monthly climate chart, recent briefs, "new brief for this market"). Checked with real data for Guatemala City: score 39 "watch", 13 relevant items, 2 advisories.
- `POST /api/jobs/ingest` with a bearer secret (503 when unconfigured, 401 on a bad token), per-market or all markets, 240 s budget.

### What works (M5)

- `/about`: what it is, why Qloo is load-bearing (endpoint by endpoint), the three labels and how the server verifies them, an architecture diagram, the data sources with terms notes, honesty notes, links. "About" in the header.
- Landing: "See a finished brief" with the newest complete brief per featured market, plus the market dashboard links.
- README: "Why Qloo is load-bearing" table, Mermaid architecture diagram, run instructions, environment table, market dashboards and ingestion. `docs/submission.md` holds the Devpost description.
- Quality gates: `pnpm check` 0 errors, `pnpm lint` clean, `pnpm test` 215 unit tests, `pnpm test:e2e` 5 Playwright tests.

### Decisions taken without blocking (see docs/decisions.md)

- Outlets seeded only where a feed answered live; `TODO(David)` markers in `src/lib/markets.ts` for Soy502, elPeriódico, Listín Diario, El Caribe, El Universal, Milenio, Excélsior, La Prensa (Panamá and Nicaragua), La Prensa Gráfica and elsalvador.com.
- Haiku runs without thinking (it rejects adaptive thinking); the planner stays on `claude-opus-4-6` per David.
- `risk_feed` refreshes a stale market inline with a 45 s budget so a brief never waits long for news; the scheduled job does the bulk work.

### Still open for David

1. Fill the `TODO(David)` outlet feeds if you know working RSS urls for those outlets.
2. Review `docs/submission.md` and the final product name (still "gigcast") before submitting on Devpost.
3. Optional: enable Claude 5.5 in `n1-data` and set `CLAUDE_PLANNER_MODEL` on the container app.

### Known limitations

- A brief takes 5 to 11 minutes at effort high; the page streams progress and the link keeps working if the tab is closed.
- News classification reads headlines and snippets only; weather reports and sports violence can land in the feed with low severity. The risk score is a news-volume signal, not a safety judgment, and the UI says so.
- Open-Meteo values are observations at the same dates in past years, not a forecast; the panel labels them that way.
- Competing-events detection relies on the news feed; there is no ticketing API integration.
- The event hub is per process; the app runs one replica (Postgres fallback keeps a second replica correct, with 2 s polling).
- The dev-only routes `/dev/preview` and `/dev/market-preview` return 404 in production.

### Environment notes

- Local: Node 26, pnpm 12, Docker (`gigcast-db-1` Postgres 16 for the end-to-end tests), Playwright browsers, `gh` as `daelmor`, `az` logged in to "Fegora". The local env file points `DATABASE_URL` at Neon; `pnpm dev` therefore reads and writes the production database.
- Secrets never enter the repo: Qloo key, Neon URL, the GCP service-account JSON and the ingest secret live in the gitignored env file, `_secrets/`, and Azure Container Apps secrets.
