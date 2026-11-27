// My Wins: how many things she has finished. A plain count (this week, this month, all time) and the most recent ones,
// crossed off. No streaks, targets or comparisons, and examples never count. Undoing a "done" takes it back off.
import {addDays,todayISO} from '../domain/dates.ts';
import type {BearStore} from '../store/store.ts';
import {ensureProfile} from './profile.ts';
import {selectedPath} from '../rre/plan.ts';

// Time and money saved are estimates, and say so: money only from savings Bear can show (a late fee avoided, a discount
// used); time from Bear's own estimate of the steps it prepared on finished things, plus any time Bear recorded saving.
export interface MyWins{total:number;week:number;month:number;recent:{taskId:string;title:string;at:string}[];timeMinutes:number;moneyCents:number}
const dayIn=(iso:string,tz:string)=>todayISO(tz,new Date(iso));
export async function myWins(store:BearStore,now=new Date()):Promise<MyWins>{
 const profile=await ensureProfile(store);const tz=profile.lifeRhythm.timezone||'Australia/Sydney';
 const completions=await store.list('completions',{orderBy:{column:'completed_at',ascending:false},limit:2000});
 const tasks=new Map((await store.list('tasks',{where:[{column:'status',value:'done'}],limit:5000})).map(t=>[t.id,t]));
 // Only tasks still marked done and not examples; one count per task even if it was ticked, undone and ticked again.
 const seen=new Set<string>();const done=completions.filter(c=>{const t=tasks.get(c.taskId);if(!t||t.isDemo||seen.has(c.taskId))return false;seen.add(c.taskId);return true;});
 const today=todayISO(tz,now);const wd=(new Date(today+'T12:00:00Z').getUTCDay()+6)%7;const monday=addDays(today,-wd);const monthStart=today.slice(0,8)+'01';
 const days=done.map(c=>dayIn(c.completedAt,tz));
 return {total:done.length,week:days.filter(d=>d>=monday).length,month:days.filter(d=>d>=monthStart).length,
  recent:done.slice(0,20).map(c=>({taskId:c.taskId,title:tasks.get(c.taskId)!.title,at:c.completedAt})),...await savedSoFar(store,done.map(c=>tasks.get(c.taskId)!))};
}
async function savedSoFar(store:BearStore,done:{rre?:import('../rre/plan.ts').Plan|null}[]){
 const ledger=await store.list('value_ledger',{limit:1000});
 const moneyCents=ledger.filter(r=>r.kind==='wealth'&&r.defensible&&!r.isDemo).reduce((n,r)=>n+(r.amountCents||0),0);
 const recorded=ledger.filter(r=>r.kind==='happiness'&&!r.isDemo).reduce((n,r)=>n+(r.minutes||0),0);
 const prepared=done.reduce((n,t)=>{const p=t.rre;if(!p?.execution.prepared)return n;return n+selectedPath(p).steps.filter(s=>s.who==='bear').reduce((m,s)=>m+(s.userMinutes||0),0);},0);
 return {timeMinutes:recorded+prepared,moneyCents};
}
