import type {Idea} from './ideas.ts';
export const intensities=['light','moderate','vigorous-burst','strength'] as const;
export type IdeaIntensity=typeof intensities[number];
export const intensityLabels:Record<IdeaIntensity,string>={light:'Light movement',moderate:'Moderate movement','vigorous-burst':'Brisk burst',strength:'Strength'};
// Explicit template tags for the original library. Cycling and seated or
// kneeling movement are conservatively not labelled as standing/stepping breaks.
export const libraryMovementTags:Record<string,{intensity:IdeaIntensity;breaksSitting:boolean}>={
 'call-family-walk':{intensity:'light',breaksSitting:true},
 'call-pace-indoors':{intensity:'light',breaksSitting:true},
 'call-friend-loop':{intensity:'light',breaksSitting:true},
 'call-work-standing':{intensity:'light',breaksSitting:true},
 'podcast-outside':{intensity:'light',breaksSitting:true},
 'music-album-walk':{intensity:'light',breaksSitting:true},
 'audiobook-chores':{intensity:'light',breaksSitting:true},
 'podcast-commute-stop':{intensity:'light',breaksSitting:true},
 'coffee-walk-further':{intensity:'light',breaksSitting:true},
 'coffee-walk-home':{intensity:'light',breaksSitting:true},
 'coffee-catchup-walk':{intensity:'light',breaksSitting:true},
 'collect-dinner':{intensity:'light',breaksSitting:true},
 'post-walk':{intensity:'light',breaksSitting:true},
 'pharmacy-park-far':{intensity:'light',breaksSitting:true},
 'bank-bike':{intensity:'moderate',breaksSitting:false},
 'problem-walk':{intensity:'light',breaksSitting:true},
 'plan-week-walk':{intensity:'light',breaksSitting:true},
 'decompress-walk':{intensity:'light',breaksSitting:true},
 'playground-laps':{intensity:'light',breaksSitting:true},
 'school-walk':{intensity:'light',breaksSitting:true},
 'after-dinner-stroll':{intensity:'light',breaksSitting:true},
 'video-call-overseas':{intensity:'light',breaksSitting:true},
 'kids-garden-play':{intensity:'moderate',breaksSitting:true},
 'laundry-stairs':{intensity:'light',breaksSitting:true},
 'garden-podcast':{intensity:'moderate',breaksSitting:false},
 'cooking-music':{intensity:'light',breaksSitting:true},
 'bins-loop':{intensity:'light',breaksSitting:true},
 'groceries-walk':{intensity:'light',breaksSitting:true},
 'market-explore':{intensity:'light',breaksSitting:true},
 'basket-not-trolley':{intensity:'light',breaksSitting:true},
 'commute-stop-early':{intensity:'light',breaksSitting:true},
 'park-and-walk':{intensity:'light',breaksSitting:true},
 'bike-commute-sometimes':{intensity:'moderate',breaksSitting:false},
 'station-stairs':{intensity:'moderate',breaksSitting:true},
 'walking-1on1':{intensity:'light',breaksSitting:true},
 'lunch-walk-out':{intensity:'light',breaksSitting:true},
 'break-stretch':{intensity:'light',breaksSitting:false},
 'water-refill-far':{intensity:'light',breaksSitting:true},
 'wait-appointment':{intensity:'light',breaksSitting:true},
 'wait-pickup':{intensity:'light',breaksSitting:true},
 'wait-laundry':{intensity:'light',breaksSitting:true},
 'photo-walk':{intensity:'light',breaksSitting:true},
 'dog-longer':{intensity:'light',breaksSitting:true},
 'visit-friend-walk':{intensity:'light',breaksSitting:true}
};
export function validSittingBreak(mode:string,action:string){
 if(['seated','cycle','wheel','stretch'].includes(mode))return false;
 return ['walk','stairs','dance','play'].includes(mode)||mode==='task'&&/\b(walk|walking|steps?|stepping|pace|pacing|march|marching|trips?|stairs)\b/i.test(action);
}
export function ideaTagLabels(idea:Pick<Idea,'intensity'|'breaksSitting'>){return [intensityLabels[idea.intensity||'light'],...(idea.breaksSitting?['Breaks up sitting']:[])];}
