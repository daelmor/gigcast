# Status

Last updated: 2026-10-30 (end of M3).

## Deployed

- **Live demo:** https://gigcast.gentlegrass-9cbc951b.eastus.azurecontainerapps.io (Azure Container Apps, subscription "Fegora", resource group `rg-gigcast`, one always-on replica). Postgres on Neon (project `gigcast`, branch `production`). Claude on Vertex AI in Google Cloud project `n1-data` through the mounted service-account file.
- Deploy with `./deploy/azure-container-apps.sh` after loading the local env file; `docs/deploy.md` has every setting. The first deployment (M2 image) was verified live with a real brief started through the public API: Ricardo Arjona in Guatemala City, status complete, 22 tool calls and 22 Qloo calls (fresh Neon database, so no cache hits), 0 of 18 grounded picks downgraded, 1,757 heatmap cells, locality matched by id, 385 s end to end on Vertex AI from Azure.
- The M3 image goes out by rerunning the same script.

## Milestone: M3 Counterfactual and drafts — done

### What works

- **Counterfactual run.** Every brief now runs a second, cheaper call in parallel: the same lineup and sponsor question with every data tool removed (`emit_counterfactual` only, effort medium). The server matches each LLM-only name against the entities Qloo returned in the main run and against the grounded picks, and the document shows the two columns side by side under "Would this work without Qloo?" with a summary ("1 of 3 LLM-only sponsor picks appear in Qloo's results, 1 also chosen by the grounded run"), confidence pills, and per-pick checks ("also picked by the grounded run" / "in Qloo's results" / "not in Qloo's results for this run"). LLM-only picks are never labeled grounded. The Markdown export has the same section as a table. Older briefs show a one-line note instead.
- **Sponsor outreach drafts page** at `/brief/:id/drafts`: every draft in full with copy buttons and `mailto:` links that open the promoter's own email client; a banner states nothing is ever sent by gigcast. Linked from the sponsors section and the brief toolbar.
- **Pricing evidence.** The pricing section shows the price-level distribution of the places Qloo returned near the heat (four `$` bars) and the heatmap price-level quantiles, the proxy behind the suggested tiers.
- **Print to PDF.** Print styles hide the chrome and the table of contents, break pages per section, keep cards whole, open every collapsed block (drafts, trace) before printing, and the MapLibre canvas keeps its drawing buffer so the map prints. Verified with Chromium's print emulation and PDF export.
- **Streaming across runs.** SSE ids are now the event storage ids, monotonic across the main and counterfactual runs; the client dedupes by run and sequence and resumes with one `Last-Event-ID`. The live page shows the main run's trace and a status line for the LLM-only comparison.
- Quality gates: `pnpm check` 0 errors, `pnpm lint` clean, `pnpm test` 197 unit tests, `pnpm test:e2e` 4 Playwright tests (the happy path now also asserts the counterfactual panel).

### Decisions taken without blocking (see docs/decisions.md)

- Azure Container Apps and Neon per David; the Cloud Run script stays as the alternative. Neon's CLI tooling (`neon.ts`, two packages) lives in devDependencies.
- The counterfactual never calls Qloo and is compared by name only; a name match is reported as "in Qloo's results", never as grounded.
- Drafts open the promoter's own mail client through `mailto:`; the product never sends email.

### Still open for David

Nothing blocking. Optional: enable Claude 5.5 in `n1-data` and set `CLAUDE_PLANNER_MODEL` on the container app.

### Next (M4 Risk layer)

- News ingestion job (`POST /api/jobs/ingest`, shared secret, scheduled from Azure), Haiku classification into the risk categories with severity and a one-line "so what"; the `news_items` and `news_classifications` tables already exist.
- Holidays and long weekends, climate normals for the dates, travel advisories, each with its source; the `market_calendar` and `risk_feed` tools for the agent; the risk panel in the document and the market dashboard at `/market/:slug`.
- David fills the `TODO(David)` outlet lists per market when asked.

### Known limitations

- A brief takes 5 to 11 minutes at effort high; the counterfactual adds no wall time because it runs in parallel. The live page streams progress and the link keeps working if the tab is closed.
- Container Apps ingress closes long HTTP requests after about four minutes; the SSE client reconnects with `Last-Event-ID` and the server replays, which is why the stream is resumable.
- The event hub is per process; the app runs one replica. The Postgres fallback keeps a second replica correct, with updates every 2 s instead of instantly.
- Qloo venue inventory is thin in Central America; the venues section leans on the promoter's own venue and on bars, restaurants and hotels near the heat.
- The risk panel is `no_coverage` until M4; demo mode, the landing's example brief and `/about` arrive in M5.
- The dev-only `/dev/preview` route renders the sample brief and returns 404 in production.

### Environment notes

- Local: Node 26, pnpm 12, Docker (`gigcast-db-1` Postgres 16 on 5432 for tests), Playwright browsers installed, `gh` as `daelmor`, `az` logged in to "Fegora", Google Cloud SDK installed but not authenticated. The local env file now points `DATABASE_URL` at Neon (pulled by `neon init`); the end-to-end suite pins the Docker database.
- Secrets never enter the repo: Qloo key, Neon URL and the GCP service-account JSON live in the gitignored env file and `_secrets/`, and on Azure as Container Apps secrets.
