import {z} from 'zod';
import {loadDomains,patternIds,type LoadDomain,type LoadMap,type PatternId} from './types.ts';
import type {AreaKey} from '../domain/types.ts';

// The Load Map: who this person is carrying for and how they want Bear to behave. Built up
// progressively from onboarding and from what they do; every field is optional, and nothing
// is inferred from age, gender or location. Responsibility is asked, never assumed.
export const struggleOptions=[
 {key:'forget_until_urgent',label:'I forget until it’s urgent'},
 {key:'wrong_time',label:'I remember, but at the wrong time'},
 {key:'too_many_steps',label:'There are too many little steps'},
 {key:'putting_off',label:'I keep putting things off'},
 {key:'lost_in_messages',label:'Things get lost in messages or emails'},
 {key:'too_much',label:'I have too much in my head'},
 {key:'following_up',label:'Following up drains me'},
 {key:'coordinating',label:'Coordinating everyone is hard'},
] as const;
export const handoverOptions=[
 {key:'remembering',label:'Remembering things'},
 {key:'timing',label:'Working out when'},
 {key:'steps',label:'Breaking things into steps'},
 {key:'tracking',label:'Keeping track'},
 {key:'preparing',label:'Preparing things'},
 {key:'following_up',label:'Following up'},
 {key:'coordinating',label:'Coordinating'},
 {key:'all',label:'All of it where possible'},
] as const;
export const domainOptions:{key:LoadDomain;label:string;sub:string}[]=[
 {key:'kids',label:'Kids',sub:'School, activities, the lot'},{key:'home',label:'Home',sub:'The house and everything in it'},{key:'work',label:'Work',sub:'Deadlines and meetings'},
 {key:'money',label:'Money',sub:'Bills, fees, subscriptions'},{key:'health',label:'Health',sub:'Appointments and care'},{key:'people',label:'People',sub:'Birthdays, family, friends'},
 {key:'life_admin',label:'Life admin',sub:'Forms, renewals, paperwork'},{key:'pets',label:'Pets',sub:'Vet, food, care'},{key:'other',label:'Other',sub:'Anything else'},
];
// The app's six areas are how things are filed; domains are what the person carries.
export const domainArea:Record<LoadDomain,AreaKey>={kids:'family',home:'home',work:'work',money:'money',health:'health',people:'family',life_admin:'me',pets:'home',other:'me'};
export const areasFromDomains=(domains:LoadMap['domains'])=>[...new Set(Object.entries(domains).filter(([,v])=>v).map(([k])=>domainArea[k as LoadDomain]))];

// What each struggle tells Bear about the kind of thinking that costs this person most (1–5).
const struggleWeights:Record<string,Partial<Record<keyof NonNullable<LoadMap['cognitiveProfile']>,number>>>={
 forget_until_urgent:{remembering:5},wrong_time:{remembering:4},too_many_steps:{planning:5},putting_off:{initiating:5},
 lost_in_messages:{monitoring:4},too_much:{remembering:4,deciding:3},following_up:{followingUp:5},coordinating:{coordinating:5},
};
export function cognitiveProfileFrom(struggles:string[]):NonNullable<LoadMap['cognitiveProfile']>{
 const out:NonNullable<LoadMap['cognitiveProfile']>={};
 for(const s of struggles)for(const [k,v] of Object.entries(struggleWeights[s]||{}))out[k as keyof typeof out]=Math.max(out[k as keyof typeof out]||0,v as number);
 return out;
}
// How far ahead Bear brings things back, personalised: people who forget until it's urgent get more notice.
export function leadDays(map:LoadMap|null|undefined,base=3){if(map?.learned?.billLeadDays)return map.learned.billLeadDays;return (map?.cognitiveProfile?.remembering||0)>=5?base+2:base;}

