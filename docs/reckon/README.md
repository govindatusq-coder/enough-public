# Reckon — personal OS prototype

**Ideas, lived.** Bring the ideas that matter out of your feed and into your life.

Reckon lives inside this Next.js app at **`/reckon`**. The existing ENOUGH
experience at `/` is untouched; Reckon reuses the stack (Next 16, React 19,
TypeScript, Tailwind 4 build pipeline, zod) and adds one dependency,
`@anthropic-ai/sdk`, for server-side structured AI calls.

## The loop it tests

```
SOCIAL CONTENT → DISTIL → USER CONFIRMS MEANING → FIND COMMON THREADS →
CONVERSATION → PERSONAL FORMULATION → GOAL / EXPERIMENT / PRACTICE →
REAL LIFE → REFLECTION → LEARNING → PERSONAL OS
```

| Screen | Route | What it does |
|---|---|---|
| Home | `/reckon` | Greeting, at most three cards (something worth carrying, something you're trying / "Did this come up?", Reckon noticed something), **+ Add to Reckon** |
| Add to Reckon | `/reckon/add` | Paste a link (Instagram / TikTok / YouTube / web), add text, or upload an image → *Adding to Reckon…* → **What caught you?** → **What I think you wanted to keep** → *What would you like this idea to do for you?* |
| My Reckons | `/reckon/library` | Premium cards, search by meaning, status filters, **Find the thread** |
| Reckon detail | `/reckon/items/[id]` | Source embed, AI reading vs. confirmed takeaway, route, threads, delete |
| Find the thread | `/reckon/thread` | Structured clustering → cautious theme proposal → Yes / A little / Not really / Tell me more |
| Talk to Reckon | `/reckon/chat` | Staged conversation (opening → situation → mechanism → offer → experiment) with retrieved context; proposes an experiment only after "Want to try something?" |
| My Reckon | `/reckon/me` | Things I'm trying + the seven Personal OS sections, each entry with status, confidence, evidence, *That's right / Not quite / Remove / Why does Reckon think this?* |
| Experiment | `/reckon/trying/[id]` | What matters / noticing / testing / when / try / success means; *This came up* → reflection pathway; cautious n-of-1 summary; consolidation |
| Reckon Lab | `/reckon/lab` | Development view: ingestion attempts per URL, AI representations and call log, Personal OS facts by status, experiment telemetry, **Load Govind's test batch**, seed data, reset |

## Running

```bash
pnpm install --frozen-lockfile
cp .env.example .env.local        # Supabase public values are needed by the existing ENOUGH proxy
echo 'ANTHROPIC_API_KEY=sk-ant-…' >> .env.local   # optional; without it Reckon uses deterministic fallbacks
pnpm dev --hostname 127.0.0.1     # http://127.0.0.1:3000/reckon
pnpm test && pnpm lint && pnpm typecheck && pnpm build
```

Environment variables (all server-only; nothing is exposed to the client):

| Variable | Purpose |
|---|---|
| `ANTHROPIC_API_KEY` | Enables the model. Absent → every AI function falls back to the heuristics in `lib/reckon/ai/fallback.ts`, and the Lab says so. |
| `RECKON_AI_MODEL` | Defaults to `claude-opus-5-5`. |
| `INSTAGRAM_OEMBED_TOKEN` | Facebook app token for the official Instagram oEmbed endpoint. Absent → that method is recorded as "not configured" and skipped. |
| `NEXT_PUBLIC_RECKON_DEV_TOOLS=1` | Shows dev-only buttons (seed data) outside development. The Lab route itself is always reachable. |

## Architecture

```
lib/reckon/
  types.ts        entities: User, Source, IngestionRecord, ReckonItem, Insight, Takeaway, Route,
                  SemanticFeatures, Theme, ThemeEvidence, Goal, Experiment, Reflection (attempt),
                  Conversation, ConversationMessage, PersonalOSFact (+ PersonalPrinciple/Pattern)
  model.ts        pure state transitions (add/confirm/route/theme/experiment/reflection/fact/delete)
  store.tsx       React context + localStorage persistence (swappable for Supabase)
  platform.ts     URL → platform/type/canonical/externalId/embedUrl
  ingest/parse.ts Open Graph / Instagram embed parsing (pure)
  ingest/retrieve.ts   server retrieval with a recorded attempt per method
  facets.ts       controlled psychological vocabulary + tokeniser
  threads.ts      vectors, cosine, average-linkage clustering, novelty vs. existing themes
  retrieval.ts    context selection for chat (what the model is allowed to see)
  reflection.ts   OPPORTUNITY → RETRIEVAL → TRANSFER → CONSEQUENCE, barrier model
  learning.ts     cautious n-of-1 summaries, consolidation readiness
  os.ts           Personal OS proposals derived from evidence (never from rejected themes)
  safety.ts       safe-response pathway
  seed.ts         synthetic clusters A and B plus noise; Govind's test batch
  ai/provider.ts  Anthropic client, structured outputs, shared guardrails
  ai/schemas.ts   zod output schemas
  ai/functions.ts the twelve functions with model-or-fallback dispatch
  ai/fallback.ts  deterministic heuristics (scripted conversation included)
  ai/prompts/     one documented prompt per function (see README there)
app/api/reckon/   ingest, status, ai/[fn]  — stateless; the browser sends only what a call needs
app/reckon/       screens;   components/reckon/   UI incl. <ReckonMark />
tests/reckon-*.test.mjs
```

### The one rule

Source content, AI inference and user-confirmed meaning are different records:

* `Source` holds only what retrieval legitimately returned (or what the user typed/uploaded). Empty fields stay empty.
* `ReckonItem.distilled` is the AI's reading (`provenance.kind: 'ai'`).
* `ReckonItem.takeaway` exists only after the user confirms or edits, and is the canonical meaning.
* `Theme`, `Route` and `PersonalOSFact` carry `status: proposed | user_confirmed | user_modified | rejected`. Rejected records are kept so they are never re-proposed and never feed the Personal OS or chat context.
* Everything meaningful has `provenance`, `confidence` and `evidence` links; "Why does Reckon think this?" reads them back.

### Ingestion honesty

`retrieveSource()` runs a per-platform plan and records every attempt (method, URL, HTTP status, final URL, fields, error, note). Status is `retrieved` only when there is a caption/transcript long enough to interpret; otherwise `partial`, `unavailable` (the platform answered but declined) or `failed` (network). Instagram has no legitimate transcript source, and that is recorded on every Instagram source. The browser-side embed iframe is shown regardless, because the user's browser may be allowed what the server is not; the Lab labels it "not verified server-side".

### Where a native share extension plugs in

`/reckon/add?url=…` is the single entry point. An iOS Share Extension (or Android intent) only needs to open that URL, or POST to `/api/reckon/ingest` and hand the result to the same flow.

## Privacy

Data classes are separate in the schema: source data, AI inferences, user-confirmed data, conversation data, experiment data. Everything stays in the browser (`localStorage` key `reckon:v1`) unless an AI function is called; chat sends only the context `retrieval.ts` selects, and each message records what was sent. Individual Reckons can be deleted (cascading to sources, theme evidence and OS evidence); Personal OS entries can be removed or corrected. The API key lives only in server environment variables. Reckon is a reflection tool, not therapy, diagnosis or crisis care; `safety.ts` steps out of the goal engine when a message suggests immediate risk.
