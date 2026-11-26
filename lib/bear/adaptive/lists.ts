// Adaptive Responsibility Engine: Bear Brain's lists, suited to how her days work.
// Lists are only how she sees things. What a responsibility is (its attributes) is kept separately, so a task exists once
// and Bear can still reason about it whatever she calls her lists. Suggested sets are starting points; she can keep, rename,
// reorder, delete or mix them. Existing lists are never replaced without her saying so.
import {STARTER_LISTS,type BearList} from '../board/logic.ts';
import type {Attributes} from './attributes.ts';
import {dominant,type TemporalProfile} from './profile.ts';

export type ListStyle='classic'|'areas'|'routine'|'windows'|'support'|'custom';
type Rule=(a:Attributes,ctx:{delegationAccess:number})=>boolean;
export interface ListTemplate{id:string;title:string;icon:string;rule:Rule;blurb:string}
export interface ListSet{style:Exclude<ListStyle,'custom'>;name:string;line:string;lists:ListTemplate[]}

const waiting:Rule=a=>a.readiness==='waiting'||a.contextTags.includes('waiting_on_others');
const T=(id:string,title:string,icon:string,rule:Rule,blurb=''):ListTemplate=>({id,title,icon,rule,blurb});
const any:Rule=()=>true;

export const LIST_SETS:ListSet[]=[
 {style:'classic',name:'Bear’s originals',line:'When and how things get done',lists:[
  T('night','Night Time','🌙',a=>a.contextTags.includes('online')||a.contextTags.includes('needs_focus')),T('calls','Phone Calls','📞',a=>a.requiresBusinessHours),
  T('followup','Organise Follow-Up','🔄',a=>a.pattern==='followup'||waiting(a,{delegationAccess:0})),T('spare','Organise Time-Permitting','✨',a=>a.pattern==='chore'),
  T('week','This Week & Weekend','📅',a=>a.pattern==='gifts'||a.domain==='social'),T('aspire','Aspirations','🌱',a=>a.pattern==='aspiration')]},
 {style:'areas',name:'By area of life',line:'Work, family, home, money, you',lists:[
  T('work','Work','💼',a=>a.domain==='work_admin'||a.domain==='work_deliverables'),
  T('family','Family','❤️',a=>['school_admin','childcare','child_health','family_coordination','social','adult_caregiving','travel'].includes(a.domain)),
  T('home','Home','🏠',a=>['meals','cleaning_laundry','home_maintenance','replenishment','shopping','pets','transport','digital_admin'].includes(a.domain)),
  T('money','Money','💰',a=>a.domain==='finances'),T('wellbeing','My Wellbeing','🩺',a=>a.domain==='wellbeing'),T('goals','Personal Goals','🌱',a=>a.domain==='personal_goals'||a.pattern==='aspiration')]},
 {style:'routine',name:'Around my routine',line:'Fitted to the shape of your day',lists:[
  T('waiting','Waiting on Others','⏳',waiting),T('business','Business Hours','📞',a=>a.requiresBusinessHours),
  T('after','After Work','🚗',a=>a.locationRequirements.length>0),T('before','Before Work','☀️',a=>a.humanMinutes>0&&a.humanMinutes<=5&&a.interruptibility==='high'),
  T('week','This Week & Weekend','📅',a=>a.pattern==='gifts'||a.domain==='social'||a.pattern==='chore'),T('night','Nighttime','🌙',any)]},
 {style:'windows',name:'By the time I’ve got',line:'Quick ones, longer ones, when you’re out',lists:[
  T('waiting','Waiting on Others','⏳',waiting),T('open','When Places Are Open','🕘',a=>a.requiresBusinessHours),
  T('out','When I’m Out','🛍️',a=>a.locationRequirements.length>0),T('quiet','Quiet Moments','🌙',a=>a.contextTags.includes('needs_focus')||a.cognitiveEffort==='high'),
  T('longer','A Longer Window','⏱️',a=>a.humanMinutes>20),T('quick','Quick Wins','⚡',any)]},
 {style:'support',name:'What I need help with',line:'What Bear can do, what others can, what’s yours',lists:[
  T('waiting','Waiting on Others','⏳',waiting),T('just_me','Just for Me','💛',a=>a.domain==='wellbeing'||a.domain==='personal_goals'||a.pattern==='aspiration'),
  T('bear_prep','Bear Can Prepare','🐻',a=>a.agentPreparationAvailable),T('someone','Someone Else Can Do It','🤝',(a,c)=>a.delegationEligible&&c.delegationAccess>=.4),
  T('arrange','Needs Arranging','📋',a=>a.requiresBusinessHours||['appointment','call','followup','form'].includes(a.pattern)),T('capacity','When I Have Capacity','🌿',any)]},
];
// Order the lists are shown in (the rules above are in priority order, which isn't always the natural reading order).
const SHOW_ORDER:Record<string,string[]>={routine:['before','business','after','night','week','waiting'],windows:['quick','longer','open','out','quiet','waiting'],
 support:['bear_prep','arrange','someone','capacity','waiting','just_me']};
export const setOf=(style:ListStyle|null|undefined)=>LIST_SETS.find(s=>s.style===style)||null;
const templateById=new Map(LIST_SETS.flatMap(s=>s.lists.map(l=>[l.id,l] as const)));

// The lists a set starts with, in reading order. "After Pickup" only when she has told Bear there are children at home.
export function listsForStyle(style:Exclude<ListStyle,'custom'>,opts:{children?:boolean}={}):BearList[]{
 if(style==='classic')return STARTER_LISTS.map(l=>({...l}));
 const set=setOf(style)!;const order=SHOW_ORDER[style]||set.lists.map(l=>l.id);
 return order.map((id,i)=>{const t=set.lists.find(l=>l.id===id)!;return {id:t.id,title:t.id==='after'&&opts.children?'After Pickup':t.title,icon:t.icon,order:i};});
}
// Which set suits her best, from the scored profile. Not confident enough: keep Bear's originals.
export function recommendStyle(p:TemporalProfile|null|undefined):Exclude<ListStyle,'custom'>{
 const d=dominant(p);if(!p||!d||(p.confidence.autonomy+p.confidence.predictability)/2<.4)return 'classic';
 if(p.answers.howDone==='in_advance'&&p.dims.autonomy>=.6)return 'areas';
 return ({planner:'areas',juggler:'routine',improviser:'windows',oncall:'support'} as const)[d];
}
// Bear's suggestion of a list for a responsibility, from its attributes, among the lists she actually has (any mix).
// Her own lists with names Bear doesn't know get no rule-based suggestion; her corrections (learning) cover those.
export function ruleSuggestion(a:Attributes,lists:BearList[],delegationAccess=.5):string|null{
 const ids=new Set(lists.map(l=>l.id));
 // Walk sets in a stable order; within each, rules are in priority order. The first rule that matches a list she has wins.
 for(const set of LIST_SETS)for(const t of set.lists){if(!ids.has(t.id))continue;if(t.rule===any)continue;if(t.rule(a,{delegationAccess}))return t.id;}
 for(const set of LIST_SETS)for(const t of set.lists)if(ids.has(t.id)&&t.rule===any)return t.id;
 return null;
}
export const isKnownList=(id:string)=>templateById.has(id);
