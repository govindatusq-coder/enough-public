# Onboarding lifestyle photography

The remaining PINS, routine and scenery tiles now use the same warm editorial photographic style and 3:2 photo treatment as Preferences. Labels, selected answers, neutral responses, free-text fields, resume behaviour and recommendation constraints are unchanged.

## Assets

| Sheet | Repository path | Scenes |
| --- | --- | --- |
| interests | `public/images/onboarding-interests-v1.webp` | 16 |
| needs | `public/images/onboarding-needs-v1.webp` | 16 |
| strengths | `public/images/onboarding-strengths-v1.webp` | 16 |
| routines | `public/images/onboarding-routines-v1.webp` | 16 |

Each sheet is 1536 × 1024, divided into four columns and four rows of 384 × 256 cells. Cell indices in `components/pins-options.tsx` use zero-based row-major order. The existing Preferences sheet remains `public/images/preferences-lifestyle-v1.webp`. Meaningfully related answers share a scene; unrelated answers are mapped explicitly rather than selected through keyword fallbacks. The images are decorative and the visible labels name each choice.

## Generation and validation

Generated using the built-in image-generation tool (`photorealistic-natural`), then converted to WebP with Sharp at quality 82 without altering composition. Every cell was visually inspected for subject and correspondence. These are illustrative lifestyle scenes, not verified venues, events, activities or community testimonials.

Validated with 64 existing tests, TypeScript (`tsc --noEmit`) and the Next.js production build. Chromium checked 208 tile renders across desktop and 360/390 px mobile: actual image decoding, 3:2 crops, equal tile sizes and no horizontal overflow. The UI check also covered Try ENOUGH, required PINS, neutral-answer exclusivity, all four Something Else answers, save/resume at the missing answer, editing after reload, irregular routines and optional name/scenery. No browser JavaScript errors occurred. Account and AI availability endpoints were stubbed for these local UI checks; cloud authentication was not re-tested.

## Final prompt set

### interests

```text
Use case: photorealistic-natural. Asset type: one 4-column by 4-row photographic contact sheet for ENOUGH onboarding, exactly 16 equal rectangular photos, edge to edge with NO gutters, borders, labels, typography or graphics. Overall landscape 3:2 composition, 1536x1024, each cell 384x256. Row-major order exactly as specified. Match the existing ENOUGH homepage: authentic Australian everyday life, warm natural afternoon or morning light, creamy whites, restrained deep blue clothing, foliage and honey coloured timber, soft premium editorial photography, real photographic texture. Diverse adults across ages and Australian backgrounds, practical ordinary clothing, believable anatomy. Each scene should read clearly at small size with uncluttered central subject. Quiet, inclusive and relaxed, ordinary life rather than fitness stock photos. No logos, watermarks, legible text, cartoons or pictograms. Treat all scenes as independent photos, not a continuous panorama.
CELL ORDER row 1 left to right then row 2 etc:
1. An adult woman sitting comfortably with a single wireless earbud, holding her phone while listening to a podcast.
2. A relaxed woman holding a ceramic coffee cup at a light-filled kitchen window.
3. A family of two adults and a school-age child enjoying a simple board game on their verandah.
4. Two adult friends chatting as they stroll along a leafy suburban footpath.
5. A peaceful shaded Australian native bush walking path with soft light and a clear level centre.
6. A relaxed adult crouching beside a calm friendly dog in a sunlit home garden.
7. A person browsing fresh produce at an open-air neighbourhood market, baskets and stall visible, no signs.
8. An adult holding a real small DSLR camera to photograph garden flowers outdoors.
9. A woman quietly reading an open book beside a bright living-room window.
10. An adult in gardening gloves planting seedlings in a raised garden bed.
11. A person enjoying a simple watercolour craft at a timber table, paper, paint and a few brushes.
12. A relaxed older adult with over-ear headphones listening comfortably in an armchair, phone lying nearby, eyes open.
13. A person on a comfortable sofa watching a television showing a generic landscape, no interface or text.
14. Two adults playing relaxed casual tennis on a local outdoor court, believable racquets and bodies.
15. An adult preparing colourful vegetables for a meal in a bright ordinary home kitchen.
16. A relaxed adult holding a game controller on the sofa, looking toward a television outside the frame.
```

