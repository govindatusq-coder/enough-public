import {completeProfile,type Profile} from './journey.ts';
import {nextOpportunitySection,type OpportunityProfile} from './opportunity-profile.ts';
export type LifeSetupSection='roles'|'place'|'goals'|'work'|'caring'|'later-life'|'friction'|'complete';
export function resumeLifeSetup(p:Profile):LifeSetupSection{return nextOpportunitySection(p.opportunity||{roles:[],goals:[],frictions:[],alreadyDo:[]});}
export function resumeSetup(p:Profile){if(completeProfile(p))return 0;const categories=['preferences','interests','needs','strengths'] as const;if(!p.name&&!categories.some(k=>p[k].length)&&!p.activity&&!p.rhythms.length&&!p.window)return 0;const missing=categories.findIndex(k=>p[k].length===0);return missing>=0?missing+1:5;}
export function setupInstruction(step:number){return step>=1&&step<=4?'Choose at least one answer. “Nothing to add” is an answer too.':step===5?'Answer all three routine questions. “Every day is different”, “No regular routine” and “It varies” are valid choices.':'';}
export const lifeSetupCopy:Record<Exclude<LifeSetupSection,'complete'>,{title:string;description:string}>={
 roles:{title:'What takes up most of your week?',description:'Choose everything that is part of your real week.'},
 place:{title:'Where does most of your day happen?',description:'This helps ENOUGH avoid ideas that do not fit where you actually are.'},
 goals:{title:'What would you like ENOUGH to help with?',description:'Pick the payoff that matters now. You can change it later.'},
 work:{title:'What does work or study actually look like?',description:'We only need the recurring moments that change what will fit.'},
 caring:{title:'What does caring time look like?',description:'ENOUGH can find movement inside caring rather than adding another job.'},
 'later-life':{title:'What kind of movement fits now?',description:'Choose by comfort and confidence, not age.'},
 friction:{title:'When would movement annoy you?',description:'We will use these as boundaries, not as motivation problems.'}
};
export function updateOpportunity(p:Profile,patch:Partial<OpportunityProfile>):Profile{return {...p,opportunity:{roles:[],goals:[],frictions:[],alreadyDo:[],...(p.opportunity||{}),...patch}};}
