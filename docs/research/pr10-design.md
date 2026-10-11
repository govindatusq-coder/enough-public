# PR10 — research consent and event design

**Status: proposed for approval.** This PR changes documentation only. It creates no table, enrolment flow, event collector, survey or export endpoint. Research implementation starts only after this design is approved, as the supplied ENOUGH brief requires. Research remains off for every existing account.

## Participant experience

Offer an optional Research section in My Pins after the approved participant information is supplied. Browsing, PINS, AI permission, native health access and app use remain independent of research participation. Show the full participant information, study contact and version, then an unchecked consent control. Consent requires an authenticated, non-anonymous account and a deliberate confirmation. No preselection, inferred consent, bundled AI permission or automatic enrolment of old accounts.

After consent, show the current study status, information version and consent time; baseline and due week 4/8/12 surveys; a download of the person's own research records; and Withdraw from research. Surveys can be skipped without app penalties or missed-survey messages. Withdrawal offers stop future collection and, separately, delete existing research records. Account deletion also removes identifiable research records and the participant mapping. Confirm the actual handling of previously released exports in the approved information sheet; never promise that downloaded research files can be recalled.

The study team must supply the participant information and survey text. Do not invent these, participant eligibility, investigator names, institutional/ethics approval, compensation, retention periods or contact details. These are release blockers, not placeholders shown as finished information.

## Data model

All research data lives in separate relations. Add no research consent, participant flag, events, raw surveys or research free text to `enough_accounts.state_json`. The normal app outcome and weekly-review fields from PR5/PR7 stay ordinary account features. The collector derives only approved coded values after consent.

| Relation | Fields and purpose | Access |
| --- | --- | --- |
| `enough_research_studies` | Study ID; immutable published information/survey versions; approved information document/text; configured relative-day windows for baseline/4/8/12; schema version; enrolment enabled flag; approved retention policy | Published information/config may be read; only a privileged study administrator can publish or change enrolment status. No participant identity here. |
| `enough_research_participants` | Random study-scoped `participant_id`; authenticated `user_id`; `study_id`; consent version pointer; enrolment timestamp and IANA timezone; withdrawal timestamp; current collection status. Unique `(study_id,user_id)` | Own participant can read. Enrol/withdraw/delete through authenticated server/RPC transactions, never direct arbitrary updates. Identity mapping never enters a research export. |
| `enough_research_consents` | Immutable consent/withdrawal record ID; participant and owner; decision enum `consent`/`withdraw`; information version; consent statement version; server timestamp | Owner-scoped insert/read via verified workflow. No participant update/delete. Privileged deletion is permitted for withdrawal/account erasure. No signature image, IP address or device fingerprint. |
| `enough_research_events` | Event ID; participant/owner/study; schema version; event type; immutable strict payload; server occurred time; random idempotency key | Owner-scoped insert/read, gated on current consent and event schema. No participant update/delete; privileged erasure only. Index `(participant_id,occurred_at,event_id)` and unique `(participant_id,idempotency_key)`. |
| `enough_research_survey_responses` | Participant/owner/study; checkpoint enum baseline/week4/week8/week12; exact questionnaire version; bounded typed answers keyed by published question ID; submitted timestamp | Owner insert/read through the survey workflow. One final response per participant/checkpoint/version. No answer-derived app ranking. Privileged erasure permitted. |
| `enough_private.research_references` | Participant/owner/study; random study-scoped idea/plan reference; source app entry or private AI idea ID. Unique per participant/source reference | Server only; validate the source reference belongs to the owner before allocating. No historic backfill or identity/text in exported references. Cascade deletion with the participant; never expose the private mapping to researchers. |
| `enough_research_export_audit` | Export ID; authorising staff identity in a private schema; requested study/filter/version; creation time; row count; expiry/deletion time | Server/study staff only. No participant event free text or copies of exported payloads in operational logs. |

Owner columns on consent, event and survey records use a composite foreign key to the participant's `(participant_id,user_id,study_id)`, so a caller cannot combine their user ID with somebody else's participant ID. All identity foreign keys support account deletion. The participant mapping is sensitive personal data; random IDs make exports pseudonymous, not automatically anonymous.

