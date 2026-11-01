# Status

Last updated: 2026-10-31 (calibration pass).

## Deployed

- **Live demo:** https://gigcast.ai (Azure Container Apps, subscription "Fegora", resource group `rg-gigcast`, one always-on replica). Postgres on Neon (project `gigcast`, branch `production`). Claude on Vertex AI in Google Cloud project `n1-data` through the mounted service-account file. A scheduled job (`gigcast-ingest`, every six hours) refreshes the news store through `POST /api/jobs/ingest`.
- Deploy with `./deploy/azure-container-apps.sh` after loading the local env file; `docs/deploy.md` explains every setting.
- Demo mode: the landing's "See a finished brief" cards open the newest complete brief of each featured market; every Qloo response behind them is cached in Postgres, so a rerun of the same inputs is fast even if the hackathon key slows down (`QLOO_MODE=replay` serves the cache only if the key dies).

## Calibration pass — done (2026-10-31)

Branch `calibration-2026-10-31`; the submitted version is tagged `submission-2026-10-30` (commit `4feacef`). An external review found that the product's exposure was cultural affinity being read as demand, price, fee or commitment, the comparison no longer being visible, and no executive decision at the top. The concept, the user flow, the three labels and the models did not change; brief generation time and cost did not increase.

- **Claims calibrated in three layers.** The system prompt says what the data does and does not show, prices tiers as planning scenarios, keeps sponsor drafts hypothetical ("We are exploring a potential concert", "subject to artist and venue confirmation") and tells the model when a lineup ranking is artist compatibility only. Stored briefs are rewritten at read time (`src/lib/brief/wording.ts`, `calibrate.ts`): "we are producing" becomes "we are exploring a potential", "willingness to pay" becomes "price-level affinity" unless negated, "the audience lives in" becomes "audience affinity concentrates in", plus "deep demand", "accepts premium prices", "cost-effective opener" and "will sponsor". The document and the Markdown carry the same notes under Demand, Lineup, Sponsors, Venues and Pricing.
- **Decision snapshot** at the top of every brief and of the Markdown export: assessment, strongest cultural signal, top sponsor prospect ("audience affinity only; interest not confirmed"), critical unknowns from the promoter inputs that are missing, a fixed next step per verdict, and confidence (cultural evidence strong / mixed / sparse; business case never validated). Derived in `src/lib/brief/snapshot.ts`; no model call.
- **Comparison restored at `/compare`** as a dated snapshot: the Natalia Lafourcade / Mexico City brief of 2026-10-30 still carried its stored counterfactual panel, so no new model run was needed. Two of five model-alone lineup names overlap with the grounded run and three appear in the results; none of the five model-alone brands appear in the top-20 brand results. Linked from the landing and `/about`. No "same artist, two markets" panel: no artist has two complete briefs in two markets.
- **Less false precision.** Neighbourhoods are deduped by entity and by name, and when the top eight sit within 0.02 the list reads "Broad coverage, no meaningful neighbourhood differentiation in this result" (true for the Buenos Aires, São Paulo, Mexico City and Guatemala City demo briefs). The lineup section says "Artist compatibility (not locality-differentiated)" when every explainability weight is the headliner's (true for every stored brief). Calendar and climate items the model emitted as risks (Open-Meteo, Nager.Date) leave the list and are recorded as context, not as a downgrade error. Sections are numbered 1 to 10 again, the place price level reads `$$` strong plus `$$` dim in both themes and in print, the recent-briefs lists collapse to one brief per artist and locality (query only), the dark heat ramp is brighter, and briefs carry their own Open Graph title and description.
- **Calibrated verdicts.** Labels are "Promising cultural fit", "Conditional — verify before booking", "Weak cultural fit" and "Insufficient evidence". The prompt applies conservative criteria; the assembler forces `insufficient_data` when audience, lineup or sponsors ended with no coverage and records the change in Verification. The six featured briefs keep their stored "promising" verdict: the guard only acts on new runs, and none of them has a core section without coverage, so a rerun would be needed for the new criteria to apply.
- Quality gates after the pass: `pnpm check` 0 errors, `pnpm lint` clean, `pnpm test` 273 unit tests (222 before), `pnpm test:e2e` 6 Playwright tests (5 before), `scripts/token-check.sh`, `a11y-check`, `print-check` and `screenshots` clean. Not deployed: `deploy/azure-container-apps.sh` is David's call.

