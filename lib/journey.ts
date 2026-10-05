import {catalogue,byId,promised,type Idea,type ValueType} from "./ideas.ts";
import {ideaSchema} from "./idea-validation.ts";
import type { Companion } from "./move-memories";
import type { SupportPlan } from "./move-support";
import {currencyCodes,countrySchema,costSchema,type Cost} from "./regions.ts";
export const STORAGE_KEY = 'enough.stage2.v1';
export const groups = [
 {key:'preferences',title:'How do you like things?',description:'Choose what feels comfortable. You can change this later.',options:['Outside','Indoors','Alone','With someone','Quiet','Music','Morning','Afternoon','Evening','Planned','Spontaneous','Short bursts','Take my time','Familiar places','New places']},
 {key:'interests',title:'What do you enjoy?',description:'Start with things that already make your day better.',options:['Podcasts','Music','Coffee','Family time','Friends / talking','Nature','Animals','Shopping / browsing','Photography','Exploring new places','Learning','Gardening','Making things','Audiobooks','TV / streaming','Sport','Food','Markets','Community activities','Creative hobbies','Reading','Gaming','Listening to something','Solving problems']},
 {key:'needs',title:'What should we work around?',description:'Your needs set the boundaries. Choose any that fit, or “Nothing to add”.',options:['Not enough time','Save money','Low energy / tired','Family or caring','Work / shifts','Need recovery','Safety matters','Weather / heat','Hard to walk where I live','Physical comfort / accessibility','Need flexibility','Already active at work','Sleep matters','Pain / discomfort','Unpredictable day','Transport limitations','Money is tight','Privacy matters',"I don’t enjoy exercise"]},
 {key:'strengths',title:'What already works for you?',description:'There is no right answer. Start with a strength you recognise.',options:['I keep routines','I like getting things done',"I walk when there’s a reason",'I enjoy company','I can do things independently','I like exploring','I solve problems','I care for others','I know my neighbourhood','I use public transport',"I’m already on my feet",'I’m willing to try small changes','I know what works for me','I enjoy learning','I’m good at planning','I adapt when plans change','I have supportive people','I like challenges','I notice patterns']}
] as const;
export type Category = typeof groups[number]['key'];
export type Profile = {country?:string;name:string;preferences:string[];interests:string[];needs:string[];strengths:string[];activity:string;rhythms:string[];window:string;currency:string;visual:string[];complete:boolean};
import type {Evidence,MovementSettings} from "./movement";
export type Entry = {id:string;ideaId:number;status:'accepted'|'completed'|'not-today';acceptedAt:string;completedAt?:string;minutes?:number;outside?:boolean;connecting?:boolean;worthwhile?:boolean;moneyCents?:number;currency:string;support?:SupportPlan;companions?:Companion[];predicted?:ValueType[];gave?:ValueType[];timeCombined?:number;movementWindow?:{start:string;end?:string};movementEvidence?:Evidence;additionalMovement?:'more'|'same'|'less'|'unsure'};
export type State = {version:1;costs?:Cost[];movementSettings?:MovementSettings;profile:Profile;saved:number[];entries:Entry[];demo:boolean;today:{date:string;context:string};generated?:Idea[];passes?:{ideaId:number;at:string}[];tuning?:{extraMinutes:number;travel:'walk'|'drive'|'transit'|'varies';hidden:number[]}};
export const emptyState = ():State => ({version:1,profile:{name:'',preferences:[],interests:[],needs:[],strengths:[],activity:'',rhythms:[],window:'',currency:'AUD',visual:[],complete:false},saved:[],entries:[],demo:false,today:{date:'',context:''}});
export const currencies:readonly string[] = currencyCodes;
export function completeProfile(p:Profile){return groups.every(g=>p[g.key].length>0)&&!!p.activity&&p.rhythms.length>0&&!!p.window;}
export function localDate(date=new Date()){return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;}
export function receipt(entries:Entry[],period:string,currency:string,now=new Date()){
 const start=new Date(now);start.setHours(0,0,0,0);if(period==='This week')start.setDate(start.getDate()-((start.getDay()+6)%7));
 const rows=entries.filter(e=>e.status==='completed'&&e.completedAt&&new Date(e.completedAt)>=start&&new Date(e.completedAt)<=now);
 return {rows,money:rows.filter(e=>e.currency===currency).reduce((n,e)=>n+(e.moneyCents||0),0),outside:rows.reduce((n,e)=>n+(e.outside?e.minutes||0:0),0),connecting:rows.reduce((n,e)=>n+(e.connecting?e.minutes||0:0),0),worthwhile:rows.filter(e=>e.worthwhile).length};
}
export function accept(s:State,ideaId:number):State{if(!s.demo||!completeProfile(s.profile))return s;if(s.entries.some(e=>e.ideaId===ideaId&&e.status==='accepted'))return s;return {...s,entries:[...s.entries,{id:crypto.randomUUID(),ideaId,status:'accepted',acceptedAt:new Date().toISOString(),currency:s.profile.currency,predicted:byId(ideaId,s.generated)?promised(byId(ideaId,s.generated)!):[]}]};}
export function finish(s:State,id:string,outcome:Pick<Entry,'minutes'|'outside'|'connecting'|'worthwhile'|'moneyCents'|'gave'|'timeCombined'|'additionalMovement'>):State{
 if(!Number.isInteger(outcome.minutes)||outcome.minutes!<0||outcome.minutes!>240||!Number.isInteger(outcome.moneyCents)||outcome.moneyCents!<0||outcome.moneyCents!>100000)throw Error('Check your minutes and saving.');
 return {...s,entries:s.entries.map(e=>e.id===id&&e.status==='accepted'?{...e,...outcome,status:'completed',completedAt:new Date().toISOString()}:e)};
}
export function restore(raw:string):State {
 const s=JSON.parse(raw);if(s?.profile?.country!==undefined)countrySchema.parse(s.profile.country);if(s?.costs!==undefined){if(!Array.isArray(s.costs)||s.costs.length>200)throw Error("Stored costs could not be read.");s.costs=s.costs.map((c:unknown)=>costSchema.parse(c));}if(s?.generated){if(!Array.isArray(s.generated)||s.generated.length>100)throw Error('Stored ideas could not be read.');s.generated=s.generated.map((i:unknown)=>ideaSchema.parse(i));} const stringArray=(v:unknown):v is string[]=>Array.isArray(v)&&v.every(x=>typeof x==='string');
 if(!s||s.version!==1||!s.profile||!Array.isArray(s.entries)||!Array.isArray(s.saved)||!groups.every(g=>stringArray(s.profile[g.key]))||typeof s.profile.name!=='string'||!stringArray(s.profile.rhythms)||!stringArray(s.profile.visual)||typeof s.profile.activity!=='string'||typeof s.profile.window!=='string'||!currencies.includes(s.profile.currency)||!s.today||typeof s.today.date!=='string'||typeof s.today.context!=='string'||typeof s.demo!=='boolean'||s.saved.some((n:unknown)=>typeof n!=='number'||!byId(n,s.generated)))throw Error('Stored preview could not be read.');
 if(s.entries.some((e:Entry)=>!e||typeof e.id!=='string'||!byId(e.ideaId,s.generated)||!['accepted','completed','not-today'].includes(e.status)||!currencies.includes(e.currency)||!Number.isFinite(Date.parse(e.acceptedAt))||e.status==='completed'&&(!e.completedAt||!Number.isFinite(Date.parse(e.completedAt))||!Number.isInteger(e.minutes)||e.minutes!<0||e.minutes!>240||!Number.isInteger(e.moneyCents)||e.moneyCents!<0||e.moneyCents!>100000||typeof e.outside!=='boolean'||typeof e.connecting!=='boolean'||typeof e.worthwhile!=='boolean')))throw Error('Stored moves could not be read.');
 if(s.costs?.some((c:Cost)=>!byId(c.ideaId,s.generated)))throw Error("Stored cost reference could not be read.");
 return {...s,profile:{...s.profile,complete:completeProfile(s.profile)}};
}