## RLS and immutable writes

Enable RLS on every research relation and explicitly revoke `public` and `anon` privileges. For consent/events/surveys, grant authenticated users only the required insert/select paths. Owner SELECT requires `(select auth.uid()) = user_id`, plus a non-anonymous session; a withdrawn participant can still read/export their retained records. INSERT requires the same owner check, matching study/participant, an open permitted operation and the applicable current consent/version. Never allow an event just because its request body says `consented:true`.

Publish mutations through narrowly scoped authenticated server endpoints and SQL RPCs that check `auth.uid()` themselves. Prefer security invoker. Any definer function needed for enrolment/withdrawal has an empty search path, fully qualified relations, explicit ownership/authentication checks and narrowly granted execute rights. A definer is not an escape from RLS ownership checks. Consent INSERT validation must invoke the same atomic status transition, including direct authenticated database writes; a standalone withdrawal ledger row must never leave collection active. Implement that transition in a narrowly authorised trigger/RPC and test it explicitly.

Use RLS, column/table privileges and database constraints/validators together. No UPDATE/DELETE policies or grants for participant event/consent records. A defence trigger rejects UPDATE of events for every role; restricted privileged DELETE supports erasure. Users cannot directly edit participant collection status, published study versions or export authority. RLS alone is not sufficient for privileged server paths; their code and queries also enforce ownership and consent.

An event validator accepts only the exact keys and types for its `event_type` and `schema_version`; unknown fields, free text, invalid enum values, mismatched references, non-finite numbers and excessive payload size fail closed. Enforce validation in both the shared server schema and a database CHECK/trigger, so a direct authenticated database call cannot insert a different payload. Validate consent decisions against a published information/statement version. Reject future event times supplied by a client; the event time is assigned by the server.

### Consent/withdrawal race

Event insertion locks the matching participant row, checks active consent and schema, then inserts in the same transaction. Withdrawal locks that same row, appends a withdrawal decision and sets the participant inactive atomically. These operations serialise: a transaction admitted before withdrawal may finish before it; any collector transaction that acquires the lock after withdrawal must fail. Do not replay offline events collected before enrolment or queued before withdrawal.

Withdrawal is idempotent and immediately removes collection eligibility. Drop in-memory queued events, stop new view/reminder/survey calls and show the saved status. Every server write still rechecks the database; a stale tab or reconnect cannot resume collection. Withdraw/delete RPCs must work even if the app snapshot has a revision conflict. App-account deletion includes research deletion in the existing server deletion path and tests rollback on partial failure.

## Typed event catalogue

Shared fields are `schema_version: 1`, server `occurred_at`, study-scoped random participant ID and idempotency key. The payload is the exact union below; strings not explicitly listed as enums or UUIDs are forbidden. A missing optional answer is JSON null, never fabricated as No. `idea` is a library ID (public template) or a random study-scoped AI idea reference, plus source/category/intensity/breaksSitting. Do not export private AI titles, prompts, generated copy, image briefs or title-derived hashes.

