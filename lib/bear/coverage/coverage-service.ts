import {addDays,todayISO} from '../domain/dates.ts';
import type {Task} from '../domain/types.ts';
import {flags} from '../flags.ts';
import {describe} from '../load/view.ts';
import {ensureProfile} from '../services/profile.ts';
import type {BearStore} from '../store/store.ts';
import type {Idea} from '../strategy/ideas.ts';
import {anticipateSchool} from './expectations.ts';
import {packs} from './registry.ts';
import type {PackId} from './types.ts';

// Category-level responsibility: "Help me keep on top of school admin". Turning a pack on is persistent
// and transparent: it says what Bear is handling, what still needs the person, and what Bear CAN'T see
// (it never implies Bear watches every school message just because the pack is on).
export const isSchoolTask=(t:Task)=>!!t.load?.nodes.find(n=>n.id===t.load!.primaryId)?.entities.school;
export interface PackCoverage{id:PackId;name:string;status:'full'|'definition';active:boolean;tracked:number;needsYou:number;handling:string[];needsYouLines:string[];cannotSee:string[]}

export async function coverageView(store:BearStore,now=new Date()):Promise<{enabled:boolean;packs:PackCoverage[]}>{
 if(!flags.coveragePacks())return {enabled:false,packs:[]};
 const profile=await ensureProfile(store);const today=todayISO(profile.lifeRhythm.timezone||'Australia/Sydney',now);
 const open=(await store.list('tasks',{where:[{column:'status',value:'open'}]})).filter(isSchoolTask);
 const reminders=await store.list('reminders',{where:[{column:'status',op:'in',value:['scheduled','snoozed']}]});
 const views=open.map(t=>describe(t.load!,today));
 const needs=views.filter(v=>v.needsYou).length;
 const payReady=views.filter(v=>v.prepared?.some(p=>p.key==='payment'&&!p.done)).length;
 const lists=views.filter(v=>v.prepared?.some(p=>p.key==='bring')).length;
 const held=reminders.filter(r=>open.some(t=>t.id===r.taskId)).length;
 const school=packs.find(p=>p.id==='school')!;
 return {enabled:true,packs:[{id:'school',name:school.name,status:'full',active:!!profile.coverage?.school?.active,tracked:open.length,needsYou:needs,
  handling:[open.length?`Keeping track of ${open.length} school ${open.length===1?'item':'items'}, each deadline on its own`:'Nothing from school right now',...(payReady?[`Payment details ready for ${payReady}`]:[]),...(lists?[`${lists===1?'A packing list':`${lists} packing lists`}, without repeats`]:[]),...(held?[`${held} ${held===1?'reminder':'reminders'} set`]:[])],
  needsYouLines:needs?[`${needs} ${needs===1?'thing needs':'things need'} you: signing, paying, booking or packing is always yours`]:['Nothing needs you right now'],
  cannotSee:school.boundaries}]};
}
export async function setCoverage(store:BearStore,pack:PackId,active:boolean,now=new Date()){
 const profile=await ensureProfile(store);const cov={...(profile.coverage||{})};
 cov[pack]={active,since:now.toISOString()};await store.update('profiles',profile.id,{coverage:cov});
}

// Bear Ideas candidates from the School pack. Every one maps to something Bear really does.
export async function schoolIdeaCandidates(store:BearStore,today:string,score:(p:Partial<Idea['score']>)=>Idea['score']):Promise<Idea[]>{
 if(!flags.responsibilityEngine())return [];
 const profile=await ensureProfile(store);const out:Idea[]=[];
 const tasks=await store.list('tasks');const school=tasks.filter(isSchoolTask);
 // 1. Offer category coverage once a few school notices have come in.
 const recent=school.filter(t=>t.createdAt.slice(0,10)>=addDays(today,-90));
 if(!profile.coverage?.school&&recent.length>=2)out.push({id:'cover:school',family:'load',type:'expand_coverage',eyebrow:'Bear can keep these together',title:'Want Bear to keep school admin together?',body:`You’ve given Bear ${recent.length} school notices. Bear can group them, keep each deadline and show what still needs you in one place. It only sees what you give it.`,actions:[{key:'activate_pack',label:'Yes, keep them together',primary:true},{key:'dismiss',label:'Not now'}],minutes:null,entity:'coverage:school',score:score({loadRemoved:0.6,decisions:0.3})});
 // 2. Anticipation from this person's own history only. Possibility, never fact.
 const watched=profile.anticipations||{};
 for(const a of anticipateSchool(tasks,today)){const w=watched[a.kind];const year=today.slice(0,4);
  if(w?.status==='not_this_year'&&w.year===year)continue;
  if(w?.status==='watching'&&w.year===year){if(w.askOn<=today)out.push({id:`ask:${a.kind}:${year}`,family:'load',type:'monitor',eyebrow:'Bear remembered',title:`Has the school sent anything about ${a.title.toLowerCase().replace(/^school /,'')}?`,body:'Last year it was around now. If a notice has come, give it to Bear and it will sort out the rest.',actions:[{key:'open',label:'Give it to Bear',primary:true},{key:'not_this_year',label:'Not this year'}],href:'/bear/capture',minutes:2,entity:`anticipate:${a.kind}`,score:score({loadRemoved:0.55,pressure:0.3})});continue;}
  out.push({id:`watch:${a.kind}:${year}`,family:'load',type:'monitor',eyebrow:'Last year, around now',title:`${a.title} were around this time last year`.replace(/ were around/,/s$/.test(a.title)?' were around':' was around'),body:'Nothing has been confirmed yet. Want Bear to check with you in a couple of weeks?',actions:[{key:'watch',label:'Yes, check with me',primary:true},{key:'not_this_year',label:'Not this year'}],minutes:null,entity:`anticipate:${a.kind}`,score:score({loadRemoved:0.5,pressure:0.25})});
 }
 return out;
}
export async function watchAnticipation(store:BearStore,kind:string,status:'watching'|'not_this_year',today:string){
 const profile=await ensureProfile(store);const a={...(profile.anticipations||{})};
 a[kind]={status,year:today.slice(0,4),askOn:addDays(today,14)};await store.update('profiles',profile.id,{anticipations:a});
}
