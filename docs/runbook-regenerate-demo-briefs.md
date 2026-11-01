# Runbook: deploy the calibration pass and regenerate the demo briefs

For David, after PR #20. Each step is copy-pasteable; run them in order. Every command runs from the repo root with the local env file loaded (the deploy script and `pnpm briefs:dedupe` read it themselves; `node .cache/ops/with-env.mjs <cmd>` runs any other command with it).

## 1. Merge and deploy

```sh
gh pr merge 20 --squash --delete-branch
git checkout main && git pull
./deploy/azure-container-apps.sh
```

Confirm the new prefix is live: open any brief, for example https://gigcast.ai/brief/brief_WrbnFK3nLd, and check that the page opens with **Read this first · Decision snapshot** above the Audience map and that the verdict badge reads "Promising cultural fit" (not "Promising"). If the old badge shows, the revision has not switched yet; wait a minute and reload.

## 2. Regenerate the six featured briefs

Same inputs as the current examples, copied not retyped. Through `/new`: pick the market card, type the artist and pick it from the suggestions, enter the dates, leave the promoter fields empty, "Generate brief". Start four, then the other two: with `MAX_CONCURRENT_RUNS=4` the fifth and sixth show "Queued" and start on their own, which exercises the queue. Expect 5 to 9 minutes each (the current ones took 278 to 496 s); Qloo answers come from the Postgres cache, so the time is the model composing.

| Market (quick pick) | Artist | Dates | Current brief |
| --- | --- | --- | --- |
| Mexico City | Natalia Lafourcade | 2027-03-05 to 2027-03-07 | `brief_EKSh8E9vLF` |
| São Paulo | Criolo | 2027-03-12 to 2027-03-14 | `brief_Cam3akRMVV` |
| Buenos Aires | Dante Spinetta | 2027-04-09 to 2027-04-10 | `brief_26zDghup9o` |
| New York City | Janelle Monáe | 2027-05-14 to 2027-05-15 | `brief_WrbnFK3nLd` |
| Los Angeles | Bad Bunny | 2027-04-16 to 2027-04-17 | `brief_Yk1FS1wVzc` |
| Tampa | Rick Ross | 2027-03-26 to 2027-03-27 | `brief_jdw0IpfNpr` |

The same six through the API, with the exact stored inputs (entity ids included where the form pinned them). Each call answers `201` with the new id; paste the ids into the table above as you go.

```sh
B=https://gigcast.ai/api/briefs
post() { curl -s -X POST "$B" -H 'content-type: application/json' -d "$1"; echo; }
post '{"artist":"Natalia Lafourcade","city":"Mexico City","country":"MX","dateFrom":"2027-03-05","dateTo":"2027-03-07","localityEntityId":"6A479AAF-1D8D-4EA2-AC1E-29B0906063AC","localityName":"Ciudad de México","marketId":"mexico-city"}'
post '{"artist":"Criolo","city":"São Paulo","country":"BR","dateFrom":"2027-03-12","dateTo":"2027-03-14","localityEntityId":"87DE0F46-8AF7-449B-8369-CC2296578282","localityName":"São Paulo","marketId":"sao-paulo"}'
post '{"artist":"Dante Spinetta","city":"Buenos Aires","country":"AR","dateFrom":"2027-04-09","dateTo":"2027-04-10","localityEntityId":"AC7D5EB0-92E9-4EF6-8243-81AA6853143E","localityName":"Buenos Aires","marketId":"buenos-aires"}'
post '{"artist":"Janelle Monáe","city":"New York City","country":"US","dateFrom":"2027-05-14","dateTo":"2027-05-15","artistEntityId":"5032D31E-1B79-4A40-901D-DCDDFA0F4493","localityEntityId":"81E61924-6CEE-4AB4-93D3-282A5C784AB8","localityName":"New York","marketId":"new-york-city"}'
# wait until two of the four above are complete, then:
post '{"artist":"Bad Bunny","city":"Los Angeles","country":"US","dateFrom":"2027-04-16","dateTo":"2027-04-17","marketId":"los-angeles"}'
post '{"artist":"Rick Ross","city":"Tampa","country":"US","dateFrom":"2027-03-26","dateTo":"2027-03-27","localityEntityId":"CF0B5657-4CBE-4B3F-9476-57644B5C87A1","localityName":"Tampa","marketId":"tampa"}'
```

Watch progress on https://gigcast.ai (the "Recent briefs" list shows Running and Queued) or with `curl -s "$B?limit=12"`.

## Done on 2026-11-01

