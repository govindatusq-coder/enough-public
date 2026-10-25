// Records everything the current suggestion system (System A) shows for a
// persona: Home best fit and the others, the onboarding payoff, Right now for
// every situation, the full ranking, the progressive-profiling question,
// card copy, minutes, extra minutes and pictures. The Home selection mirrors
// components/life-map/home.tsx (planned ideas are left out of the picks).
import {rank,diversify,payoff,rightNow,situationsFor,stealOptions} from '../../lib/opportunity-engine.ts';
import {cardCopy} from '../../lib/opportunity-copy.ts';
import {illustrationFor} from '../../lib/illustrations.ts';
import {plannedMoments} from '../../lib/opportunity-log.ts';
import {nextProfilingQuestion} from '../../lib/profiling.ts';
import {NOW} from './personas.mjs';

const card=r=>{const c=cardCopy(r),art=illustrationFor(r.opportunity.imageCategory,r.opportunity.imageVariant);
 return {id:r.opportunity.id,title:c.title,body:c.body,why:c.why,minutes:c.minutes,extraMinutes:c.extraMinutes,eyebrow:r.matchedMoment?null:'WORTH A LOOK',image:art.src,imageAlt:art.alt};};

export function suggestionSnapshot(persona,{withFitting=false}={}){
 const lifeMap=withFitting?{...persona.lifeMap,fitting:persona.fitting}:persona.lifeMap;
 const input={lifeMap,feedback:persona.feedback,moments:persona.moments,now:NOW};
 const planned=new Set(plannedMoments(persona.moments).map(m=>m.opportunityId));
 const ranked=rank(input);
 const home=diversify(ranked.filter(r=>!planned.has(r.opportunity.id)),3).map(card);
 const right={};
 for(const situation of situationsFor(lifeMap))for(const steal of stealOptions){const r=rightNow(input,situation,steal.minutes);right[`${situation}/${steal.id}`]=r?card(r):null;}
 return {
  bestFit:home[0]||null,
  others:home.slice(1),
  payoff:payoff(input).map(r=>r.opportunity.id),
  rightNow:right,
  ranking:ranked.map(r=>[r.opportunity.id,r.score,r.minutes,r.extraMinutes]),
  question:nextProfilingQuestion(lifeMap,ranked.slice(0,12).map(r=>r.opportunity),NOW)?.id||null
 };
}