| Event | Exact payload fields | Trigger and meaning |
| --- | --- | --- |
| `idea_viewed` | `idea`; `surface`: home/moves/detail/reels | A card/detail is actually visible to the participant, not merely rendered or prefetched. Emit once per idea/surface/view session; no scroll coordinates or browsing history outside ENOUGH. |
| `idea_saved` | `idea`; `action`: saved/removed | Confirmed app save/remove transition; not an optimistic click that failed. |
| `idea_accepted` | `idea`; random participant-scoped `plan_ref` | A persisted accepted intent; never counted as completed movement. |
| `plan_created` | `idea`; `plan_ref`; `goal_type`: open/smart; `has_routine_link`: boolean; `reminder_type`: none/in_app/calendar_export | First saved support plan. Excludes goal, cue, place, buddy, commitment and fallback text. |
| `reminder` | `plan_ref`; `type`: in_app/calendar_export; `action`: shown/dismissed/exported | Only an observed app reminder or downloaded calendar file. Do not claim delivery by the OS/calendar or collect background inactivity. |
| `outcome_confirmed` | `idea`; `plan_ref`; `reported_minutes`: integer 0–240; `worthwhile`: boolean; `broke_sitting`: yes/no/unsure/null; `plan_moment`: yes/different_time/no/null | After the user's outcome is successfully saved. Self-report only. No money, names, photos, exact location, native totals or outcome free text. |
| `weekly_review` | relative local `week_index`: non-negative integer; `plans`: list of participant-scoped plan refs and keep/change/pause; `answered_worked`, `answered_barrier`, `answered_small_fix`: booleans | After one local-week review is saved. No review text or length/content analysis. Corrections use a new append-only event with `supersedes_event_id` checked to belong to the same participant and type. |
| `threshold_changed` | `metric`: steps/exercise_minutes; `choice`: usual_amount/no_limit/unset; `threshold`: positive bounded integer/null; `keep_sitting_breaks`: boolean | Only a deliberate persisted settings change. Steps max 100000; minutes max 1440; no_limit/unset requires null. No daily actual reading or inferred baseline is collected. |
| `ai_permission_changed` | `choice`: full/without_health/declined; `permission_version`: positive integer | After a saved AI choice. Research consent remains separate; no OpenAI payload, health needs or model output is included. |

For all events, references must belong to the authenticated participant and point to their valid app action or the public library. The event ID/idempotency key prevents duplicate network retries. Corrections append and explicitly supersede a same-owner same-type event; the authorised analysis view selects the current record, preserving original audit history. Add this nullable UUID field to every event schema only where corrections are defined; it is not a generic arbitrary metadata bag.

Research events may be lost when a consented action finishes while offline and is not later observable. Prefer a precise missing record to collecting without consent or inventing a completion. Track pipeline failure counts without payloads or identities; do not block the ordinary app when research collection fails.

## Surveys

Store approved question IDs, wording, options, type and schema in immutable study configuration. Allow bounded integer scales, explicit option enums, booleans and bounded multi-select choices; introduce no generic JSON answers or arbitrary written answers in the first version. If supplied study instruments require written answers, seek separate approval for storage, retention and exclusion from export before implementing them.

Checkpoint offsets and open/close windows are configured in relative local calendar days from enrolment (baseline and nominal 28/56/84-day checkpoints), rather than hard-coded UI text. Store the enrolment timezone privately for stable scheduling and use calendar arithmetic across DST. Recheck current consent at rendering/submission. The My Pins Research panel shows a due optional survey; no push, email, missed-week messaging or background scheduling. Questionnaire wording and version come only from approved configuration. Baseline need not block app use or invalidate consent when skipped.

## Server-only research export

Create a privileged export endpoint unavailable to ordinary authenticated/anonymous users, protected by verified server-side staff authorisation, separate from participant account export. The client never receives a service-role key. The server queries a dedicated allowlist projection, not `select *` followed by deletion of columns.

An export contains a random study participant ID, schema/questionnaire versions, approved coded payload fields, checkpoint and relative day/week indexes. Strip user/auth IDs, emails, names, companion names, profile/needs text, goals/plans, review text, photos/URLs, QR values, raw health data, IP/device identifiers, exact enrolment/event timestamps and private AI content. Survey export includes only approved typed codes, never question-response free text. Public library IDs can support template analysis; private AI/plan references are randomised within the study. No researcher-accessible join to `enough_accounts` or the identity mapping.

Require an explicit study/filter/date-range request and authorised study membership; audit who exported and how many rows, without logging rows. Stream a bounded download or short-lived private object, disable caching and public links, expire/delete temporary files under the approved retention policy, and exclude withdrawn/deleted participants by default. Define any approved retention of previously consented data in the information sheet before collection begins. Restricted small-cohort output can still permit re-identification; assess release granularity with the study team instead of labelling exports anonymous.

Participant download is a separate authenticated owner-only path that includes their own retained consents/events/survey answers and withdrawal status, with readable explanations. It does not grant research export access. Normal ENOUGH account export should offer a separate research download rather than embedding research data in `state_json`.

## Proposed API boundaries

