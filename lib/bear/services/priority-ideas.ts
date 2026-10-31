import {addDays,daysBetween} from '../domain/dates.ts';
import {friendlyDate} from '../load/words.ts';
import type {BearStore} from '../store/store.ts';
import {ensureProfile} from './profile.ts';
import {prioritiseOpen,priorityEnabled} from './priority.ts';

// Bear Ideas from the Priority Engine: a few suggestions that take thinking off the person's plate.
// Not a second inbox: at most four, never the thing already on My Bear, and each one leads somewhere
// useful (an item, a page) or can be put off. Nothing changes unless the person says so.
export interface PriorityIdea{id:string;kind:'this_week'|'head_start'|'smaller'|'stuck'|'line_up'|'let_go'|'busy_week'|'what_matters';title:string;body:string;actionLabel:string;href:string;taskId:string|null}

export async function priorityIdeas(store:BearStore,now=new Date()):Promise<PriorityIdea[]>{
 if(!priorityEnabled())return [];
 const pr=await prioritiseOpen(store,now);const today=pr.ctx.today;
 const [tasks,projects]=await Promise.all([store.list('tasks',{where:[{column:'status',value:'open'}]}),store.list('projects')]);
 const title=(id:string)=>tasks.find(t=>t.id===id)?.title||'This one';
 const out:PriorityIdea[]=[];const used=new Set<string>([pr.top?.id||'']);
 const results=[...pr.results.values()].filter(r=>!used.has(r.id));
 // Needs a head start: someone else needs time, and the comfortable moment is coming up.
 for(const r of results.filter(r=>r.explanation.reasons.some(x=>x.key==='lead')&&r.latestComfortableActionAt&&(daysBetween(today,r.latestComfortableActionAt)??99)<=10&&!r.surfaceNow).slice(0,1)){used.add(r.id);out.push({id:'head-'+r.id,kind:'head_start',title:`Give ${title(r.id)} a head start`,body:`${r.explanation.reasons.find(x=>x.key==='lead')!.text} Starting by ${friendlyDate(r.latestComfortableActionAt,today)} keeps it calm.`,actionLabel:'Take a look',href:`/bear/tasks/${r.id}`,taskId:r.id});}
 // Bear can make it smaller: important things that keep getting put off.
 for(const r of results.filter(r=>r.support==='prepare_more'&&r.firstStep&&!used.has(r.id)).slice(0,1)){used.add(r.id);out.push({id:'smaller-'+r.id,kind:'smaller',title:`Make ${title(r.id).toLowerCase()} smaller`,body:`It matters, and it’s easy to put off. ${r.firstStep}`,actionLabel:'Start small',href:`/bear/tasks/${r.id}`,taskId:r.id});}
 // Good to do this week: the next most worthwhile thing after My Bear's one.
 for(const r of results.filter(r=>r.timingLabel==='Good to do this week'&&!used.has(r.id)).sort((a,b)=>b.importance-a.importance).slice(0,1)){used.add(r.id);out.push({id:'week-'+r.id,kind:'this_week',title:`${title(r.id)} is good to do this week`,body:`About ${r.minutes||5} minutes${r.latestComfortableActionAt?`, ideally by ${friendlyDate(r.latestComfortableActionAt,today)}`:''}. Doing it early means one less thing on your mind.`,actionLabel:'Do it early',href:`/bear/tasks/${r.id}`,taskId:r.id});}
 // Waiting too long: the reply window has passed.
 const stuck=tasks.find(t=>t.load?.nodes.some(n=>n.state==='waiting'&&n.waiting?.expectedBy&&n.waiting.expectedBy<today)&&!used.has(t.id));
 if(stuck){const n=stuck.load!.nodes.find(x=>x.waiting)!;out.push({id:'stuck-'+stuck.id,kind:'stuck',title:`Still waiting on ${n.waiting!.waitingFor}`,body:`It’s been a while for ${stuck.title.toLowerCase()}. A short nudge often gets things moving.`,actionLabel:'Take a look',href:`/bear/tasks/${stuck.id}`,taskId:stuck.id});}
 // Mental-load ideas: about the whole picture, not one task.
 const unsorted=projects.find(p=>p.captureId&&p.status==='active'&&!p.priority);
 if(unsorted)out.push({id:'lineup-'+unsorted.captureId,kind:'line_up',title:'Line up your projects',body:'Some projects from a list you gave Bear haven’t been lined up yet. One quick pass and Bear brings back only the next thing in each.',actionLabel:'Line them up',href:`/bear/sort/${unsorted.captureId}`,taskId:null});
 const quiet=tasks.filter(t=>t.timing==='flexible'&&!t.dueAt&&t.updatedAt.slice(0,10)<=addDays(today,-30));
 if(quiet.length>=3)out.push({id:'letgo-'+quiet.length,kind:'let_go',title:`${quiet.length} things have sat quietly for a month`,body:'If some don’t matter any more, letting them go is a real way to lighten the load.',actionLabel:'Have a look',href:'/bear/me/everything',taskId:null});
 const deadlines=[...pr.results.values()].map(r=>r.deadline).filter((d):d is string=>!!d&&d>=today&&d<=addDays(today,14)).sort();
 for(let i=0;i+2<deadlines.length;i++)if((daysBetween(deadlines[i],deadlines[i+2])??99)<=2){out.push({id:'busy-'+deadlines[i],kind:'busy_week',title:`Busy stretch around ${friendlyDate(deadlines[i],today)}`,body:'Three or more things fall due within a couple of days. Doing one early spreads the load.',actionLabel:'See what’s coming',href:'/bear/me/everything',taskId:null});break;}
 const profile=await ensureProfile(store);
 if(!profile.valuesMap?.values.some(v=>v.source==='user'&&v.confidence>0)&&tasks.length>=5)out.push({id:'matters',kind:'what_matters',title:'Tell Bear what matters to you',body:'A few taps help Bear tell what’s important from what’s just loud, so it asks you less.',actionLabel:'Choose',href:'/bear/me#matters',taskId:null});
 return out.slice(0,4);
}
