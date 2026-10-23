# Watercolour illustrations for the ENOUGH iPhone app

The app shows a watercolour painting wherever the website shows a photograph. Each file goes in `ios/Enough/Enough/Resources/Illustrations/` named `<scene>-illustration.webp` (for example `welcome-hero-illustration.webp`; the suffix avoids a bundle name clash with the photograph) and the app uses it automatically; until a file exists the photograph is shown softened into a wash. The first fifteen scenes were generated on 23 October 2026 and are in place; the five sprite sheets remain to do.

## Shared style (prepend to every prompt)

> Loose watercolour painting on textured cold-pressed paper. Soft wet-on-wet washes, visible paper grain, gentle bleeding edges, a few confident ink-pen lines for structure. Muted palette: washi off-white, indigo grey, pale sky, moss green, soft clay. Plenty of untouched paper (negative space). Calm, unhurried, early-morning or late-afternoon light. Ordinary people of varied ages, bodies and backgrounds, drawn with warmth and without idealised physiques. No gym equipment, no sportswear, no fitness trackers, no text, no logos, no borders. Nothing dramatic; the feeling is quiet contentment.

Principles the pictures should carry: **kanso** (only what is needed), **fukinsei** (off-centre composition, asymmetry), **shibui** (understated, no bright saturation), **shizen** (natural, unforced moments), **yugen** (suggest more than you show; faces soft or turned away, scenes fading into paper), **datsuzoku** (a small unexpected detail that makes you smile), **seijaku** (stillness).

## Specifications

- Size 1536 × 1024 (3:2 landscape) for every file except the two sprite sheets.
- Export as WebP (quality 80) or PNG. Keep each file under 400 KB where possible.
- Leave the lower third of the image lighter where noted; the app lays text over it.

## Files

| File name | Where it appears | Subject |
|---|---|---|
| `welcome-hero.webp` | First onboarding card, behind the logo | A harbour path at sunset, one person with a takeaway cup pausing at the rail, city skyline barely suggested in the wash. Lower third fades to near-blank paper. |
| `welcome-podcast.webp` | Onboarding "There's never enough time"; listen ideas | Someone walking a suburban footpath with earphones in, dog-walker passing the other way, a bus stop ahead. |
| `welcome-dinner.webp` | Onboarding "Paying to feel bad about it"; errand and shopping ideas | A person carrying a takeaway bag home along a neighbourhood street at dusk, warm window light, no delivery scooter. |
| `welcome-catchup-walk.webp` | Onboarding "Movement is already in your day"; calls, collections | Two friends walking and talking on a leafy path, one on the phone, mid-laugh. |
| `welcome-coast.webp` | Onboarding "Good for you, in your own way"; surprise me; outdoor ideas | A coastal path, a figure far off, long shadows, most of the paper left white for sea haze. |
| `welcome-call.webp` | Call and work ideas; nearby "a little green space" | A man on a park path talking on the phone, benches, dappled shade. |
| `welcome-school.webp` | Family ideas; nearby "while the kids play" | A parent and child walking to school, backpack, crossing with a lollipop person. |
| `welcome-refill-stairs.webp` | Stairs ideas | An office stairwell, someone with a water bottle taking the stairs, hand on the rail. |
| `welcome-library-run.webp` | Library easy run | A parent and child jogging gently on a path beside a small suburban library. |
| `welcome-ad-break-strength.webp` | Ad-break wall push-ups; "useful little pauses" collection | A living room, television glow, someone doing wall push-ups beside the sofa, mug on the table. |
| `welcome-kitchen-dance.webp` | Cooking and music ideas | A kitchen, someone swaying while stirring a pot, radio on the bench. |
| `welcome-upload-strength.webp` | Spare | A person doing calf raises at a kitchen bench while the kettle boils. |
| `call.webp` | Idea 1 "Your next catch-up. Out in the world." | A man on a leafy park path, phone to ear, content. |
| `dinner.webp` | Idea 0 "Dinner, with a little fresh air." | A woman carrying dinner home along a quiet street at dusk. |
| `pins-artwork.webp` | My Pins | Four small objects on a table, suggesting preferences, interests, needs, strengths: a mug, earphones, a house key, a notebook. |

### Sprite sheets (keep the grid)

These are 4 × 4 grids of small scenes, each cell 3:2, exported at 2048 × 1365. Paint 16 tiny vignettes in the same style and keep each one inside its cell, in this order (left to right, top to bottom). The app crops the cell it needs.

- `preferences-lifestyle-v1.webp`: Outside, Indoors, Alone, With someone, Quiet, Music, Morning, Afternoon, Evening, Planned, Spontaneous, Short bursts, Take my time, Familiar places, New places, Nothing to add (blank wash).
- `onboarding-interests-v1.webp`: Podcasts, Coffee, Family time, Friends talking, Nature, Animals, Shopping, Photography, Reading, Gardening, Making things, Audiobooks, TV, Sport, Food, Gaming.
- `onboarding-needs-v1.webp`: Not enough time, Save money, Low energy, Family or caring, Work or shifts, Need recovery, Safety, Weather or heat, Hard to walk here, Physical comfort, Need flexibility, Already active at work, Sleep, Pain or discomfort, Transport limits, Privacy.
- `onboarding-strengths-v1.webp`: I keep routines, Getting things done, Walk when there's a reason, Independent, Solve problems, Know my neighbourhood, Public transport, Already on my feet, Small changes, Know what works, Learning, Planning, Adapting, Supportive people, Challenges, Noticing patterns.
- `onboarding-routines-v1.webp`: Mostly seated, On my feet, A mix, Every day different, School run, Calls, Takeaway, Groceries, Household tasks, City streets, Suburban streets, Small towns, Country, Coastal, Daytime, Mix it up.

## Prompt template

```
[Shared style paragraph above]

Scene: [subject from the table]. Composition off-centre with generous empty paper on the [left/right]. 3:2 landscape.
```

## Checklist before dropping a file in

- The lower third is light enough to read dark text over it (hero, surprise and "next move" cards).
- Nobody is posed, flexing or in exercise gear.
- The picture still reads at 150 px wide (collection thumbnails).