**Follow-up (2026-11-01).** The first brief on the calibrated prompt (Aleks Syntek, New York City, `brief_QPoAU9Nb6V`, in Neon) came out `mixed` with zero downgraded checks, conditional drafts, scenario pricing, an artist-based lineup note and the climate in the note, at the same cost as before (403 s, 18.8k output tokens). Changes since: the snapshot line is "Cultural fit signal" with a band (low under 0.30, moderate to 0.60, strong above), a low signal adds the highest-affinity neighbourhood and reads the confidence as mixed; the risk score bands are quiet / elevated / high news volume with a news-volume note and the prompt describes the score as volume, never safety (the per-market normalization is deferred, `TODO(calibration)` in `score.ts`); the read-time rules keep negations up to three words away, turn "proxy for willingness to pay" into "context for ticket-price planning" and keep capitals only at sentence starts. Gates: `pnpm test` 280 unit tests in 29 files, `pnpm test:e2e` 6, `pnpm check` 0 errors, `pnpm lint` clean, `token-check` none, `a11y-check` no violations on eight pages in both themes, `print-check` ok, 44 screenshots at 1280 and 390 in both themes. The post-deploy steps are in `docs/runbook-regenerate-demo-briefs.md`.

**Deployed and regenerated (2026-11-01).** PR #20 merged as `5c5ebc9` and deployed; the six featured briefs were regenerated on the calibrated prompt (Natalia Lafourcade came out `mixed`, the other five `promising`, all with the conditional drafts, scenario pricing and artist-only lineup note), the five superseded briefs were deleted with a backup and the old Natalia Lafourcade brief was unlisted because `/compare` cites it. The judges' checklist passed on production: landing to brief in two clicks, snapshot with the fit-signal band, sections 1 to 10, risk bands, no calendar links among risk items, Markdown, drafts, `/compare` with its evidence link, `/about`, market dashboard, print, and no horizontal overflow at 390 px.

## Activity log and monitoring — done (2026-10-31)

- Every page and API request lands in `request_log` (no raw address: a daily-rotating visitor hash, trimmed user agent, referrer host, bot flag, brief id) and in the JSON console log that Log Analytics keeps.
- `/admin` (opened once with `?token=<ADMIN_TOKEN>`, hidden otherwise) and `pnpm stats` show briefs, visitors, page views, bot hits, refused requests, run durations and spend, recent briefs, markets, top pages, referrers, 404 noise and the live queue. `docs/ops.md` has the Log Analytics queries and the capacity knobs.

## Capacity and queue — done (2026-10-31)

- Four briefs run at once on Azure (`MAX_CONCURRENT_RUNS=4`) and eight more wait in a queue (`MAX_QUEUED_RUNS=8`); a waiting brief's page says "Queued · next in line" or "N ahead" and starts on its own. Only a full queue gets 429.
- Tool calls start while the model's reply is still streaming (`runToolsEagerly`), and the Vertex client retries overloads four times.
- The tool-less counterfactual run is off (`COUNTERFACTUAL_RUN=off`); `on` restores it.
- `pnpm briefs:dedupe` removes repeated artist-and-locality briefs, keeping the most complete; four were removed on 2026-10-31 (backup in `.cache/backups`).

## Product refresh after the design pass — done (2026-10-30)

- Featured markets: Mexico City, São Paulo, Buenos Aires; New York City, Los Angeles, Tampa. Locality ids, heatmap sizes, sample artists and local outlets verified live (see `docs/qloo-findings.md`, "Markets added 2026-10-30").
- `/new`: the city search needs no country; results show the disambiguation and country code. The quick-pick chips for other cities are gone. The artist hint shows only with suggestions.
- Landing: "Booking Briefs grounded in cultural data", "Why gigcast", featured markets grouped by region, no "How it works". Logo cropped to its artwork and 32px tall.
- Brief view and Markdown: the "LLM only vs. grounded" comparison is no longer shown; wording says "the taste graph" / "cultural data" except where provenance is shown.
- Demo briefs for the five new markets: see "Still open for David" if any is missing.

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
