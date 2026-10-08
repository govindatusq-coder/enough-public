# ENOUGH: synthetic Australian market and page review

**Review date: 8 October 2026.** Existing app: [enough-public.vercel.app](https://enough-public.vercel.app). Source reviewed: main at `474100b794ba49d9ef9259c99b7d063323899a50`, plus the preference-photo update accompanying this report.

The most promising next step is to make ENOUGH deliver a relevant idea with less attention from the user. The warm visual style and movement-inside-everyday-life proposition work together well. The larger risks are the amount of setup, the accuracy of personalisation, long mobile pages, and the effort required to record a small outcome.

**This is synthetic analysis, not customer research.** The 18 scenarios are fictional, authored for this review: six time-poor adults, six parents/carers and six adults who dislike conventional exercise. Their reactions are reviewer hypotheses. They are not interview participants, independent AI respondents, survey results, evidence of willingness to pay, or a representative Australian sample. No conversion rates, market size or statistical confidence are inferred from them.

Only the requested preference artwork has been changed in the app. The product changes below are recommendations.

## What was inspected

- Current source and a local production build at desktop 1440 px and mobile 390/320 px widths. Mobile here means the responsive website, not a separately tested installed native app.
- All eight onboarding screens; My Enough, My Moves, My Wins and My Pins; filters, grid/row browsing, idea details, Saved, Planned, support, confirmation, account gates, and representative empty/history states. There were 35 captured browser states. Navigation, persistence and selected interactions were exercised; a screenshot alone is not treated as an end-to-end test.
- The library recommendation engine was executed with all 18 synthetic profiles. Fixtures had no historical feedback, costs or generated AI ideas. Counts describe code output for those inputs, not whether a real person would find every returned idea appropriate.
- Sign-in/create-account, recovery, password update, sign-out and not-found pages were reviewed through source and public HTTP responses. The public homepage and four account pages returned 200; a missing route returned 404. No real credentials, email deliveries, account changes, private photo uploads, camera scans or native health permissions were exercised.
- Browser account/ideas/photos responses were controlled local fixtures. Confirmed outcomes were invented test data, never measured users. Desktop/mobile layouts showed no horizontal page overflow in the tested states. External Google font requests were blocked in the local browser, so exact page heights can differ with production fonts, content and devices. This was not a complete accessibility, security or performance audit.

The accompanying [scenario CSV](australian-synthetic-scenarios-2026-10-08.csv) includes the hypothetical contexts, full profile inputs, local AEST test hour, actual engine counts, first three returned ideas, and qualitative review hypotheses. Segment overlap is expected; assignments are a way to examine needs, not population categories.

## Australian market context

There is a credible problem to address, but that does not establish demand for this particular app. AIHW's article dated **17 June 2024**, using the **2022 National Health Survey**, reports that 37% of adults aged 18–64 did not meet the physical-activity component of the guidelines. Its much larger combined activity/strengthening figure measures a different criterion; it should not be used interchangeably or turned into ENOUGH's addressable market. AIHW also includes incidental work, transport and household activities in its description of physical activity. [1]

The Australian Sports Commission's participation evidence, updated **8 July 2025**, identifies time, financial and travel costs, opportunity cost and geographic infrastructure as relevant factors. This supports testing ENOUGH's practical fit, low added time and free activities. It does not prove those users want another app. [2]

The **2024 Carer Wellbeing Survey** was conducted February–April 2024 and involved 9,166 current and former carers. Its report describes poorer wellbeing and financial strain for many carers, with substantial differences by caring circumstances. Use this as a reason to reduce demands and respect supervision, fatigue and affordability, rather than to treat parents and all unpaid carers as one lifestyle. The publication landing page is dated **14 October 2024**. [3]

### Competitive position

| Existing alternative, verified from its own material | What it already supplies | ENOUGH's opportunity — an inference to test |
|---|---|---|
| Apple Health: automatically counts steps and walking/running distance; users can manage multiple data sources [4] | Recording and organising activity data | Explain what could fit into an existing task. Let health data supplement a decision; keep manual confirmation usable. |
| Heart Foundation Walking: free national program, walking groups and personal walking plans; page updated 13 January 2026 [5] | Trusted free walking support, both social and individual | Offer varied everyday movement mechanisms, including indoor and seated choices, without requiring attendance at a set time. Do not claim ENOUGH uniquely offers free movement. |
| Strava: clubs can be casual or competitive, with activity feeds and leaderboards [6] | Activity recording and community participation | Serve people who prefer private, flexible everyday returns. Do not assume every exercise-averse person dislikes social features or that all fitness apps are rigid. |
| Doing nothing new / using existing routines | No setup, account or reporting burden | A suggestion must improve a real day enough to justify opening ENOUGH. More features alone will not win this comparison. |

ENOUGH's useful distinction is **specific, credible combinations that preserve something the person already wants to do**. Its advantage needs to come from reliable fit and small effort, rather than generic exercise advice, a large dashboard, or photographs alone. A consumer subscription price or acquisition budget cannot be recommended from this review: free substitutes exist and willingness to pay has not been tested.

## Segment conclusions

| Segment | Job ENOUGH could serve | Simulated appeal | Likely friction hypothesis | Most useful next change |
|---|---|---|---|---|
| Time-poor adults | Fit movement into a call, work transition, errand or waiting period | Clear added-time information and an idea that keeps the original task | Eight setup screens, a tall mobile discovery header, optional support presented immediately after acceptance | Put a useful idea and **extra time** early; shorten visible setup and make support an explicit optional choice |
| Parents / carers | Find something that works while care and supervision continue | Irregular routines are valid; indoor/gentle options and no guilt suit interruptions | “With the kids” misses elder/partner care; caring routines currently lack matching aliases; a written need stops the feed after setup | Improve caring-routine mapping, show the written-needs limitation earlier, and add reviewed ideas that keep supervision intact |
| Exercise-averse adults | Enjoy or finish an existing activity without adopting a fitness identity | Private moments, worthwhile feedback, no streak loss or exercise debt | A detailed tracking dashboard can still feel like homework; gym-membership savings may be irrelevant; some selected preferences have little effect | Make enjoyment/useful tasks primary, keep a short optional record, and expand indoor/seated alternatives |

The first real validation cohort should be time-poor adults with a common recurring task, alongside a separate carers cohort. This is a product-testing priority, not a conclusion that either segment is commercially larger. Keep exercise-averse participants in both cohorts to test whether the framing and feedback feel approachable.

### What the 18-profile engine audit actually found

| Scenario evidence | Observed library result | Product implication |
|---|---|---|
| T5 Newcastle worker, C4 Geelong partner carer, E4 Hobart adult: all selected physical comfort/accessibility | Each had **one** ranked idea: `Break + Gentle stretch`, a seated version | Add independently reviewed seated/comfortable content before marketing broad accessibility coverage. Preserve strict needs filtering. |
| C6 Ballarat carer retained a custom written need | **Zero** ideas | The intentional free-text safety pause needs explanation on the Needs screen, not only after finishing. Keep the answer; never silently reinterpret or discard it. |
| C5 Cairns parent selected care, fatigue, heat and sleep needs; E2 Toowoomba driver selected poor walkability and safety | Each had **three free** ranked ideas | The restrictions are useful, but a small relevant pool can become repetitive. Expand safe indoor choices, not eligibility loopholes. |
| T3 Sydney worker preferred Indoors; E5 Bendigo adult preferred Quiet and Alone | Returned top ideas included outdoor walking for T3 and calls/audio walking for E5 | Preferences are currently soft or unused signals, not guaranteed boundaries. Make this clear and offer suitable filters. A strong need must remain a separate constraint. |
| Other profiles returned larger pools | Pools varied with the exact inputs and hour | More returned cards are not proof of better personalisation, adoption or safety. Test whether a person can identify one useful idea. |

These are scenario results, not an estimate of how often Australian customers would encounter each problem. Ages, places, routines and weather-sensitive needs are fictional test inputs, not demographic generalisations or live weather claims.

## Observed implementation issues to resolve first

| Priority | Evidence in current code / browser | Recommended change and acceptance check |
|---|---|---|
| P0 — personalisation credibility | `lib/recommendations.ts` maps legacy routine names. Six concrete current answers — Work or study, Takeaway, Groceries, Podcasts or music, Caring for someone, Household tasks — lack routine-ranking aliases. Calls and School run do match. | Add explicit, reviewed aliases. Test current answers against intended categories and explain the routine contribution. Keep No regular routine valid without pretending it creates a match. |
| P0 — preserve intended action across authentication | `pendingIdeaId` is a component ref; sign-in succeeds via a full-page redirect to `/#moves`. The selected save/accept intent is not durable across that redirect. This is source-based flow analysis; a real sign-in was not tested. | Preserve a validated same-origin return intent, restore the selected idea after account attachment, and recheck current eligibility before applying the action. Test email and OAuth redirects, cancellation and invalid/stale idea IDs. |
| P1 — honest answer consequences | A `Something else: ...` Need intentionally causes `eligible()` to return false for every library idea. The result view explains this; the Needs entry does not explain the consequence at the time of typing. | Add a calm inline explanation and a review choice that retains the answer. Do not automatically replace it with listed options or weaken safety filtering. |
| P1 — visible impact of answers | Only six of the 15 listed preferences directly affect base-library scoring. Many strengths are also descriptive rather than active ranking signals. | Show which answers influence current suggestions, imagery or future functionality. Add reviewed tags for currently unsupported signals if implemented; do not promise enforcement merely because an answer was saved. |
| P1 — navigation expectations | Homepage desktop **Saved** opens `#moves`, which starts in Explore. The browser confirmed this. The four homepage example cards also all link to generic My Moves. | Route Saved to the Saved view; route example cards to the relevant idea/collection with eligibility checks. Preserve Try ENOUGH's now-working direct onboarding link. |
| P1 — accessible content breadth | The three physical-comfort scenarios share one seated idea; constrained indoor scenarios have small pools. | Add reviewed ideas with explicit seated versions, added-time assumptions, required equipment and supervision limits. Test combinations of needs, not just each tag individually. |
| P2 — iPhone photo friction | The private gallery accepts JPEG, PNG and WebP. Its preparer explicitly rejects HEIC and asks the user to convert it. | Assess a privacy-preserving HEIC conversion/import path; make supported formats clear before selection. Check orientation, compression, large photos and retry without duplicate uploads. Do not claim current HEIC support. |

P0 means resolve before relying on the affected journey in a broad acquisition test. P1 means the next usability iteration. P2 means a later capability improvement. These are reviewer priorities, not measured uplift estimates.

## Page-by-page web and mobile recommendations

### Homepage

Keep the approved tagline **“Find exercise that fits your life.”**, the warm photography and the walk → stairs → run → wall-strength sequence. The varied examples make the central proposition tangible.

| Section | Web recommendation | Mobile recommendation | Why it matters in the simulation |
|---|---|---|---|
| Hero and navigation | Clarify the difference between starting setup and reopening the app. Make Saved open the expected view. Update the page title/social description to the approved tagline in a later copy pass; the current browser title still uses the former tagline. | Keep one visually primary start action and readable text over the photo. Add a short account expectation near it: explore without an account; sign in to save plans/progress. | T1/C2 need a clear next step without discovering a second commitment later. |
| Problem and comparison | Test a shorter comparison focused on the practical difference. Avoid implying all fitness apps require rigid workout plans; verified alternatives have more varied use cases. | Reduce repeated explanation before the concrete examples; use collapsible comparison detail. | E1 wants proof that this adds little work, not another category argument. |
| The Idea | Make each example open its specific relevant detail or clearly labelled example. Retain the current order and activity variety. | Put the existing-task → small-change relationship and added time in the first card view. | T2 can assess feasibility quickly; carers can spot supervision/setting limits. |
| Illustrative monthly returns | Keep the illustrative label prominent. Test a task-based example with zero cash saving alongside any genuine cost-swap example. Do not present the sample gym saving as a usual outcome. | Keep the example qualification beside the numbers, not dependent on reaching a footnote. | E6 has no gym membership; free movement can be valuable with $0 saved. |
| How it works / footer | State the account boundary and private-data purpose clearly. Keep recovery navigation easy to find. | Use a short four-step summary and a repeat start action. | Makes the first save/account gate less surprising. |

### All eight onboarding screens

There are **81 visible PINS tiles across the four categories**, including the four neutral answers, plus four Something Else controls. This is a count of choices presented, not answers required: one answer per PINS category and three routine answers are required; name and visual preferences are optional.

| Screen | What works now | Web recommendation | Mobile recommendation |
|---|---|---|---|
| 1. Name | Optional; guest exploration and local saving are stated | Fold the optional field into a concise introduction when redesigning the flow; avoid another mandatory-feeling form | Allow direct progress with no name, retain clear save/resume information |
| 2. Preferences | New matching warm lifestyle photos, clear labels, equal tiles, neutral/custom answers | Keep the photographic grid; make soft preferences versus needs clear | Keep full-tile targets. Add a reachable Continue bar and reveal less-used choices progressively without hiding selected answers |
| 3. Interests | Broad everyday interests, neutral/custom answers | Start with a smaller visible set plus Show more; keep every existing option available | Preserve selected answers at the top and restore them when expanding/revisiting |
| 4. Needs | Boundaries required; custom need is retained and suggestions are safely paused | Explain the written-needs limit inline. Distinguish temporary context from a continuing boundary | Prioritise readable text over ambiguous artwork. Offer review without discarding the written answer |
| 5. Strengths | Non-judgemental language and a neutral answer | Group strengths for scanning; show how supported choices affect matching | Present fewer at once with Show more and a reachable neutral/custom answer |
| 6. Routines | Every day is different, No regular routine and It varies are valid; all three questions required | Repair routine aliases; keep country/currency clearly optional and secondary | Separate the three questions visually or progressively within this step; keep answers after interruption |
| 7. Visual preferences | Optional; explicitly separate from suitability/ranking | Integrate this optional choice into later profile editing, or retain a clearly skippable step | Avoid making users scroll through optional imagery before reaching Skip |
| 8. Review | Answers are visible; back navigation and saved progress work | Add per-category Edit links and a concise explanation of current matching limitations | Keep the primary next action visible; summarise long answers with expandable detail |

A shorter flow must preserve required PINS/routines, explicit neutral answers, irregular days, Something Else in each category, existing saved progress and editability. Do not invent a completion-time promise before measuring it with real users.

### Core pages and supporting journeys

| Page / state | Web recommendation | Mobile recommendation | Primary segment benefit |
|---|---|---|---|
| **My Enough** | Keep one featured free idea first. Group returns/recent moments separately from discovery; put today's context close to the featured idea. Reduce repeated filters across My Enough/My Moves. | Compact heading + one featured idea + a short today-context control, followed by optional recent/returns panels. Keep the existing quick route to a featured idea; it is already visible within the initial 390 px view. | T4/C3 can adjust the day without scanning the whole dashboard |
| **My Moves — Explore** | Keep the searchable grid and detailed browser. Put search, meaningful added-time filters and results above secondary collections. Preserve exact card-to-detail selection and Back filter state. | Shrink the hero; put search, three common chips and More filters above the first card. Keep row/grid choice and visible swipe/arrow alternatives. Enlarge estimate qualifiers from their current 9 px mobile size. | T1/E3 can find a useful idea quickly |
| **Idea detail / costs / Why this?** | State original task, change, added time, movement estimate, one MONEY SAVED estimate including zero, and safety in a consistent order. Keep cost assumptions editable and confirmed money separate. | Put the feasibility summary and save/try actions in easy reach; disclose detailed assumptions below. Keep controls accessible alongside swiping. | T2/C1 can decide without mistaking total movement time for extra time |
| **Saved** | Add a lightweight search or collection filter when the list grows. Keep ineligible saved ideas viewable with an explanation and rechecked before trying. | Keep title, one-line fit cue and View/Remove actions compact | Interrupted users can return to the exact idea they meant to keep |
| **Planned** | Clearly distinguish an intention from a completed outcome. Keep Not today and plan editing. | Make How did it go? primary, and move optional movement/QR details below | C2 can record or defer without a catch-up obligation |
| **Support — six screens** | After acceptance, offer optional Add support. Keep the open goal default, flexible fallback, calendar export and QR option; SMART remains a choice. | Start with a short cue/fallback suggestion and an optional fuller plan. Do not require a six-screen tour to try a tiny move. Keep reminder limitations explicit. | T1/E1 avoid perceiving another programme to manage |
| **Outcome confirmation** | Keep minutes and worthwhile feedback required; put optional money, combined time, extra returns, companions and evidence in disclosed sections | Aim for a brief first record: minutes + worthwhile + Confirm, with optional details expanded on demand. Keep validation and currency precision unchanged. | T6/C5 can finish during a short interruption |
| **My Wins — empty** | Lead with what counts and one route to confirm a real move. Keep zeros truthful | Use a concise first-win state; collapse empty charts, milestone placeholders and the calendar until requested or populated | E1 sees a useful next action instead of a large reporting obligation |
| **My Wins — populated** | Keep confirmed returns, separate currencies, real activity history, private gallery and corrections. Make time-combined overlap clear, and retain labelled illustration fallbacks. | Compact the hero and show a recent moment/returns earlier. Offer Moments/Photos prominently; expand charts, history and milestones when wanted. | C3/E3 see enjoyment and useful tasks as meaningful returns |
| **My Pins** | Add direct Edit per category/routines so a small update doesn't restart at Name. Distinguish saved/descriptive fields from active matching inputs. | Use compact category summaries with direct edit actions, while keeping custom answers readable | C2/E5 can adapt a changing day or preference quickly |
| **Account / backup / delete-data dialogs** | Explain local draft versus cloud account, what will be imported, and conflict resolution. Preserve current export/retry/delete safeguards. | Use the same clear wording and a concise account gate; preserve the idea/action through sign-in | All three segments can understand why an account is now needed |
| **Sign-in / create account** | Make the new-account path the appropriate first view when entered from first Save. Display only configured providers rather than advertising disabled options. Preserve provider availability checks and authentication. | Give the primary email flow enough space and maintain selected-idea return intent | T1/E1 face fewer ambiguous choices at the main commitment point |
| **Recover password** | Keep the neutral response that doesn't reveal whether an email has an account; make return navigation obvious | One field, one action, clear sent/retry status | Returning users can recover without rereading product copy |
| **Update password** | Keep confirmation/mismatch validation and a clear expired-link recovery path | Keep both fields usable above the keyboard and focus errors meaningfully | Avoids a frustrating dead end after email handoff |
| **Sign out** | Use the common branded account-page frame; explain sign-out versus deleting data | Keep confirmation and Stay signed in reachable; maintain local-session sign-out scope | Protects confidence in retained progress |
| **Not found** | Add a calm branded return to homepage/My Moves without clearing local progress | One clear recovery action; avoid a generic unexplained dead end | Helps users following old or shared links |

Ideas near you should remain genuine external map searches with a suburb/town input and an access/fees check. Do not describe results as verified events or infer a live venue, price, route, distance, rating or availability. When outdoor options are restricted, lead with an indoor/seated alternative. “With the kids” can remain one option, but add broader caring context without promising supervision suitability that the app cannot assess.

Keep private photos opt-in, tie them to confirmed activities, and retain swipe and button controls. Health readings and QR check-ins should stay optional; a browser user must retain the manual path. Reading & motion settings already offer solid surfaces, larger text and reduced animation; expose them earlier for users who need them, rather than requiring a trip to a long footer.

## Responsive priorities supported by observed layouts

Measurements below are from a **390 × 844 CSS-pixel local browser**, with the stated fixture and font limitation. They identify layout burden, not measured abandonment.

| Observation | Current measurement | Proposed design criterion to test |
|---|---|---|
| My Moves first result card, completed profile/history fixture | Starts approximately **1,048 px** down the document | Make a useful result reachable in the first screen or immediately after search/filter controls; compact the marketing-like hero |
| My Enough featured idea versus first grid card, same fixture | Featured card begins about **558 px** down; grid begins **1,085 px** down | Preserve the quick featured route, bring today's context closer, and simplify what follows |
| Preferences screen, empty selections | Continue row begins about **1,905 px** down | Keep a reachable primary action and the neutral/custom choices; don't shrink whole-tile touch targets to fit everything |
| My Wins, completed profile with no outcomes | Approximately **4,574 px** tall | A concise empty state, with optional details disclosed progressively |
| My Wins, three test outcomes | Approximately **6,136 px** tall | Show confirmed returns and a recent real moment early; make deeper analysis optional |
| My Moves estimate labels | **9 px** on mobile, some **8 px** on desktop | Start testing 13–14 px qualifiers and readable hierarchy; do not hide estimate/confirmed distinctions in tiny text |

Keep light glass surfaces, deep-ink type, warm scenes and generous spacing. Reduce repeated content and oversized headings before compressing controls or body text. Treat 44 × 44 CSS-pixel primary touch targets as a useful enhanced design aim; WCAG 2.2's AA minimum is 24 × 24 with exceptions, so a smaller control is not automatically an AA failure. Check text contrast on the actual translucent/photographic backgrounds: normal text generally needs 4.5:1, large text 3:1. These recommendations are not a claim of WCAG conformance or failure. [7][8]

## Recommended implementation order

1. **Repair trust in the journey:** current routine aliases, durable selected-idea sign-in return, expected Saved routing, and an early written-needs explanation. Add meaningful behaviour tests for these changes.
2. **Reduce mobile effort:** compact My Moves/My Wins headers, readable estimate labels, reachable setup action, per-category editing, and shorter empty states. Preserve desktop discovery depth.
3. **Make small moves small to record:** optional support after acceptance, a shorter confirmation surface, and optional deeper return/gallery/history views.
4. **Expand relevant coverage:** reviewed seated, indoor, low-energy and supervision-compatible activities. Show zero predicted saving where appropriate; keep confirmed totals and currencies intact.
5. **Validate with real Australians before growth or pricing decisions:** observe actual task completion and a return visit across the three segments. Refine copy/imagery and investigate HEIC import after the core path works reliably.

## Real validation plan

Recruit a small first-round group, for example five people from each segment, deliberately including irregular shift work, different caring responsibilities, low energy, seated needs, low confidence and regional access. Fifteen sessions are a proposed qualitative test, not a representative survey. People may belong to more than one segment. None have been recruited or contacted by this review.

Ask participants to: explain the proposition after viewing the homepage; start setup, pause and resume; find one idea that fits an actual day; distinguish movement duration from added time; save it through sign-in; accept or defer it; confirm an honest result including a valid $0 saving; find that outcome and edit a PINS answer. Include a brief follow-up after an opportunity to try the idea, rather than treating immediate enthusiasm as retention.

Observe unaided completion, hesitation, misunderstandings, ability to resume, idea relevance and whether recording felt worthwhile. If adding analytics later, use privacy-minimising events for these steps and validate consent/implementation first; don't collect typed needs or private photos as marketing telemetry. Define acquisition, retention and price experiments only after this round. Do not report synthetic percentages as customer evidence.

## Changes and checks accompanying this report

- Replaced the Preferences line-icon grid with 16 coordinated lifestyle scenes: outdoor/indoor, solo/company, quiet/music, morning/afternoon/evening, planned/spontaneous, short bursts/unhurried, familiar/new places, and a neutral still life. Photo captions remain text; decorative artwork is hidden from assistive technology.
- New optimized local WebP atlas is 1536 × 1024 and 376,808 bytes. It is reused across tiles. Other PINS artwork and answer/storage logic are unchanged.
- Equal photo tile sizes verified at 1440, 390 and 320 px, including wrapped captions. Required choices, neutral exclusivity, all-category Something Else, save/resume, reload/edit persistence, valid irregular routines, optional name/visual preferences and Try ENOUGH → onboarding passed in the local production browser.
- Existing **64 tests**, standalone **TypeScript**, **production build**, and **diff whitespace check** passed. Browser checks covered the four core pages at all three widths, search/free filtering, exact card details, retained Back state, Saved/Planned/support/confirmation views, honest no-history/written-need states and separate AUD/USD fixture totals, with no page errors. API fixtures were used; these results do not certify live email, private storage or native-device integration.

Existing authentication, cloud-saving logic, Supabase schema/access controls, costs/currencies, QR check-ins, native-health fallbacks, homepage wording/order, and actual private-gallery functionality were preserved. There are no invented venues, community activity, testimonials, countdowns, match percentages, streak-loss prompts or assumed confirmed savings.

## Sources

Sources were checked on 8 October 2026. Publication/content dates are given separately from the underlying data period. External statistics are background context, not synthetic-panel results.

1. [AIHW — Physical activity](https://www.aihw.gov.au/reports/physical-activity), article 17 June 2024; cited adult figures use the 2022 National Health Survey. The footer's August 2026 website version date is not a new survey date.
2. [Australian Sports Commission — Factors influencing sport participation](https://www.ausport.gov.au/clearinghouse/evidence/factors-influencing-sport-participation), updated 8 July 2025.
3. [Carers Australia — 2024 Carer Wellbeing Survey](https://www.carersaustralia.com.au/research/2024-carer-wellbeing-survey/), landing page 14 October 2024; [full report](https://www.carersaustralia.com.au/wp-content/uploads/2025/02/Final-CWS-2024-Report-compressed.pdf), Mylek and Schirmer, 2024; data collection February–April 2024. Used as dated context, not labelled the latest survey.
4. [Apple Support Australia — Manage Health data](https://support.apple.com/en-au/108779), published 16 September 2026.
5. [Heart Foundation — Heart Foundation Walking](https://www.heartfoundation.org.au/healthy-living/heart-foundation-walking), updated 13 January 2026; reviewed 21 May 2025.
6. [Strava — Clubs on Strava](https://support.strava.com/en-us/articles/15402172-clubs-on-strava), current official support page checked on the review date; relative update label is not treated as a precise publication date.
7. [W3C — Target Size (Minimum)](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html) and [Target Size (Enhanced)](https://www.w3.org/WAI/WCAG22/Understanding/target-size-enhanced.html), WCAG 2.2 understanding documents.
8. [W3C — Contrast (Minimum)](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html), WCAG 2.2 understanding document.
