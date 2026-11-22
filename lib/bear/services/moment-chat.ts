// Got a Moment?: one conversation with Bear. A friendly chat, help thinking something through, or practical help with the
// person's responsibilities, all through the same box. There are no modes for the person to choose. Bear decides what
// fits from what she says, follows what she asks for over what it guesses, and asks before moving from talking to doing.
//
// This file is pure (no AI call, no route): the message types, Bear's instructions, the tools Bear may use (each mapped to
// an existing part of the responsibility engine), the answer Bear gives when the AI is not connected, the safety line, and
// how the private conversation is kept.
import {z} from 'zod';
import type {BearStore} from '../store/store.ts';
import type {StructuredModelProvider} from '../ai/provider.ts';
import {brainView,giveToBear,recommend} from '../rre/service.ts';

// ---------- messages ----------
// An action's life: proposed -> preparing -> ready_for_review -> approved -> executing -> verified_success, or failed or
// cancelled. Nothing here sends, books, buys or shares: a draft is ready_for_review until the person sends it herself.
export type ActionState='proposed'|'preparing'|'ready_for_review'|'approved'|'executing'|'verified_success'|'failed'|'cancelled';
export type ActionKind='suggestion'|'responsibility'|'prepared'|'draft'|'added'|'proposed_tasks';
export interface ProposedTask{title:string;area:import('../domain/types.ts').AreaKey;original:string}
export interface MomentAction{id:string;kind:ActionKind;state:ActionState;taskId:string|null;title:string;detail:string|null;
 label?:string|null;minutes?:number|null;lines?:string[];draft?:{channel:'email'|'sms';to:string|null;subject:string;body:string}|null;items?:string[];proposal?:ProposedTask[]}
export interface MomentMessage{id:string;role:'user'|'bear';at:string;text:string;actions?:MomentAction[]}
export const KEEP_MESSAGES=80;          // the kept conversation (oldest go first)
export const CONTEXT_MESSAGES=16;       // what Bear reads back each turn: bounded, and only from the current sitting
export const SITTING_GAP_MS=12*3600000; // after this long, opening the screen shows a fresh welcome (nothing is deleted)
export const DAILY_MOMENT_CHAT=150;

// ---------- safety ----------
const DANGER=/\b(kill (?:my|him|her)self|suicid\w*|end (?:it all|my life)|want to die|don'?t want to (?:be here|live)|hurt(?:ing)? myself|self[- ]harm|overdose|(?:he|she|they)(?:'s| is| are)? (?:going to )?(?:hit|hurt|kill)(?:ting)? (?:me|us|the kids))\b/i;
export const SAFETY_LINE='If you’re in danger or thinking about hurting yourself, please call 000 now, or Lifeline on 13 11 14 (any time, day or night). You don’t have to carry this on your own.';
export const needsSafety=(text:string)=>DANGER.test(text);
export function withSafety(reply:string,said:string):string{return needsSafety(said)&&!reply.includes('13 11 14')?`${reply.trim()}\n\n${SAFETY_LINE}`.trim():reply;}

// ---------- Bear's instructions ----------
export interface MomentContext{today:string;weekday:string;name:string;children:string[]}
export const momentSystemPrompt=(c:MomentContext)=>`You are Bear (Mama Bear) in Load Bear, an app that helps busy parents in Australia carry less. This is "Got a moment?": the person opens it whenever she likes and says whatever is on her mind. Australian English. Plain, warm, capable, like texting a kind friend who is good at getting things done.
Today is ${c.weekday} ${c.today}.${c.name?` Her name is ${c.name}.`:''}${c.children.length?` Her children: ${c.children.join(', ')}.`:''}

How to talk:
- Listen before offering solutions. Usually one or two short sentences. No lists, headings or emoji unless she asks. Small talk and quiet chat are fine.
- Notice whether she is venting, overwhelmed, reflecting, weighing a decision, wanting advice, wanting company or wanting help with something, and answer that, without naming it or asking her to choose.
- Do not validate on repeat, do not interrogate, do not over-cheer, and do not end every message with a question.
- You are not a therapist. Never diagnose, never say you know how she feels, never claim to replace people in her life. If something sounds heavy, acknowledge it simply and leave room.
- If she wants to vent, rest or unwind, stay with that. Do not suggest tasks, plans or productivity.
- Once she turns to how she is feeling, leave the tasks behind completely: no lists, no cards, no tools, no recap of what was planned, no "when you're ready we can…". Do not bring tasks back until she does.
- Follow what she asks for over what you guess. If it is unclear what would help, you may offer, in one sentence, to talk it through, help with something, or just unwind; then go with her answer.
- Ask before moving from talking to doing ("Would it help if I drafted that message?", "Want me to remember that?"). Use a tool only when she has asked for practical help or said yes to your offer. Never turn distress into a task on your own.
- Never guess at anyone else's motives (a partner, a teacher) from an unfinished task. Talk about the task, not the person.
- If she mentions danger, or thoughts of harming herself or someone else, respond with care and give: 000 for emergencies, Lifeline 13 11 14 (24/7). Nothing else in that message.

What you can do (only through the tools; never claim anything else happened):
- find_responsibilities: look at what she has given Bear (her tasks), by topic or the most pressing.
- suggest_for_time: when she says how much time she has, find one useful thing that fits.
- prepare_help: do Bear's part of a task's next step (a shopping list, a draft, steps, a shortlist). This only prepares; nothing is sent, booked or bought.
- draft_message: write a message for her to review (to a school, a partner, a business). Bear cannot send email or texts: she sends it herself. A message to her partner contains only the practical request, never anything private she has told you.
- propose_tasks: when she wants things written down or a to-do list made, propose the list. Nothing is saved until she approves it in the app (she can untick items). Never say a list is saved until a note shows she approved it.
The app shows what a tool returns as a card under your message, so do not repeat its details. Say in one short line what you did. Never say something was sent, booked, paid, shared or arranged unless a tool result says it was confirmed.
A note in square brackets after one of your earlier messages records what the app really showed under it; trust it and never write such notes yourself.`;

