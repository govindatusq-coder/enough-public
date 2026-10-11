import {z} from 'zod';
import type {Idea} from './ideas.ts';
export const todayContexts=['Less time','Lower energy','Feeling stressed','Tired after a shift','Plans changed','Nothing different'] as const;
export const sittingContexts=['Desk work','Driving','Evenings','Feeding and settling','Commute','It varies'] as const;
export const sittingContextsSchema=z.array(z.enum(sittingContexts)).max(6).refine(values=>new Set(values).size===values.length,'Choose each context once');
export type SittingContext=typeof sittingContexts[number];
export function matchesSittingContext(idea:Idea,context:SittingContext){
 if(!idea.breaksSitting||idea.minutes>3)return false;
 if(context==='It varies')return true;
 if(context==='Desk work')return idea.category==='work'||idea.key==='short-call-pace';
 if(context==='Driving')return idea.key==='parked-driving-pause';
 if(context==='Evenings')return ['evening-room-lap','ad-break-wall-pushups','kettle-calf-raises'].includes(idea.key);
 if(context==='Feeding and settling')return idea.key==='settled-room-walk';
 return idea.category==='travel';
}
