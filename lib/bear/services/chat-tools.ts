// What the chat's AI may do in the app. Only one action changes anything: adding tasks. The AI chooses the words and the area;
// the dates are always worked out from the person's own words by fixed rules, so a date is never the AI's invention.
import {z} from 'zod';
import {areaKeys,type AreaKey} from '../domain/types.ts';
import type {BearStore} from '../store/store.ts';
import {lightFor,saidDate,soonByNature,sortOne,suggestStart} from './sorter.ts';
import {changeSorted,placeSorted,type SortedItem} from './sort-service.ts';

export const addTasksTool={
 name:'add_tasks',
 description:'Add things the person needs to do or remember to their Load Bear list. One entry per separate thing. Use only when they have asked for something to be done or remembered (or said yes to your offer of a reminder), never for small talk or questions.',
 strict:true,
 input_schema:{type:'object',additionalProperties:false,required:['tasks'],properties:{tasks:{type:'array',items:{type:'object',additionalProperties:false,required:['original','title','area'],properties:{
  original:{type:'string',description:'Their own words for this one thing, copied, including any date or time words they used (for a reminder you offered, the event and its date as you found it, e.g. "NZ v India ODI on 15 November 2026").'},
  title:{type:'string',description:'Action verb + the specific thing, under 12 words, only details they gave. No date in the title.'},
  area:{type:'string',enum:[...areaKeys],description:'What it is mainly for: work, family (children, school, partner, relatives), home (house, car, pets), money (bills, banking, insurance), health (anyone’s medical or dental care), me (own friends, hobbies, self-care).'},
 }}}}},
} as const;
const inputSchema=z.object({tasks:z.array(z.object({original:z.string().trim().min(2).max(500),title:z.string().trim().min(2).max(120),area:z.enum(areaKeys)}).strict()).min(1).max(15)}).strict();
const words=(s:string)=>new Set(s.toLowerCase().replace(/[^a-z0-9 ]+/g,' ').split(/\s+/).filter(w=>w.length>3));
// Run add_tasks. `said` is everything the person and Bear have said in this chat: a title may not name anyone who was never mentioned.
export async function runAddTasks(store:BearStore,raw:unknown,said:string,today:string,children:string[],now=new Date()):Promise<{items:SortedItem[];result:string}>{
 const p=inputSchema.safeParse(raw);if(!p.success)return {items:[],result:'Not added: the request did not have the right shape.'};
 const known=words(said);const items:SortedItem[]=[];
 for(const t of p.data.tasks){
  const base=sortOne(t.original,today,children);
  const names=(t.title.match(/\b[A-Z][a-z]{2,}\b/g)||[]).slice(1).map(n=>n.toLowerCase());
  const title=(names.every(n=>known.has(n))?t.title:base.title).replace(/[\s.]+$/,'').slice(0,90);
  const area=t.area as AreaKey;const light=lightFor({deadline:base.deadline,windowBy:base.windowBy,urgency:base.urgency,soonByNature:soonByNature(title)},today);
  items.push(await placeSorted(store,{...base,title,domain:area,secondary:[base.domain,...base.secondary].filter((d,i,a)=>d!==area&&a.indexOf(d)===i),suggestedStart:suggestStart(title,base.deadline,light.light,today),...light},'text',today,now));
 }
 const result=items.map(i=>i.error?`Could not add "${i.title}": ${i.error}`:`${i.already?'Already on the list':'Added'}: "${i.title}" (${i.domain}, ${i.when})`).join('\n');
 return {items,result:result+'\nThe app shows these to the person as cards, so do not list them again; reply in one short line.'};
}

// ---------- changing something already on the list ----------
export const changeTaskTool={
 name:'change_task',
 description:'Change one thing already added in this conversation, when the person corrects it ("actually the dentist is urgent", "that’s a work thing", "it’s due Friday"). Never use it to add something new.',
 strict:true,
 input_schema:{type:'object',additionalProperties:false,required:['task','priority','area','due'],properties:{
  task:{type:'string',description:'A few words from the title of the thing to change.'},
  priority:{anyOf:[{type:'string',enum:['urgent','coming up','can wait']},{type:'null'}]},
  area:{anyOf:[{type:'string',enum:[...areaKeys]},{type:'null'}]},
  due:{anyOf:[{type:'string'},{type:'null'}],description:'Their own words for the new date ("Friday", "20 December"), or null.'},
 }},
} as const;
const changeInput=z.object({task:z.string().trim().min(2).max(120),priority:z.enum(['urgent','coming up','can wait']).nullable(),area:z.enum(areaKeys).nullable(),due:z.string().trim().max(60).nullable()}).strict();
export async function runChangeTask(store:BearStore,raw:unknown,candidates:string[],today:string,now=new Date()):Promise<{item:SortedItem|null;result:string}>{
 const p=changeInput.safeParse(raw);if(!p.success)return {item:null,result:'Not changed: the request did not have the right shape.'};
 const open=(await Promise.all(candidates.map(id=>store.get('tasks',id)))).filter(t=>t&&t.status==='open');
 const want=[...words(p.data.task)];let best=null as (typeof open)[number];let score=0;
 for(const t of open){const have=words(t!.title);const s=want.filter(w=>[...have].some(h=>h.startsWith(w.slice(0,5))||w.startsWith(h.slice(0,5)))).length;if(s>score){score=s;best=t;}}
 if(!best)return {item:null,result:'Not changed: I could not tell which one they meant. Ask them which.'};
 const light=p.data.priority==='urgent'?'red':p.data.priority==='coming up'?'amber':p.data.priority==='can wait'?'green':undefined;
 let r=await changeSorted(store,{taskIds:[best.id],taskId:best.id,...(light?{light}:{}),...(p.data.area?{domain:p.data.area}:{})},now);
 if(p.data.due){const d=saidDate(p.data.due,today).date;if(d)r=await changeSorted(store,{taskIds:[best.id],text:`it is due ${p.data.due}`},now);}
 const item=r.changed;
 return {item,result:item?`Changed: "${item.title}" is now ${item.light==='red'?'urgent':item.light==='amber'?'coming up':'can wait'}, under ${item.domain}, ${item.when}. Reply in one short line.`:'Not changed.'};
}