// ---------- tools (the adapter onto the responsibility engine) ----------
const t=(name:string,description:string,properties:Record<string,unknown>,required:string[])=>({name,description,strict:true,input_schema:{type:'object',additionalProperties:false,required,properties}});
export const momentTools=[
 t('find_responsibilities','Look up what she has given Bear. Pass a few words for a topic ("school excursion", "dentist"), or null for what needs attention most.',{query:{anyOf:[{type:'string'},{type:'null'}]}},['query']),
 t('suggest_for_time','Find one useful thing that fits the time she says she has.',{minutes:{type:'integer',description:'Minutes she has: 5, 10, 20, or 60 for "some time".'}},['minutes']),
 t('prepare_help','Do Bear’s part of the next step of one task she has agreed you should help with. Use a task_id from find_responsibilities or suggest_for_time.',{task_id:{type:'string'}},['task_id']),
 t('draft_message','Write a message for her to review and send herself.',{task_id:{anyOf:[{type:'string'},{type:'null'}]},channel:{type:'string',enum:['email','sms']},to:{anyOf:[{type:'string'},{type:'null'}],description:'Who it is to, as she named them, or null.'},subject:{type:'string',description:'Short subject (email), or empty for a text.'},body:{type:'string',description:'The message, in her voice, plain and polite.'}},['task_id','channel','to','subject','body']),
 t('propose_tasks','Propose a to-do list for her to approve. One entry per separate thing, in her words. Nothing is saved until she approves it.',{tasks:{type:'array',items:{type:'object',additionalProperties:false,required:['title','area','original'],properties:{title:{type:'string',description:'Action verb + the specific thing, under 10 words, her words, no date.'},area:{type:'string',enum:['work','family','home','money','health','me']},original:{type:'string',description:'Her own words for it, including any date or time words.'}}}}},['tasks']),
];
const uuid=z.string().uuid();
const proposeInput=z.object({tasks:z.array(z.object({title:z.string().trim().min(2).max(120),area:z.enum(['work','family','home','money','health','me']),original:z.string().trim().min(2).max(500)}).strict()).min(1).max(15)}).strict();
// A to-do list Bear proposes waits for her approval; nothing is saved here.
export function proposeTasks(raw:unknown):ToolOutcome{
 const p=proposeInput.safeParse(raw);if(!p.success)return {result:'Not proposed: the request did not have the right shape.',actions:[]};
 return {result:'The list is shown to her to approve. Nothing is saved until she approves it. Say in one short line that it is there for her to check.',
  actions:[{id:actionId('t'),kind:'proposed_tasks',state:'ready_for_review',taskId:null,title:p.data.tasks.length===1?p.data.tasks[0].title:`${p.data.tasks.length} things to save`,detail:null,items:p.data.tasks.map(x=>x.title),proposal:p.data.tasks}]};
}
// Talking about how she feels, with nothing practical asked: Bear answers without tools, so no list or card comes back.
const FEELING=/\b(feel|feeling|felt|overwhelm\w*|sad|anxious|anxiety|stress\w*|cry\w*|tears|lonely|alone|upset|exhausted|burnt? out|hurt|angry|frustrated|scared|worried|guilty|hopeless|not okay|not ok|struggling|depress\w*|grief|miss (?:him|her|them)|resent\w*|unappreciated|invisible)\b/i;
const ASKING=/\b(can you|could you|would you|please|help me (?:with|to|get|sort|write|draft|plan)|remind|add|save|list|draft|write|book|order|what(?:'s| is) next|what should i do|show me|find|look (?:at|up)|minutes?|time to)\b/i;
export const feelingsOnly=(text:string)=>FEELING.test(text)&&!ASKING.test(text);
const draftInput=z.object({task_id:uuid.nullable(),channel:z.enum(['email','sms']),to:z.string().trim().max(120).nullable(),subject:z.string().trim().max(200),body:z.string().trim().min(2).max(3000)}).strict();
let seq=0;const actionId=(k:string)=>`${k}-${Date.now().toString(36)}-${(seq++).toString(36)}`;
const words=(s:string)=>s.toLowerCase().replace(/[^a-z0-9 ]+/g,' ').split(/\s+/).filter(w=>w.length>2);

export interface ToolOutcome{result:string;actions:MomentAction[]}
// getRelevantResponsibilities: her open tasks, matched by topic or the most pressing first. Read only.
export async function findResponsibilities(store:BearStore,query:string|null,now=new Date()):Promise<ToolOutcome>{
 const b=await brainView(store,now);const all=b.categories.flatMap(c=>c.items);
 let picked=all;
 if(query&&query.trim()){const want=words(query);picked=all.map(i=>({i,s:want.filter(w=>i.title.toLowerCase().includes(w.slice(0,Math.max(4,w.length-1)))).length})).filter(x=>x.s>0).sort((a,b)=>b.s-a.s).map(x=>x.i);}
 else picked=[...b.priority,...all.filter(i=>!b.priority.some(p=>p.id===i.id))];
 picked=picked.slice(0,5);
 if(!picked.length)return {result:query?`Nothing on her list matches "${query}".`:'Her list is empty.',actions:[]};
 return {result:picked.map(i=>`task_id ${i.id}: "${i.title}" (${i.statusLabel}${i.reason?`; ${i.reason}`:''}${i.when?`; date ${i.when}`:''})`).join('\n')+'\nThe app shows these as cards.',
  actions:picked.map(i=>({id:actionId('r'),kind:'responsibility' as const,state:'proposed' as const,taskId:i.id,title:i.title,detail:[i.statusLabel,i.reason].filter(Boolean).join(' · ')||null}))};
}
// The time-based suggestion (what the old time buttons did), through the same engine.
export async function suggestForTime(store:BearStore,minutes:number,now=new Date()):Promise<ToolOutcome>{
 const m=Math.max(1,Math.min(240,Math.round(minutes)||10));const r=await recommend(store,{minutes:m,exclude:[]},now);
 if(!r.recommendation)return {result:r.message||'Nothing fits that time.',actions:[]};
 const x=r.recommendation;
 return {result:`Suggested task_id ${x.taskId}: "${x.title}" (${x.label}, about ${x.minutes} min). ${x.why}`,actions:[{id:actionId('s'),kind:'suggestion',state:'proposed',taskId:x.taskId,title:x.title,detail:x.why,label:x.label,minutes:x.minutes}]};
}
// prepareAction: Bear's part of the step, via Give it to Bear. Preparing only; the result waits for her review.
export async function prepareHelp(store:BearStore,provider:StructuredModelProvider|null,taskId:unknown,now=new Date()):Promise<ToolOutcome>{
 const id=uuid.safeParse(taskId);if(!id.success)return {result:'Not prepared: that is not one of her tasks. Use find_responsibilities first.',actions:[]};
 let d;try{d=await giveToBear(store,provider,id.data,now);}catch{return {result:'Not prepared: that task is not open on her list.',actions:[]};}
 const p=d.prepared;
 if(!p)return {result:`Nothing for Bear to prepare on "${d.title}" right now. Her next step: ${d.next?.text||'none'}.`,actions:[{id:actionId('r'),kind:'responsibility',state:'proposed',taskId:d.id,title:d.title,detail:d.next?.text||d.statusLabel}]};
 return {result:`Prepared for "${d.title}": ${p.title}. Ready for her to check (nothing sent or bought).`,actions:[{id:actionId('p'),kind:'prepared',state:'ready_for_review',taskId:d.id,title:d.title,detail:p.title,lines:p.lines.slice(0,8),draft:p.draft?{channel:'email',to:p.draft.to||null,subject:p.draft.subject,body:p.draft.body}:null}]};
}
// A draft for her to review and send herself. Bear has no way to send email or texts, so it never says it did.
export async function draftMessage(store:BearStore,raw:unknown):Promise<ToolOutcome>{
 const p=draftInput.safeParse(raw);if(!p.success)return {result:'Not drafted: the request did not have the right shape.',actions:[]};
 const task=p.data.task_id?await store.get('tasks',p.data.task_id):null;
 return {result:'Draft ready for her to check. Bear cannot send it: she sends it herself.',actions:[{id:actionId('d'),kind:'draft',state:'ready_for_review',taskId:task?.id||null,title:task?.title||(p.data.channel==='email'?'Email draft':'Message draft'),detail:null,draft:{channel:p.data.channel,to:p.data.to,subject:p.data.subject,body:p.data.body}}]};
}

// ---------- without the AI ----------
// The engine still works without the AI: a time she mentions finds one thing that fits; otherwise Bear says plainly that it
// can't chat properly just now.
export function minutesIn(text:string):number|null{
 const s=text.toLowerCase();
 const m=/(\d{1,3})\s*(?:-|to)?\s*(?:\d{1,3}\s*)?(?:min|mins|minutes)\b/.exec(s);if(m)return Number(m[1]);
 if(/\bhalf an hour\b/.test(s))return 30;if(/\b(an|one) hour\b|\bsome time\b|\ba while\b/.test(s))return 60;if(/\ba (few|couple of) min/.test(s))return 5;
 return null;
}
export async function offlineReply(store:BearStore,text:string,now=new Date()):Promise<{text:string;actions:MomentAction[]}>{
 if(needsSafety(text))return {text:SAFETY_LINE,actions:[]};
 const m=minutesIn(text);
 if(m){const o=await suggestForTime(store,m,now);return {text:o.actions.length?'Here’s one thing that fits.':o.result,actions:o.actions};}
 return {text:'I’m here. My thinking service isn’t connected right now, so I can’t chat properly. If you tell me how long you’ve got, I can still find one useful thing that fits.',actions:[]};
}

// ---------- the private conversation ----------
// Kept on her own profile (never on anything shared with her household), newest last, at most KEEP_MESSAGES.
export async function loadConversation(store:BearStore):Promise<MomentMessage[]>{
 const p=(await store.list('profiles'))[0];return (p?.momentChat?.messages||[]) as MomentMessage[];
}
export async function saveConversation(store:BearStore,messages:MomentMessage[]):Promise<void>{
 const p=(await store.list('profiles'))[0];if(!p)return;
 await store.update('profiles',p.id,{momentChat:{messages:messages.slice(-KEEP_MESSAGES),updatedAt:new Date().toISOString()}});
}
// The turns Bear reads back: the current sitting only (a long gap starts a new one), at most CONTEXT_MESSAGES.
// What a card under one of Bear's messages was, in a line, so Bear remembers what it really did (and never doubts it).
export function describeAction(a:MomentAction):string{
 const id=a.taskId?` (task_id ${a.taskId})`:'';
 if(a.kind==='draft')return `a ${a.draft?.channel==='sms'?'text':'email'} draft${a.draft?.to?` to ${a.draft.to}`:''} for her to check and send herself (not sent)`;
 if(a.kind==='suggestion')return `a suggestion: "${a.title}"${id}`;
 if(a.kind==='prepared')return `prepared "${a.detail||a.title}" for "${a.title}"${id}, ready for her to check`;
 if(a.kind==='proposed_tasks')return a.state==='verified_success'?`a to-do list she approved and saved: ${(a.items||[]).map(x=>`"${x}"`).join(', ')}`:a.state==='cancelled'?'a to-do list she chose not to save':`a to-do list waiting for her approval (not saved): ${(a.items||[]).map(x=>`"${x}"`).join(', ')}`;
 if(a.kind==='added')return `saved to Bear Brain: ${(a.items||[a.title]).map(x=>`"${x}"`).join(', ')}`;
 return `her task "${a.title}"${id}`;
}
export function contextTurns(messages:MomentMessage[]):{role:'user'|'assistant';content:string}[]{
 let start=0;for(let i=1;i<messages.length;i++)if(Date.parse(messages[i].at)-Date.parse(messages[i-1].at)>SITTING_GAP_MS)start=i;
 const turns=messages.slice(start).slice(-CONTEXT_MESSAGES).map(m=>({role:m.role==='user'?'user' as const:'assistant' as const,
  content:((m.text||'').slice(0,2000)+(m.role==='bear'&&m.actions?.length?`\n\n[Shown under this message: ${m.actions.map(describeAction).join('; ')}.]`:''))}));
 while(turns.length&&turns[0].role!=='user')turns.shift();
 return turns.filter(x=>x.content.trim());
}
export const sendSchema=z.object({id:z.string().regex(/^[a-z0-9-]{8,64}$/),text:z.string().trim().min(1).max(4000)}).strict();
