# Reckon prototype — verification record, 22 October 2026

## Summary

The vertical slice **Add Reel → What caught you? → Confirm insight → My Reckons → Find the thread → Chat → Experiment → Reflection → My Reckon** is built and was driven end to end in an iPhone 13-sized headless Chromium against the dev server, twice, with zero page errors. Unit tests, lint, TypeScript and the production build pass.

| Check | Result |
|---|---|
| `pnpm test` (node --test) | 164 passed, 0 failed (144 existing ENOUGH tests + 20 Reckon tests) |
| `pnpm lint` (Reckon surfaces, React Compiler rules on) | clean |
| `pnpm typecheck` | clean |
| `pnpm build` (production, webpack) | success; `/reckon/*` and `/api/reckon/*` routes emitted |
| Browser journey (Playwright, iPhone 13, desktop 1280×900) | both scripts completed; `CONSOLE ERRORS: []`, `PAGE ERRORS: []` |

## What the five Instagram URLs actually yielded

The five URLs were queued with **Load Govind's test batch** and processed one by one. In this execution environment every outbound request to `instagram.com` and `graph.facebook.com` is refused by the sandbox proxy (`CONNECT tunnel failed, response 403`), so the retrieval result for each was:

| URL | oembed | open_graph | embed_page | status | content to AI |
|---|---|---|---|---|---|
| /p/DcqQ7sMgBjE/ | skipped — `INSTAGRAM_OEMBED_TOKEN` not configured | fetch failed (proxy 403) | fetch failed (proxy 403) | `failed` | no |
| /p/DaZvB19N3U9/ | skipped | fetch failed | fetch failed | `failed` | no |
| /p/DesL5HSpWrW/ | skipped | fetch failed | fetch failed | `failed` | no |
| /p/DeSD_e6IAdH/ | skipped | fetch failed | fetch failed | `failed` | no |
| /p/Deom1cklqvC/ | skipped | fetch failed | fetch failed | `failed` | no |

