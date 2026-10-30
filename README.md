# gigcast

Qloo-grounded booking and sponsorship agent for event promoters.

A promoter considering **artist X in city Y during date window Z** gets a
**Booking Brief**: audience heatmap, demand and fit, lineup, sponsors, venues
and partners, pricing guidance, a risk panel, and a side-by-side
"LLM only vs. grounded in Qloo" counterfactual. Every recommendation is
labeled **grounded**, **inferred**, or **no coverage**.

Built for the [Qloo Agentic Hackathon](https://qloo.devpost.com).

## Status

Early development. See [STATUS.md](STATUS.md) for what works today and
[docs/decisions.md](docs/decisions.md) for the decision log.

## Development

```sh
pnpm install
pnpm db:start          # Postgres 16 via Docker Compose
pnpm dev               # http://localhost:5173
pnpm check && pnpm lint && pnpm test
```

Copy `.env.example` to a local env file and fill in the values; the browser
never sees them. `pnpm probe` runs the Qloo API probe that produced
[docs/qloo-findings.md](docs/qloo-findings.md) (`QLOO_PROBE_REPLAY=1` re-renders
it from the local cache without calling the API).

## License

[MIT](LICENSE)