### needs

```text
Use case: photorealistic-natural. Asset type: one 4-column by 4-row photographic contact sheet for ENOUGH onboarding, exactly 16 equal rectangular photos, edge to edge with NO gutters, borders, labels, typography or graphics. Overall landscape 3:2 composition, 1536x1024, each cell 384x256. Row-major order exactly as specified. Match the existing ENOUGH homepage: authentic Australian everyday life, warm natural afternoon or morning light, creamy whites, restrained deep blue clothing, foliage and honey coloured timber, soft premium editorial photography, real photographic texture. Diverse adults across ages and Australian backgrounds, practical ordinary clothing, believable anatomy. Each scene should read clearly at small size with uncluttered central subject. Quiet, inclusive and relaxed, ordinary life rather than fitness stock photos. No logos, watermarks, legible text, cartoons or pictograms. Treat all scenes as independent photos, not a continuous panorama.
CELL ORDER row 1 left to right then row 2 etc:
1. A busy adult at a kitchen bench glancing at their simple wristwatch while a tote bag and keys lie nearby.
2. Close view of an adult's hands placing a few Australian-looking coins beside a plain notebook and pencil, no readable numbers, warm kitchen table.
3. A tired but calm adult resting back in a comfortable armchair, daylight, no dramatic suffering.
4. A middle-aged adult gently assisting an older adult with a cardigan on a home verandah.
5. An adult shift worker with practical work clothes arriving at a workplace in morning light, everyday workplace setting.
6. An adult seated comfortably on a sofa gently releasing tension in their neck and shoulders, relaxed, no forced exercise.
7. A wide well-lit neighbourhood walking path with clear sightlines and a couple of people far away, daylight.
8. An adult with a sunhat and a reusable water bottle resting in deep leafy shade on a warm Australian day.
9. A rural road with grassy verges and no separate footpath, photographed calmly in daylight from the verge, no person in the road.
10. An adult wheelchair user on a wide level park boardwalk, natural relaxed posture, no stairs, realistic chair.
11. A close scene of hands lightly rearranging plain unmarked appointment cards and a pencil beside an open notebook, communicating flexibility.
12. An adult retail worker arranging light baskets on a shop shelf, clearly standing and doing normal work, unbranded, not gym clothing.
13. A quiet comfortable bedroom with a made bed, linen, a bedside lamp and soft morning light, no person.
14. A relaxed adult seated with back support, one hand gently resting on a sore shoulder, ordinary home, no medical drama.
15. A simple remote bus shelter beside a safe roadside verge in a small Australian town, no readable timetable or signage, empty.
16. A calm adult sitting alone in a private fenced garden courtyard, leafy plants screening the space, peaceful and comfortable.
```

### strengths