Nothing was invented: title, caption, transcript, thumbnail and author stayed empty; `transcriptAvailable: false`; every attempt, status and error is visible in **Reckon Lab → Ingestion**. The user-facing screen showed the elegant fallback (*I couldn't reliably read this Reel. What caught you about it?* with Tell Reckon / Write it / Just keep it) and **Reckon it for me** was correctly withheld.

What this means for the experiment:

* **Not yet known:** what Instagram returns to a Vercel function for these posts. The pipeline tries, in order, the official oEmbed (needs a Facebook app token), the public page's Open Graph tags (Instagram often answers a login redirect to server fetches; that is detected and recorded as `unavailable`), and the public captioned-embed page (which, when served, carries the caption and a thumbnail). Each is recorded separately, so the first deployed run will answer the question per method.
* **Known:** there is no legitimate transcript source for Reels. Audio is not transcribed. Any Reel whose meaning lives in the audio will always go through *What caught you?*; that fallback is the primary path, not an error path.
* **Known:** YouTube and TikTok public oEmbed return title/author/thumbnail only (unit-tested with mocked responses); the live calls were also blocked here.

## What works (observed in the browser)

1. Queue of five real links → each goes *Adding to Reckon…* → *What caught you?* with the Instagram embed slot and *Open original* → Write it → **What I think you wanted to keep** → Exactly → route suggestion → *Kept, your way* with the ripple → *Next saved link (n left)*.
2. Manual text → **Reckon it for me** is offered (content available) → proposal → *Not quite* → edited wording stored as `user_modified` with the original proposal retained → routed to *Something I want to live by* → appears under *Principles I want to live by* as a **proposed** fact with evidence.
3. *Just keep it* → item sits in My Reckons as "Kept, not yet reckoned" → finished later from the item page.
4. My Reckons: cards, status chips, search by meaning (facets + tokens over confirmed takeaways and semantic features), filters.
5. Find the thread on real + seed data: structured clustering found the "starting before you feel ready" cluster (6 items, including the two real-link takeaways that fit) and the "saying no and holding boundaries" cluster; noise items (recipe, coastal walk, mobility, dog) were excluded. Proposal wording: *I'm noticing something. … I might be reading too much into it. Does this actually show up in your life?* with Yes / A little / Not really / Tell me more / I'd put it differently.
6. Tell me more → Talk to Reckon opens with the thread, asks one question, then *What tends to happen at the moment you intend to start?*, then reflects a mechanism citing saved items and asks *Want to test that?* → Yes → experiment proposal card (What matters / What I'm noticing / What we're testing / When / Try / Success means = "I started.") → Try this / Adjust / Not now.
7. The experiment appears on Home; after **Bring check-ins forward** (Lab) Home shows **Did this come up?** → Yes → remembered → tried → helped → cautious reply. A second pass with *didn't try → Old habit took over* produced the competing-response message, not a compliance scolding.
8. My Reckon: What matters (user-stated), Ideas I keep returning to (confirmed thread), Patterns (proposed from the experiment, with experiment + conversation evidence), Principles, and *Why does Reckon think this?* answering from evidence. That's right / Not quite / Remove work; removed facts are never re-proposed (tested).
9. Delete a Reckon → source, theme evidence and OS evidence cascade (tested + browser).
10. Safety: a message suggesting self-harm receives the safe-response pathway and no experiment logic.
11. Desktop presents the phone frame over the coastal backdrop; mobile is the primary layout.

## What required fallback

* **All five Instagram retrievals** (network blocked here) → *What caught you?* path.
* **All AI functions** ran on the deterministic fallbacks because no `ANTHROPIC_API_KEY` exists in this environment. The model path (`@anthropic-ai/sdk`, structured outputs via `zodOutputFormat`, `claude-opus-5-5`, server-side refusal fallbacks) compiles and is wired, but has **not been exercised against the live API**. The Lab's AI tab shows `provider: fallback` for every call and will show `anthropic` once a key is set. Expect the scripted conversation to be noticeably more generic than the model-driven one.
* Embeddings: the provider has no embeddings endpoint, so `embeddingStatus` is `features_only`; clustering compares structured facets + tokens. Recorded in the Lab.

## Addendum, same day: first preview deployment

Vercel's GitHub integration built the PR automatically (preview `enough-public-git-claude-epic-thompson-9gl5vu-govindatusq-5192.vercel.app`). The first manual attempt to add a Reel there showed *Bad response*: the ingest API returned a non-JSON body. Changes made in response:

* `/api/reckon/*` is now excluded from the Supabase session middleware in `proxy.ts`; Reckon's API is stateless and must not depend on ENOUGH's Supabase env vars being present on preview deployments.
* The ingest handler (`lib/reckon/ingest/handler.ts`, unit-tested) always answers JSON; an unexpected server error becomes an honest `failed` IngestionRecord.
* The capture flow no longer stops on a server failure: the link is kept with a `failed` record that names the HTTP status and body (visible in the Lab) and the user goes straight to *What caught you?*.
* The Lab shows when the status endpoint itself is failing on a deployment.

## Addendum: what Instagram actually returned to Vercel

On the deployed preview (build `f4438f8`), adding `https://www.instagram.com/p/DcqQ7sMgBjE/` produced a *Reckon it for me* proposal, which means the **Open Graph fetch from Vercel's network succeeded**. Instagram served `og:description` in its usual shape:

```
13K likes, 19 comments - justinxiao_ on August 30, 2026: "Qi Gong / Side Quest Sunday EP Qigong is a gentle mind-body practice combining slow movement,…"
```

So for public posts, a Vercel function can legitimately obtain the account, date, engagement counts, a thumbnail and the **beginning of the caption** (Instagram truncates it with an ellipsis). The first build quoted that whole string as the takeaway; it now:

* parses the description into caption / author / date / counts (`parseInstagramOg`), keeping counts as attempt notes rather than meaning;
* flags a truncated caption and continues to the public embed page, keeping the longer caption if that page serves one;
* records "caption truncated by the platform" on the source when nothing longer was found.

Still unknown: whether the embed page serves full captions from Vercel (the next test batch run will show it per URL in the Lab), and whether the other four URLs behave the same.

## Known limitations

* Live Instagram behaviour unverified from this sandbox (see above). The first deployed run of the test batch is the real experiment.
* Voice input uses the browser's Web Speech API (Safari/Chrome); not available in headless Chromium, so the *Tell Reckon* button was rendered but its transcription was not tested.
* Image upload: the image is downscaled client-side and stored as a data URL; reading it needs the model (vision). Without a key the user describes it.
* Persistence is `localStorage` only (single device, no auth). Supabase is wired for ENOUGH but not for Reckon yet; the store is the single swap point.
* Home "appropriate future opportunity" is a simple next-morning check-in after each reflection (plus the *This came up* button on the experiment). Contextual cues (time/place) are not implemented.
* Theme proposals are limited to two per lookup and are not re-proposed for the same item set once answered.
* The pre-existing ENOUGH code has lint findings under the new eslint flat config; `pnpm lint` is scoped to the Reckon surfaces.

## What to test next with a real user

1. **Deploy and run Load Govind's test batch** on Vercel; read Lab → Ingestion to learn which of oEmbed / Open Graph / embed_page Instagram actually serves, then decide whether a Facebook app token is worth configuring.
2. Set `ANTHROPIC_API_KEY` and repeat the five-Reel capture: does *Reckon it for me* appear when a caption exists, and does its proposal feel like "this understands why I saved it"? Measure how often the user taps Exactly vs. Not quite.
3. Find the thread on the user's own 5–10 real Reckons (no seeds): does the proposed theme feel personally meaningful (Yes / A little / Not really rates)?
4. One real conversation to an experiment: does the question count stay at one per turn, and does the user accept the proposal without editing?
5. One week of real-life reflections: are check-ins answered, which barriers appear, and does anything reach *working* or get honestly retired?
