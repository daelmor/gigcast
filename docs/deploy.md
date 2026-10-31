# Deploying gigcast

One container (SvelteKit with adapter-node), a hosted Postgres on Neon, and Claude on Vertex AI in Google Cloud project `n1-data`. The app runs on **Azure Container Apps** (David's call, 2026-10-30); the Google Cloud Run path is kept below as the alternative.

## Azure Container Apps (current)

### Who can run it

Anyone with `az login` in the target subscription (`Fegora`) and rights to create a resource group. The script creates everything else. The Google side needs nothing new: the app authenticates to Vertex AI with the existing service-account JSON, mounted as a secret file.

### 1. Postgres on Neon

The Neon project `gigcast` (branch `production`, database `neondb`) was created by David; `neon init` pulled `DATABASE_URL` (pooled) and `DATABASE_URL_UNPOOLED` into the local env file. The app uses the pooled URL; postgres.js and the Drizzle migrator both work through Neon's pooler, and `pnpm db:migrate` against it succeeded before the first deploy. The connection string carries `sslmode=require`.

### 2. Deploy

Load the local env file into the shell (it holds `QLOO_API_KEY`, `DATABASE_URL`, `GOOGLE_APPLICATION_CREDENTIALS` and `GOOGLE_CLOUD_PROJECT`), then:

```sh
./deploy/azure-container-apps.sh
```

What it does, in order: resource group `rg-gigcast` in `eastus`; an Azure Container Registry (Basic, name derived from the subscription id); `az acr build` of the Dockerfile for linux/amd64 in the registry (the upload honours `.dockerignore`, so secrets and caches never leave the machine); a Container Apps environment `cae-gigcast` with its Log Analytics workspace; the container app `gigcast` with a system-assigned identity that pulls from the registry; the secrets `qloo-api-key`, `database-url` and `gcp-sa-json`, the last one mounted as the file `/mnt/secrets/gcp-sa-json` and pointed to by `GOOGLE_APPLICATION_CREDENTIALS`; finally `ORIGIN` and `APP_BASE_URL` set to the public origin (`PUBLIC_ORIGIN`, default `https://gigcast.ai`). Rerunning the script rebuilds the image with the current git SHA, refreshes the secrets and rolls a new revision.

Settings and why:

| Setting | Value | Reason |
| --- | --- | --- |
| Replicas | min 1, max 1 | The live SSE hub is per process and a brief run continues after the request that started it returned; one warm replica keeps both simple. The Postgres fallback keeps a second replica correct if the maximum is raised. |
| CPU / memory | 1 vCPU / 2 GiB | The agent loop is I/O bound; heatmap payloads are the largest objects. |
| Ingress | external, HTTPS, port 3000 | Judges open the demo without an account. Briefs are public read-only links by design. |
| `MIGRATE_ON_START=true` | env | Drizzle migrations apply when the container starts; the `drizzle/` folder ships in the image. |
| `MAX_CONCURRENT_RUNS=4` | env | Briefs running at once. The replica idles below 0.15 vCPU and 700 MB with two briefs, so four fit; the Qloo client's shared limiter (8 req/s) and the Vertex retries bound the external side. |
| `MAX_QUEUED_RUNS=8` | env | Briefs that wait for a slot instead of getting 429; a waiting brief's page shows its place and starts on its own. |
| `COUNTERFACTUAL_RUN=off` | env | The tool-less comparison run is not shown since the product refresh; off saves one model call per brief. |

Environment set by the script: `GOOGLE_CLOUD_PROJECT`, `ANTHROPIC_VERTEX_REGION=global`, `GOOGLE_APPLICATION_CREDENTIALS=/mnt/secrets/gcp-sa-json`, `QLOO_BASE_URL`, `QLOO_MODE=live`, `QLOO_CACHE_BACKEND=postgres`, `MIGRATE_ON_START=true`, `MAX_CONCURRENT_RUNS=4`, `MAX_QUEUED_RUNS=8`, `COUNTERFACTUAL_RUN=off`, `LOG_LEVEL=info`, `NODE_ENV=production`, `PORT=3000`, `HOST=0.0.0.0`, plus `ORIGIN` and `APP_BASE_URL`. Secrets as env: `QLOO_API_KEY`, `DATABASE_URL`.

The script also creates the scheduled job `gigcast-ingest` (a `curlimages/curl` container, cron `0 */6 * * *`) that posts to `/api/jobs/ingest` with the shared secret `INGEST_JOB_SECRET`. The secret is generated on the first run when the variable is unset and stored on both the app and the job; `az containerapp job start -n gigcast-ingest -g rg-gigcast` runs an ingestion on demand.

Overrides: `RG`, `LOCATION`, `APP`, `ENV_NAME`, `ACR`, `MIN_REPLICAS`, `MAX_REPLICAS`, `JOB_NAME`, `INGEST_CRON`, `INGEST_JOB_SECRET`.

### 3. Verify

```sh
FQDN=$(az containerapp show -n gigcast -g rg-gigcast --query properties.configuration.ingress.fqdn -o tsv)
curl -fsS "https://$FQDN/api/health"
```

Open `https://$FQDN/new`, pick a market and an artist, and watch the trace. The first brief for a market makes every Qloo call live; the second for the same inputs is mostly cache hits.

### Operations

- Logs: `az containerapp logs show -n gigcast -g rg-gigcast --follow` (console) or query the Log Analytics workspace. Every line is JSON with a `requestId`; runs log `brief started`, `brief run finished` and `brief persisted` with the brief id.
- Rotate a secret: `az containerapp secret set -n gigcast -g rg-gigcast --secrets qloo-api-key=...` then `az containerapp revision restart` (or redeploy).
- Rollback: `az containerapp revision list` and `az containerapp ingress traffic set --revision-weight <revision>=100`.
- Ingress closes idle or very long HTTP requests after about four minutes; the SSE client reconnects with `Last-Event-ID` and the server replays, so a ten-minute brief still streams.
- Capacity: four briefs run at once and eight more wait; `MAX_CONCURRENT_RUNS` and `MAX_QUEUED_RUNS` are plain env vars (`az containerapp update --set-env-vars`). Raising the CPU or memory needs the 1:2 ratio Container Apps requires (`--cpu 2.0 --memory 4.0Gi`); the metrics (`az monitor metrics list --metric UsageNanoCores WorkingSetBytes`) say when that is due.
- Costs: Consumption plan, one always-on replica of 1 vCPU / 2 GiB. Set `MIN_REPLICAS=0` to scale to zero between demos, at the cost of a cold start and of runs dying if the only viewer closes the tab.
- Switching models: set `CLAUDE_PLANNER_MODEL` on the app (`az containerapp update --set-env-vars`) once Claude 5.5 is enabled in `n1-data`.

### Tear down

```sh
az group delete -n rg-gigcast --yes --no-wait
```

## Google Cloud Run (alternative)

Kept for the record; not used.

### Who can run it

A human with `gcloud auth login` as an owner or editor of the project. The service account the assistant works with (`claude-code-reviewer@n1-data`) only has Vertex AI permissions, so it cannot create the Cloud Run service, the Artifact Registry repository, the secrets or the runtime service account. Roles the deploying account uses: Cloud Run Admin, Artifact Registry Admin, Cloud Build Editor, Secret Manager Admin, Service Account Admin and Service Account User, Service Usage Admin.

### Postgres

Neon works unchanged (TLS, no VPC). Alternatives: Supabase with the *session* pooler (port 5432); Cloud SQL with `--add-cloudsql-instances PROJECT:REGION:INSTANCE`, a URL of the form `postgres://USER:PASSWORD@/DB?host=/cloudsql/PROJECT:REGION:INSTANCE` and `roles/cloudsql.client` on the runtime service account.

### Secrets and deploy

```sh
printf '%s' "$QLOO_API_KEY" | gcloud secrets create gigcast-qloo-api-key --data-file=- --project n1-data
printf '%s' "$DATABASE_URL" | gcloud secrets create gigcast-database-url --data-file=- --project n1-data
./deploy/cloud-run.sh
```

The script enables the APIs, creates the Docker repository and the runtime service account `gigcast-run` (`roles/aiplatform.user`, `secretAccessor` on both secrets), builds with Cloud Build, deploys with `--max-instances 1 --no-cpu-throttling --timeout 900 --concurrency 20 --memory 1Gi` and `MIGRATE_ON_START=true`, and sets `ORIGIN` to the service URL. On Cloud Run the attached service account authenticates to Vertex AI; no JSON key is involved.

## Local Docker check

The same image runs locally against the Docker Compose database:

```sh
docker build -t gigcast:local .
docker run --rm -p 3000:3000 \
  -e DATABASE_URL=postgres://gigcast:gigcast@host.docker.internal:5432/gigcast \
  -e MIGRATE_ON_START=true -e ORIGIN=http://localhost:3000 \
  -e QLOO_API_KEY=... -e GOOGLE_CLOUD_PROJECT=n1-data \
  -e GOOGLE_APPLICATION_CREDENTIALS=/run/sa.json -v /path/outside/repo/sa.json:/run/sa.json:ro \
  gigcast:local
```

With `-e AGENT_RUNNER=fake` the container serves the canned trace and the sample brief, which is how the M2 smoke test was run without any secret.

## Custom domain (gigcast.ai)

The domain is registered in Route 53 (hosted zone `gigcast.ai`, account `fegora`). Records, all created with `aws route53 change-resource-record-sets` on 2026-10-30:

| Name | Type | Value |
|---|---|---|
| `gigcast.ai` | A | the environment's static IP (`az containerapp env show -n cae-gigcast -g rg-gigcast --query properties.staticIp`) |
| `asuid.gigcast.ai` | TXT | the app's `customDomainVerificationId` |
| `www.gigcast.ai` | CNAME | the app's FQDN |
| `asuid.www.gigcast.ai` | TXT | the same verification id |

Then the hostnames are added and bound with a free managed certificate: `az containerapp hostname add -n gigcast -g rg-gigcast --hostname gigcast.ai` and `az containerapp hostname bind ... --environment cae-gigcast --validation-method HTTP` (the apex uses an A record), and the same for `www.gigcast.ai` with `--validation-method CNAME`. Certificates renew on their own.

`https://gigcast.ai` is the canonical origin: the deploy script sets `ORIGIN` and `APP_BASE_URL` to it, and `src/hooks.server.ts` answers any other host (www, the platform hostname) with a 308 to the canonical one. API paths are not redirected, so the health check and the ingestion job keep using the platform hostname.