```text
Use case: photorealistic-natural. Asset type: one 4-column by 4-row photographic contact sheet for ENOUGH onboarding, exactly 16 equal rectangular photos, edge to edge with NO gutters, borders, labels, typography or graphics. Overall landscape 3:2 composition, 1536x1024, each cell 384x256. Row-major order exactly as specified. Match the existing ENOUGH homepage: authentic Australian everyday life, warm natural afternoon or morning light, creamy whites, restrained deep blue clothing, foliage and honey coloured timber, soft premium editorial photography, real photographic texture. Diverse adults across ages and Australian backgrounds, practical ordinary clothing, believable anatomy. Each scene should read clearly at small size with uncluttered central subject. Quiet, inclusive and relaxed, ordinary life rather than fitness stock photos. No logos, watermarks, legible text, cartoons or pictograms. Treat all scenes as independent photos, not a continuous panorama.
CELL ORDER row 1 left to right then row 2 etc:
1. An adult doing their familiar morning routine of watering a houseplant by a bright kitchen window.
2. An adult finishing a small everyday task at a home desk, ticking an unmarked checklist beside a closed laptop, no readable writing.
3. An adult walking along a leafy suburban footpath carrying a reusable bag after an errand, calm purposeful stroll.
4. An adult independently repairing a simple wooden shelf at home using a screwdriver, no dangerous tools or ladder.
5. An adult seated solving a simple wooden jigsaw puzzle at a timber table, relaxed concentration, no readable text.
6. A friendly adult waving to a neighbour over a low front-garden fence on a quiet leafy Australian street.
7. An adult with a tote bag waiting at an accessible suburban bus stop as a simple unbranded bus approaches, no readable signs.
8. An adult florist standing while tending a light bucket of flowers in an ordinary bright workspace.
9. An adult rising from their chair beside a home work desk for a small comfortable pause, no gym equipment.
10. A thoughtful adult at a window reviewing their personal notebook beside a cup of tea, relaxed self-knowledge.
11. An adult learning something with an open reference book and laptop at a sunlit dining table, no readable screen text.
12. An adult preparing a reusable water bottle, keys and a small bag beside a plain notebook before going out.
13. An adult calmly taking a light jacket from a hook beside the front door as weather changes outside, ordinary adaptable plans.
14. Three adults of varied ages chatting and helping in a neighbourhood community garden, equal relaxed interaction.
15. An adult focused on a slightly challenging tactile tabletop puzzle, pleased concentration, simple everyday setting.
16. Close view of an adult's hands arranging small wooden shapes into an orderly repeating pattern on a home table, warm natural light.
```

### routines

```text
Use case: photorealistic-natural. Asset type: one 4-column by 4-row photographic contact sheet for ENOUGH onboarding, exactly 16 equal rectangular photos, edge to edge with NO gutters, borders, labels, typography or graphics. Overall landscape 3:2 composition, 1536x1024, each cell 384x256. Row-major order exactly as specified. Match the existing ENOUGH homepage: authentic Australian everyday life, warm natural afternoon or morning light, creamy whites, restrained deep blue clothing, foliage and honey coloured timber, soft premium editorial photography, real photographic texture. Diverse adults across ages and Australian backgrounds, practical ordinary clothing, believable anatomy. Each scene should read clearly at small size with uncluttered central subject. Quiet, inclusive and relaxed, ordinary life rather than fitness stock photos. No logos, watermarks, legible text, cartoons or pictograms. Treat all scenes as independent photos, not a continuous panorama.
CELL ORDER row 1 left to right then row 2 etc:
1. An adult seated at an ordinary home desk using a laptop, relaxed normal desk work, visible chair.
2. An adult standing comfortably while tidying a bookshelf in a bright home, naturally on their feet.
3. An adult using a standing desk with an ordinary chair next to it, clearly a mix of sitting and standing, bright room.
4. A flexible everyday-life still-life: keys, headphones, tote bag and water bottle beside a plain unmarked open weekly planner on a warm home table.
5. A parent and school-age child with a school backpack walking side by side on a safe leafy suburban footpath, no uniform branding.
6. An adult speaking on the phone while strolling calmly on a familiar leafy path, no headphones.
7. An adult carrying a plain small paper takeaway bag along a wide neighbourhood footpath, no logos.
8. An adult carrying a reusable canvas grocery bag containing vegetables while walking home on a footpath.
9. An adult man folding laundry at a sunlit home table, ordinary household routine.
10. A real-looking Australian city street with mid-rise brick buildings, trees and a wide clear pavement, no readable signage, no dominant cars.
11. A quiet leafy Australian suburban street with modest detached homes, low fences and clear footpaths.
12. A small Australian country-town main street with low-rise verandah shopfronts and a broad quiet footpath, no readable shop signs.
13. A peaceful Australian country setting with a safe walking track, eucalyptus trees, open fields and soft distant hills.
14. A safe coastal walking path beside pale sand and calm blue sea, low coastal vegetation, warm natural light.
15. A sunlit park at daytime with an adult pausing comfortably on a bench in the shade, blue sky and green trees.
16. A flat lay of three natural photographic prints showing a leafy city street, a country track and a coast, on a cream linen surface, no text.
```