| Route | Authorisation and responsibility |
| --- | --- |
| `GET /api/research/status` | Signed-in owner. Current study version, own consent status and due checkpoints; no enrolment on read. |
| `POST /api/research/consent` | Same-origin, signed-in non-anonymous owner; exact published version and explicit checked consent; idempotent enrol transaction. |
| `POST /api/research/events` | Same-origin owner, strict small bounded batch; server ownership/reference/schema checks; active-consent lock and insert; no pre-consent queue. |
| `POST /api/research/surveys/:checkpoint` | Same-origin owner; configured window/version/typed answers; active consent; retry-safe final submission. |
| `POST /api/research/withdraw` | Same-origin owner; atomic withdrawal; optional separately confirmed erasure. Collection eligibility closes before deletion starts. |
| `GET /api/research/me/export` | Signed-in owner; no-store download of their own records. |
| `POST /api/research/export` | Server-verified authorised study staff only; explicit allowlist projection, audit and restricted expiring download. |

Body-supplied user IDs/participant IDs never establish authority. Enrolment returns an opaque own participant reference for UI use; the server derives ownership from the verified session. Do not reuse the normal app write endpoint to store research rows.

## Implementation sequence after approval

1. Receive and approve participant information, consent statement, eligibility, retention/withdrawal policy, study staff access and baseline/week4/week8/week12 instrument text. Publish immutable study versions with enrolment disabled.
2. Create migrations with the Supabase CLI. Add tables, owner indexes/FKs, grants/RLS, immutable events and transactional consent/withdrawal functions in a staging environment. Keep collection and enrolment off during rollout. No new service or dependency is proposed.
3. Add shared strict payload/survey schemas, server endpoints and separate participant/staff exports. Wire only the approved app transitions after successful normal app saves. Use consent/version checks at every collector boundary; normal app failures and research failures remain independent.
4. Add the optional Research panel, participant information and surveys. Run the complete acceptance matrix below with two participants, an anonymous account and a staff identity. Review Supabase security/performance advisors, export fields and deletion evidence.
5. Review the final implementation, privacy/information text and evidence before enabling enrolment. Release only after the required approval; keep a server kill switch that immediately stops enrolment/event collection.

## Acceptance and rollback

- Legacy/non-participant accounts generate no research requests or records. PINS/AI/health choices cannot enrol them. Unchecked consent, stale information versions and anonymous sessions fail.
- Participant A cannot insert/read/update/delete B's records or forge owner/reference IDs. Ordinary users cannot call staff export, access participant mappings or edit published studies. Direct authenticated database inserts receive the same schema/consent validation. Users cannot alter existing event rows, including through RPCs.
- Each exact event schema rejects arbitrary metadata, unexpected fields, free text, identity markers, NaN/out-of-range values and private AI content. Outcome tests distinguish intention, confirmation, missing answers and explicit No. Failed app saves do not emit successful events. Retries do not duplicate events; correction ownership/type is enforced.
- Test event insertion racing withdrawal, direct consent/withdrawal inserts, multiple tabs, offline/reconnect, idempotent repeated withdrawal, immediate stop, requested deletion and ordinary account deletion. A partial delete fails visibly and does not re-enable collection. Retained rows remain owner-readable until erased.
- Test baseline/4/8/12 configured windows across local midnight/DST, optional skipped surveys, questionnaire version changes and withdrawal during submission. No app blocking, catch-up alerts or research notes in the normal account snapshot.
- Export tests assert a complete allowed field set, not just absence of two named identifiers. Seed identity/free-text/photo/health markers and prove none occur in staff exports or logs. Check pseudonymisation, staff scope, withdrawal exclusion, download expiry and deletion. Test staff revocation and denied ordinary-user access.
- Rollback disables enrolment and the collector server-side first, then reverts UI/endpoints. Keep own-data download, withdrawal and deletion available while approved research records exist. Never silently destroy records or reactivate collection to recover a release.

## Decisions requested

Approve the separate-table ownership model, strict coded event union, transactional withdrawal and server-only allowlist exports. Confirm the study team's participant information, instruments, identity/retention policy and authorised researchers before implementation. Until both are resolved, no research data is collected.
