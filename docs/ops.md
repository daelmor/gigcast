# Operations: activity, monitoring and capacity

What the running site records about its use, where to read it, and the knobs that change how much work it takes on.

## What is recorded

Every page and API request (static assets and `/api/health` excluded) leaves one row in the `request_log` table and one JSON line in the console log:

| Field | Value | Not stored |
| --- | --- | --- |
| `method`, `path`, `status`, `duration_ms` | The request as answered; the path without its query string. | Query strings (they can carry the admin token). |
| `visitor` | Sixteen hex characters of `sha256(ACTIVITY_SALT \| day \| client address \| user agent)`. Counts visitors per day; a visitor gets a new id every day, so nobody can be followed across days. | The client address. |
| `user_agent` | The first 160 characters. | |
| `referrer_host` | The referrer's host when it is another site. | Referrer paths, own-site referrers. |
| `bot` | True when the user agent names a crawler, scanner or script, or is missing. | |
| `brief_id` | When the path names a brief (`/brief/:id`, `/api/briefs/:id/...`). | |
| `request_id` | The same id the response carries in `x-request-id`, so a row and its log lines match. | |

Rows are buffered in memory and inserted in batches (every five seconds or fifty rows); a database problem drops the batch with one warning a minute and never fails a request. Briefs and their runs (`briefs`, `brief_runs`, `agent_events`) are the other half of the picture: who asked for what, how long the agent took, what it spent.

## Reading it

**The admin page.** `https://gigcast.ai/admin?token=<ADMIN_TOKEN>` once; it sets a cookie for thirty days and redirects to `/admin`. Without the variable set, or with a wrong or missing cookie, the page answers 404. It shows briefs, visitors, page views, bot hits and refused requests for the last day, week and month; a day-by-day table; run durations and spend; the last twenty briefs with their wait, duration and usage; briefs per market; top pages, referrers and the 404 noise; and the live run queue. The token is a Container Apps secret:

```sh
az containerapp secret show -n gigcast -g rg-gigcast --secret-name admin-token --query value -o tsv
```

**The terminal.** `pnpm stats` prints the same numbers from the database the local env file points at (`--json` for the object). `pnpm briefs:dedupe` lists briefs that repeat an artist in a locality and, with `--yes`, keeps the most complete one of each group after backing the rest up to `.cache/backups`.

**Log Analytics.** The console log (every line JSON, `requestId` on request lines, `briefId` on run lines) lands in the environment's workspace. Workspace id: `az containerapp env show -n cae-gigcast -g rg-gigcast --query properties.appLogsConfiguration.logAnalyticsConfiguration.customerId -o tsv`. Queries that work, through `az monitor log-analytics query -w <workspace id> --analytics-query "<query>" -o table`:

```kusto
// Requests per status code, last 24 hours
ContainerAppConsoleLogs_CL
| where ContainerAppName_s == 'gigcast' and TimeGenerated > ago(24h)
| extend j = parse_json(Log_s)
| where tostring(j.msg) == 'request'
| summarize n = count() by status = toint(j.status)
| order by n desc
```

```kusto
// One brief's lifecycle: started, queued, run finished, persisted
ContainerAppConsoleLogs_CL
| where ContainerAppName_s == 'gigcast'
| extend j = parse_json(Log_s)
| where tostring(j.briefId) == 'brief_WrbnFK3nLd'
| project TimeGenerated, msg = tostring(j.msg), status = tostring(j.status)
| order by TimeGenerated asc
```

```kusto
// Errors (pino level 50 and up), last 24 hours
ContainerAppConsoleLogs_CL
| where ContainerAppName_s == 'gigcast' and TimeGenerated > ago(24h)
| extend j = parse_json(Log_s)
| where toint(j.level) >= 50
| project TimeGenerated, msg = tostring(j.msg), err = substring(tostring(j.err), 0, 200)
| order by TimeGenerated desc
```

```kusto
// Briefs refused for capacity, last 7 days
ContainerAppConsoleLogs_CL
| where ContainerAppName_s == 'gigcast' and TimeGenerated > ago(7d)
| extend j = parse_json(Log_s)
| where tostring(j.msg) == 'brief refused: at capacity'
| project TimeGenerated, running = toint(j.running), queued = toint(j.queued)
```

Live tail: `az containerapp logs show -n gigcast -g rg-gigcast --follow`.

**Replica metrics.** CPU and memory of the replica, hourly, last day:

```sh
APPID=$(az containerapp show -n gigcast -g rg-gigcast --query id -o tsv)
az monitor metrics list --resource "$APPID" --metric UsageNanoCores WorkingSetBytes Requests --interval PT1H --offset 24h --aggregation Average Maximum Total -o table
```

On 2026-10-31, with two briefs running at once, the replica averaged under 0.03 vCPU (peak 0.13) and 250 MB (peak 660 MB) of its 1 vCPU / 2 GiB.

## Capacity

| Variable | Azure | What it does |
| --- | --- | --- |
| `MAX_CONCURRENT_RUNS` | 4 | Briefs running at once per replica. |
| `MAX_QUEUED_RUNS` | 8 | Briefs that wait for a slot with status `queued`; their page shows the place in line and they start on their own. Beyond this, `POST /api/briefs` answers 429 with the counts. |
| `COUNTERFACTUAL_RUN` | off | `on` adds the tool-less comparison run to every brief (one more model call, not shown in the document). |

Change them without a redeploy: `az containerapp update -n gigcast -g rg-gigcast --set-env-vars MAX_CONCURRENT_RUNS=6` (the deploy script resets them to its values on the next run, so change the script too). The external limits are the Qloo key (10 requests per second; the shared client stays at 8, and 50,000 requests a month) and Vertex AI's per-minute quota for the planner model; the Vertex client retries 429 and overload answers four times. More CPU or memory needs the 1:2 ratio Container Apps requires (`--cpu 2.0 --memory 4.0Gi`); the replica metrics above say when that is due. A second replica works (the SSE endpoint falls back to polling the database for runs on another replica) but doubles the Vertex concurrency and the cost; raise `MAX_CONCURRENT_RUNS` first.

## Privacy note

No account, no cookie for visitors (the only cookie is the operator's on `/admin`), no raw address anywhere, daily-rotating visitor ids, user agents trimmed, query strings dropped. The log exists to size the service and to notice abuse, nothing else.
