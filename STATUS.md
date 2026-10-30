# Status

Last updated: 2026-10-30 (end of M0).

## Milestone: M0 Probe — done, awaiting two decisions

### What works

- Repo `daelmor/gigcast` is public with an MIT license, topics set, `main` protected by convention (PRs only).
- SvelteKit 2 + Svelte 5 + TypeScript strict + Tailwind 4 scaffold with `adapter-node`, Drizzle (one table: `qloo_cache`), Vitest, Playwright, ESLint, Prettier, Dockerfile and Docker Compose for Postgres 16. `pnpm check`, `pnpm lint`, `pnpm test` and `pnpm build` pass.
- `scripts/qloo-probe.ts` (`pnpm probe`, or `node scripts/qloo-probe.ts` with zero dependencies) runs ~236 live requests against the hackathon API and writes:
  - `docs/qloo-findings.md`: coverage table for 7 cities, artist resolution, parameter behavior per entity type, confirmed endpoint paths, observed response shapes, analyst notes.
  - `docs/qloo-probe-log.json`: every request (no key), status, latency, count.
  - `docs/qloo-samples/*.json`: trimmed responses, the fixtures for M1 tests.
  - `.cache/qloo-probe/*.json`: full responses (gitignored); `QLOO_PROBE_REPLAY=1` re-renders the findings without calling the API.
- Verified: Qloo coverage is sufficient in all six Latin American markets (see the coverage table). Rate limits are 10 req/s and 50,000 req/month.
- Verified: Vertex AI in project `n1-data` answers for `claude-opus-4-6`, `claude-opus-4-5`, `claude-sonnet-4-5`, `claude-haiku-4-5` in both `global` and `us-east5`. Claude 5.x models are listed but not enabled for the project.

### Deployed

Nothing yet. First deployment is the goal of M2.

### Blocked on David

1. Pick the three demo markets. Recommendation: Guatemala City, Santo Domingo, Mexico City (or Panama City instead of Mexico City to stay within Central America and the Caribbean). Details in `docs/qloo-findings.md`, "Analyst notes".
2. Decide the planner and classifier models: enable Claude 5.5 in `n1-data` through the Vertex Model Garden questionnaire, or start M1 on `claude-opus-4-6` + `claude-haiku-4-5`. Model ids are environment variables either way.

### Next (M1 Core)

- Typed Qloo client with a per-entity-type parameter whitelist, Postgres cache keyed by normalized request, replay mode, Zod schemas derived from `docs/qloo-samples/`.
- Locality resolver (search, country check, entity id persisted) and the agent tools from the brief.
- Agent loop on Vertex with the tool runner, streaming and prompt caching (after loading the `claude-api` skill).
- CLI `pnpm brief --city "..." --artist "..."` printing a Markdown brief.
- Vitest on the client (fixtures) and on the brief schema.

### Environment notes

- Local tooling: Node 26, pnpm 12, Docker running, `gh` authenticated as `daelmor`, Google Cloud SDK installed via Homebrew (not yet authenticated: run `gcloud auth login` or activate the service account yourself; a session guard prevents the assistant from touching credential files).
- Secrets: a gitignored local env file holds `QLOO_API_KEY`, `GOOGLE_APPLICATION_CREDENTIALS`, `GOOGLE_CLOUD_PROJECT=n1-data`, `ANTHROPIC_VERTEX_REGION=global`, `DATABASE_URL`. `.env.example` lists names only.