const n=z.number().int().min(0).max(5).optional();
export const loadMapSchema=z.object({
 domains:z.record(z.enum(loadDomains),z.boolean()).default({}),
 household:z.object({adults:z.number().int().min(0).max(10).optional(),children:z.array(z.object({ageBand:z.enum(['0-4','5-11','12-17','18+'])}).strict()).max(10).optional(),dependants:z.number().int().min(0).max(10).optional(),pets:z.boolean().optional(),shape:z.array(z.enum(['just_me','partner','children','dependants'])).max(4).optional()}).strict().optional(),
 responsibilities:z.array(z.object({area:z.string().max(40),who:z.enum(['me','shared','someone_else'])}).strict()).max(20).optional(),
 workPattern:z.object({type:z.enum(['full_time','part_time','shift','study','not_working','other']).optional(),schedule:z.string().max(60).optional(),flexibility:z.string().max(60).optional()}).strict().optional(),
 caringResponsibilities:z.array(z.enum(['children','older_family','support_needs','pets','none'])).max(5).optional(),
 locationContext:z.object({country:z.string().max(60).optional(),region:z.string().max(60).optional(),localityType:z.enum(['urban','regional','rural','unknown']).optional()}).strict().optional(),
 cognitiveProfile:z.object({remembering:n,deciding:n,planning:n,initiating:n,coordinating:n,monitoring:n,followingUp:n}).strict().optional(),
 struggles:z.array(z.enum(struggleOptions.map(s=>s.key) as [string,...string[]])).max(8).optional(),
 handover:z.array(z.enum(handoverOptions.map(s=>s.key) as [string,...string[]])).max(8).optional(),
 preferences:z.object({canWait:z.enum(['leave','gentle','visible']).optional(),urgent:z.enum(['tell','persistent','help']).optional(),ignored:z.enum(['keep','ask','back_off']).optional(),reminderStyle:z.string().max(40).optional(),persistence:z.string().max(40).optional(),preferredTiming:z.string().max(40).optional(),bundling:z.string().max(40).optional(),interruptionTolerance:z.string().max(40).optional()}).strict().optional(),
 providers:z.array(z.object({pattern:z.enum(patternIds),name:z.string().max(80),uses:z.number().int().min(0)}).strict()).max(40).optional(),
 learned:z.object({billLeadDays:z.number().int().min(1).max(14).optional(),followUpDays:z.number().int().min(1).max(21).optional(),choices:z.record(z.string(),z.number()).optional()}).strict().optional(),
}).strict();

// ---------- Progressive learning ----------
// Small, visible, resettable. Nothing sensitive is ever inferred.
export function learnFromAction(map:LoadMap,ev:{pattern:PatternId;evidence:string|null;provider?:string|null}):LoadMap{
 const next:LoadMap=structuredClone(map);next.learned??={};const choices=next.learned.choices??={};
 if(ev.evidence){const k=`${ev.pattern}:${ev.evidence}`;choices[k]=(choices[k]||0)+1;}
 // Asked to wait longer, again and again: give people more time before Bear checks.
 if(ev.evidence==='still_waiting'&&(choices[`${ev.pattern}:still_waiting`]||0)>=2)next.learned.followUpDays=Math.min(21,(next.learned.followUpDays??5)+2);
 // Chased straight away more than once: check sooner.
 if(ev.evidence==='chased'&&(choices[`${ev.pattern}:chased`]||0)>=2)next.learned.followUpDays=Math.max(2,(next.learned.followUpDays??5)-1);
 // The same provider used again becomes the suggestion next time.
 if(ev.provider&&(ev.evidence==='contacted'||ev.evidence==='booked')){const list=next.providers??=[];const p=list.find(x=>x.pattern===ev.pattern&&x.name===ev.provider);if(p)p.uses++;else list.push({pattern:ev.pattern,name:ev.provider,uses:1});}
 return next;
}
// The person keeps moving bill reminders to the same number of days before: that becomes the lead time.
export function learnBillLead(map:LoadMap,daysBefore:number):LoadMap{
 const next:LoadMap=structuredClone(map);next.learned??={};const choices=next.learned.choices??={};
 const k=`bill_lead:${daysBefore}`;choices[k]=(choices[k]||0)+1;
 if(choices[k]>=2&&daysBefore>=1&&daysBefore<=14)next.learned.billLeadDays=daysBefore;
 return next;
}
export const usualProvider=(map:LoadMap|null|undefined,pattern:PatternId)=>map?.providers?.filter(p=>p.pattern===pattern&&p.uses>=2).sort((a,b)=>b.uses-a.uses)[0]?.name||null;
export const resetLearned=(map:LoadMap):LoadMap=>({...map,learned:{},providers:[]});