Steps 1 to 3 were run on 2026-11-01 (PR #20 merged as `5c5ebc9`, deployed, the six briefs regenerated from the API in one burst so two of them queued). Results: `brief_OC6b4IqHiK` Natalia Lafourcade (`mixed`: the risk feed carried an October 2026 retirement announcement, so availability dominates), `brief_RjSmDPHv7f` Criolo, `brief_k2luc3u4Iw` Dante Spinetta, `brief_g_GQdaN3Ty` Janelle Monáe, `brief_MgSLJrw2pC` Bad Bunny and `brief_JF-PI2-k7f` Rick Ross (all `promising`); 339 to 579 s each. The dedupe dry run would have kept the OLD Natalia Lafourcade brief (three more grounded items), so the retirement was done by id instead (`.cache/ops/retire-old-featured.mts`, same backup format, backup in `.cache/backups/briefs-retire-2026-11-01T02-35-39-935Z.json`): five old briefs deleted and `brief_EKSh8E9vLF` unlisted (`is_public = false`) rather than deleted, because `/compare` cites it as the evidence brief and its "Open the brief" link must keep working. Unlisted briefs stay reachable by link and leave every list.

## 3. Only after all six are `complete`: dedupe, then check the landing

`pnpm briefs:dedupe` reads `DATABASE_URL` from the local env file, which points at Neon: this is the one sanctioned production write of the runbook. The dry run prints each artist-and-locality group and which brief it would keep (the most complete, newest among equals); `--yes` backs the losers up to `.cache/backups/<timestamp>/` as JSON before deleting them.

```sh
pnpm briefs:dedupe          # dry run: read it, every featured group should keep the NEW id
pnpm briefs:dedupe --yes    # backs up to .cache/backups, then deletes the old copies
```

Then reload https://gigcast.ai and confirm that "See a finished brief" opens the new ids for the six markets and that "Recent briefs" shows each artist and city once. (The list already collapses duplicates in the query, so a stale duplicate would only show up on `/market/:slug` counts, not on the landing.)

Before `--yes`, read the dry run: the dedupe keeps the most complete brief, not the newest, so a regenerated brief with fewer grounded items loses to the old one. When that happens, or when an old brief is cited by `/compare`, retire by id (delete with a backup, or unlist with `is_public = false`) instead of running `--yes`.

If a regenerated brief ends `partial` or `failed`, open it and press "Run this brief again" before deduping; the dedupe keeps the most complete copy, so a failed rerun never replaces a complete brief.

## 4. Verdicts other than "Promising cultural fit"

Keep them. A `mixed` ("Conditional — verify before booking") or `insufficient_data` ("Insufficient evidence") verdict on a featured brief is the calibration working, not a defect.

`brief_QPoAU9Nb6V` (Aleks Syntek, New York City, `mixed`) is in Neon already. It is the newest complete brief of the New York market, so the landing's New York card shows it until a newer New York brief completes (the Janelle Monáe regeneration in step 2 will take the card back). If you want Aleks Syntek on the landing as the "Conditional" example, do not regenerate Janelle Monáe, or add `'Aleks Syntek'` to the New York entry's `sampleArtists` in `src/lib/markets.ts` so the market card suggests him; nothing else needs to change.

## 5. Final anonymous-window checklist (the judges' view)

Open a private window on https://gigcast.ai and check, in this order:

- [ ] Landing → "See a finished brief" → a brief opens in two clicks; the six cards show the new ids.
- [ ] On that brief, the Decision snapshot is readable in under a minute: verdict badge, "Cultural fit signal" with its band, top sponsor prospect, critical unknowns, next step, confidence.
- [ ] Section kickers run "Section 1 · Audience" to "Section 10 · Sources"; the Lineup header says "Artist compatibility (not locality-differentiated)" when the explainability is the headliner alone.
- [ ] The Risk panel's score reads "quiet", "elevated" or "high news volume" with the news-volume note, and no risk item links to open-meteo.com or date.nager.at.
- [ ] `/compare`: two stacked columns on a phone, "Pre-computed comparison, run on 2026-10-30", "Open the brief" link works.
- [ ] "Markdown" on a brief downloads a file that opens with "## Decision snapshot".
- [ ] "Drafts": every draft says "We are exploring a potential" and the caution box mentions outreach prospects.
- [ ] "Print": the preview is black on white, the snapshot sits on the first page with the header.
- [ ] `/about`: nine parts listed, "What the taste graph changes" section, honesty notes include "Cultural affinity is not ticket demand".
- [ ] `/market/new-york-city`: score card wording, recent briefs without duplicates.
- [ ] Phone width (390 px): landing, a brief, `/compare` and the drafts page scroll vertically only.
