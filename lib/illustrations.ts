/**
 * The Enough Illustration Library. Opportunities name an `imageCategory`
 * (and optionally a variant); this file maps categories to watercolour files
 * in `public/illustrations`. Images are editorial and emotional: they set the
 * mood and place, and the card text supplies the specifics.
 *
 * To add or replace artwork: drop a webp into `public/illustrations/` and add
 * its name to the category below. Recommendation logic never changes.
 * `dedicated: false` marks categories still borrowing a neighbouring painting.
 */
export const illustrationCategories=['phone-call','children-school','children-sport','waiting','desk-work','outdoor-work','errands','groceries','home','cooking','television','transport','walking','nature','social','pets','neighbourhood','commuting','low-energy','playful'] as const;
export type IllustrationCategory=typeof illustrationCategories[number];

type Art={file:string;alt:string};
const art={
 call:{file:'call',alt:'A man talking on the phone as he walks along a leafy harbour path'},
 welcomeCall:{file:'welcome-call',alt:'A man on a phone call walking a tree-lined path by the water'},
 catchup:{file:'welcome-catchup-walk',alt:'Two friends walking and talking along a harbour path'},
 coast:{file:'welcome-coast',alt:'A quiet coastal path at sunset'},
 hero:{file:'welcome-hero',alt:'A woman walking a harbour path at golden hour'},
 street:{file:'welcome-dinner',alt:'A woman walking home along a suburban street'},
 shopping:{file:'dinner',alt:'A woman carrying shopping bags along a suburban footpath'},
 school:{file:'welcome-school',alt:'A parent walking a child to school across a crossing'},
 parentChild:{file:'welcome-library-run',alt:'A parent and child hurrying happily past the local library'},
 busStop:{file:'welcome-podcast',alt:'People walking past a bus stop on a leafy street, one with a dog'},
 office:{file:'welcome-refill-stairs',alt:'A man with a water bottle taking the stairs at work'},
 kitchen:{file:'welcome-kitchen-dance',alt:'A woman cooking dinner and smiling at the stove'},
 kitchenBench:{file:'welcome-upload-strength',alt:'A man leaning on the kitchen bench while the kettle boils'},
 livingRoom:{file:'welcome-ad-break-strength',alt:'A living room with the television on'},
 stillLife:{file:'pins-artwork',alt:'A cup of tea, earphones, keys and a notebook on a table'}
} satisfies Record<string,Art>;

export const illustrationLibrary:Record<IllustrationCategory,{variants:Art[];dedicated:boolean}>={
 'phone-call':{variants:[art.call,art.welcomeCall],dedicated:true},
 'children-school':{variants:[art.school,art.parentChild],dedicated:true},
 'children-sport':{variants:[art.parentChild],dedicated:false},
 waiting:{variants:[art.busStop,art.street],dedicated:false},
 'desk-work':{variants:[art.office],dedicated:false},
 'outdoor-work':{variants:[art.welcomeCall],dedicated:false},
 errands:{variants:[art.shopping,art.street],dedicated:true},
 groceries:{variants:[art.shopping],dedicated:true},
 home:{variants:[art.kitchenBench,art.stillLife],dedicated:true},
 cooking:{variants:[art.kitchen,art.kitchenBench],dedicated:true},
 television:{variants:[art.livingRoom],dedicated:false},
 transport:{variants:[art.busStop],dedicated:true},
 walking:{variants:[art.hero,art.coast],dedicated:true},
 nature:{variants:[art.coast,art.hero],dedicated:true},
 social:{variants:[art.catchup],dedicated:true},
 pets:{variants:[art.busStop],dedicated:false},
 neighbourhood:{variants:[art.street,art.shopping],dedicated:true},
 commuting:{variants:[art.office,art.busStop],dedicated:true},
 'low-energy':{variants:[art.stillLife],dedicated:true},
 playful:{variants:[art.parentChild,art.coast],dedicated:true}
};
export const fallbackIllustration:Art=art.coast;

/** Resolves a category and optional variant to a file that exists. Never throws, never returns a broken path. */
export function illustrationFor(category:string,variant?:string|number):{src:string;alt:string;placeholder:boolean}{
 const entry=(illustrationLibrary as Record<string,{variants:Art[];dedicated:boolean}>)[category];
 if(!entry||!entry.variants.length)return {src:`/illustrations/${fallbackIllustration.file}.webp`,alt:fallbackIllustration.alt,placeholder:true};
 const index=typeof variant==='number'?variant:variant?[...variant].reduce((n,c)=>(n*31+c.charCodeAt(0))>>>0,7):0;
 const chosen=entry.variants.find(v=>v.file===variant)||entry.variants[index%entry.variants.length];
 return {src:`/illustrations/${chosen.file}.webp`,alt:chosen.alt,placeholder:!entry.dedicated};
}
export const illustrationFiles=()=>[...new Set(Object.values(illustrationLibrary).flatMap(e=>e.variants.map(v=>v.file)).concat(fallbackIllustration.file))];
