import type {AreaKey,Completion,Task} from '../domain/types.ts';
import type {PatternId} from '../load/types.ts';
import type {Reason} from './types.ts';

// The Relational Priority Engine. A task exists within relationships across people and time: other
// people, past self, present self, future self, and reality (deadlines and gates stay in the engine).
// Power, loss exposure ("threat") and meaning are a hidden interpretive layer. Everything here is
// internal: people only ever see a few plain-language reasons, and only when they ask.
//
// Guardrails (tested):
//  - pressure is not importance: someone chasing raises relationalPressure, never importance;
//  - power is context, not privilege: seniority alone adds nothing; power changes responsibility
//    (someone depends on you), opportunity, or contribution;
//  - past behaviour predicts friction, timing and support, never what matters;
//  - future advancement doesn't automatically outrank meaningful present life;
//  - low-confidence inference moves things only a little.
export type RelationType='supervision'|'collaboration'|'mentoring'|'family'|'child'|'household'|'colleague'|'community'|'unknown';
export interface OtherPerson{name:string|null;relationshipType:RelationType;waiting:boolean;blocked:boolean;commitment:boolean;dependency:number;relationalImportance:number;relationalPressure:number;confidence:number}
export interface PTMInterpretation{
 power:{responsibility:number;agency:number;opportunity:number;influence:number};
 lossExposure:{financial:number;relational:number;reputational:number;opportunity:number;developmental:number;autonomy:number;symbolic:number;psychological:number};
 meaning:{identity:number;contribution:number;connection:number;mastery:number;purpose:number;enjoyment:number;care:number;community:number;presence:number};
 confidence:number;
}
export interface PastSelfEvidence{samples:number;deferralRisk:number;actEarlierDays:number;breakDown:boolean;easy:boolean}
export interface PresentSelfState{recentLoad:number;recentAccomplishment:number;suggestionSaturation:number;saturated:boolean;areaShare:Partial<Record<AreaKey,number>>;heavyArea:AreaKey|null}
export interface FutureSelf{futureOptionValue:number;futureLoadReduction:number}
export type Reliance='yes'|'little'|'no';
export interface RelationalContext{itemId:string;otherPeople:OtherPerson[];pastSelf:PastSelfEvidence;futureSelf:FutureSelf;ptm:PTMInterpretation|null}
// What the Priority Engine takes from all of this: small, bounded nudges and the words to explain them.
export interface RelationalAdjustment{lift:number;leverage:number;actEarlierDays:number;breakDown:boolean;waiting:boolean;status:'closing_loop'|null;reasons:Reason[];ask:'reliance'|null;confidence:number}

const clamp=(n:number,lo=0,hi=1)=>Math.max(lo,Math.min(hi,n));
const R={
 supervision:/\b(students?|phd|hdr|candidat\w*|thesis|supervis\w*|confirmation of candidature|coc|milestone|honours)\b|\b\w+['’]s (chapter|thesis|proposal|milestone)\b/i,
 collaboration:/\b(collaborat\w*|co-?authors?|industry partners?|partner organisation|arc|linkage|joint (paper|grant|project)|invitation to (join|collaborate|contribute))\b/i,
 mentoring:/\b(junior|early[- ]career|ecr|mentee|mentor\w*|reference letter|letter of (reference|recommendation))\b|\breview \w+['’]s (paper|draft|manuscript|cv|application|article)\b/i,
 child:/\b(son|daughter|kids?|child(ren)?|year \d|kindy|preschool|reading|homework|tutor\w*|speech (therapy|pathologist)|ot assessment|school (report|assessment))\b/i,
 family:/\b(mum|mom|dad|nan|nana|grandma|grandpa|granny|sister|brother|aunt|uncle|cousin|in-?laws?|family)\b/i,
 household:/\b(my )?(partner|husband|wife)\b/i,
 householdTask:/\b(bins?|groceries|dinner|laundry|washing|pick ?up|drop ?off|school run|dishes|cleaning)\b/i,
 colleague:/\b(colleagues?|team|manager|boss|meeting|committee|hr|head of|faculty|department|admin)\b/i,
 community:/\b(community|volunteer\w*|p&c|school council|charity|club|fundrais\w*|working bee|church|mosque|temple|neighbours?)\b/i,
 waiting:/\b(waiting (on|for) (me|my)|is waiting|are waiting|needs? my|before (she|he|they) can|so (she|he|they) can|blocked|can['’]t (start|continue|proceed)|holding (them|her|him) up|depends on me|for (her|his|their) (analysis|draft|application))\b/i,
 send:/\b(send|share|return|give|forward|get back to|reply to|respond to|feedback (to|for|on))\b/i,
 commitment:/\b(promised|i said i['’]?d|i['’]ll|agreed to|committed|told (him|her|them) i|owe)\b/i,
 pressure:/\b(asap|urgent(ly)?|chasing|chased|following up|keeps asking|nagging|insist\w*|by eod|meeting request|can we meet|catch[- ]up request|again)\b/i,
 option:/\b(collaborat\w*|grant|partnership|partners?|qualification|certificat\w*|course|submit|submission|apply|application|invitation|network\w*|introduc\w*|opportunit\w*)\b/i,
 preventive:/\b(dentist|check-?up|screening|vaccin\w*|mammogram|skin check|pap|physio|service the car|smoke alarm)\b/i,
 symbolic:/\b(birthday|anniversary|memorial|wedding|funeral|graduation|farewell)\b/i,
 presence:/\b(time with|dinner with|call (mum|mom|dad|nan|grandma)|date night|play with|walk with|catch up with|visit)\b/i,
 enjoy:/\b(party|hobby|fun|holiday|concert|game|garden(ing)?|paint\w*|music|read for fun)\b/i,
 mastery:/\b(learn\w*|practi[cs]e|write|writing|draft|skill|study)\b/i,
 money:/\b(fee|fine|late fee|penalty|refund|rebate|discount|claim|reimburs\w*|invoice)\b/i,
};
const NOT_NAMES=new Set(['I','A','The','My','Our','Your','To','For','With','And','Or','On','In','At','By','Re','Fw','Fwd','Send','Email','Reply','Respond','Review','Call','Ring','Book','Draft','Write','Fix','Format','Check','Get','Buy','Pay','Renew','Return','Give','Share','Ask','Tell','Remind','Organise','Organize','Sort','Plan','Finish','Start','Submit','Read','Comment','Follow','Confirm','Arrange','Pick','Drop','Order','Make','Update','Prepare','Professor','Prof','Dr','Associate','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday','January','February','March','April','May','June','July','August','September','October','November','December','Year','ARC','PhD','HDR','CoC','RSVP','Bear','Need','Can','Do','Discussion','Methods','Results','Introduction','Abstract','Chapter','Finding','Section','School','Industry','Linkage','Grant','Paper','Manuscript']);
// A person's name, if one is mentioned: after "Prof/Dr", a possessive ("Maya's"), or after to/with/for.
export function personName(text:string):string|null{
 const t=/\b(?:Professor|Prof\.?|Dr\.?)\s+([A-Z][a-z]+)/.exec(text);if(t)return (text.match(/\b(Professor|Prof\.?|Dr\.?)/)![1].replace('.','')==='Dr'?'Dr ':'Professor ')+t[1];
 const p=/\b([A-Z][a-z]+)['’]s\b/.exec(text);if(p&&!NOT_NAMES.has(p[1]))return p[1];
 const w=/\b(?:to|with|for|from|on)\s+([A-Z][a-z]+)\b/.exec(text);if(w&&!NOT_NAMES.has(w[1]))return w[1];
 return null;
}

// ---------- other people ----------
export function otherPeople(text:string,pattern:PatternId,reliance:Reliance|null=null):OtherPerson[]{
 const name=personName(text);
 const type:RelationType=R.supervision.test(text)?'supervision':R.mentoring.test(text)?'mentoring':R.collaboration.test(text)?'collaboration':R.child.test(text)?'child':R.family.test(text)?'family':R.household.test(text)&&R.householdTask.test(text)?'household':R.community.test(text)?'community':R.colleague.test(text)?'colleague':'unknown';
 // WAITING_FOR_RESPONSE means the person is waiting on someone else, not the other way round.
 const someoneWaiting=pattern!=='WAITING_FOR_RESPONSE'&&(R.waiting.test(text)||(!!name&&R.send.test(text)&&/\b(analysis|draft|data|feedback|comments?|files?|results|chapter|review|form|signature|details)\b/i.test(text)));
 const implied=type==='supervision'||type==='mentoring';
 if(type==='unknown'&&!name&&!someoneWaiting&&!reliance)return [];
 const commitment=R.commitment.test(text);const pressure=R.pressure.test(text)?0.8:someoneWaiting?0.4:0.15;
 const base:Record<RelationType,number>={family:0.8,child:0.85,supervision:0.75,collaboration:0.65,mentoring:0.6,household:0.6,community:0.5,colleague:0.35,unknown:0.4};
 let waiting=someoneWaiting||implied;let dependency=someoneWaiting?0.8:implied?0.6:type==='household'?0.6:0.1;
 let confidence=(type!=='unknown'?0.4:0.15)+(name?0.2:0)+(someoneWaiting?0.25:0);
 let importance=base[type]+(waiting?0.08:0)+(commitment?0.08:0);
 // The person's own answer beats Bear's guess.
 if(reliance==='yes'){waiting=true;dependency=Math.max(dependency,0.8);confidence=1;}
 if(reliance==='little'){waiting=true;dependency=0.4;confidence=1;}
 if(reliance==='no'){waiting=false;dependency=0;importance=Math.min(importance,0.35);confidence=1;}
 return [{name,relationshipType:type,waiting,blocked:/\bblocked|can['’]t (start|continue|proceed)\b/i.test(text)||reliance==='yes',commitment,dependency,relationalImportance:clamp(importance),relationalPressure:pressure,confidence:clamp(confidence)}];
}

// ---------- power / loss exposure / meaning (hidden) ----------
export function interpret(text:string,pattern:PatternId,people:OtherPerson[],flags:string[]):PTMInterpretation{
 const p=people[0];const t=p?.relationshipType;const z=(n:number)=>clamp(n);
 const power={
  // Power as responsibility: someone with less power depends on you.
  responsibility:z(t==='supervision'?0.8:t==='mentoring'?0.6:t==='child'?0.75:t==='household'?0.4:p?.waiting?0.35:0),
  agency:z(/\b(qualification|certificat\w*|course|skill|learn\w*)\b/i.test(text)?0.6:/\b(grant|submit)\b/i.test(text)?0.4:0),
  // Power as opportunity: the relationship opens doors. Not "they are senior".
  opportunity:z(t==='collaboration'?0.65:R.option.test(text)?0.35:0),
  influence:z(t==='community'?0.3:0),
 };
 const lossExposure={
  financial:z(['BILL_PAYMENT','RENEWAL'].includes(pattern)||R.money.test(text)||flags.includes('payment')?0.6:0),
  relational:z(t==='family'||t==='child'?0.5:p?.waiting&&p.commitment?0.5:p?.waiting?0.3:0),
  reputational:z(p?.commitment&&(t==='colleague'||t==='collaboration'||t==='supervision')?0.4:0),
  opportunity:z(t==='collaboration'||/\b(grant|partnership|invitation|application|opportunit\w*)\b/i.test(text)?0.6:0),
  developmental:z(t==='supervision'?0.6:t==='child'?0.6:t==='mentoring'?0.4:0),
  autonomy:z(flags.includes('overdue')?0.3:0),
  symbolic:z(R.symbolic.test(text)?0.6:0),
  psychological:z(pattern==='REPAIR_PROBLEM'?0.3:0),
 };
 const meaning={
  identity:z(R.symbolic.test(text)?0.4:0),
  contribution:z(t==='mentoring'||t==='supervision'?0.6:t==='community'?0.6:0),
  connection:z(t==='family'||t==='child'?0.7:R.presence.test(text)?0.7:t==='collaboration'?0.3:0),
  mastery:z(R.mastery.test(text)?0.4:0),
  purpose:z(/\b(research|manuscript|paper|grant|book|thesis|business)\b/i.test(text)?0.5:0),
  enjoyment:z(R.enjoy.test(text)?0.5:0),
  care:z(t==='child'||t==='family'?0.7:t==='household'?0.4:0),
  community:z(t==='community'?0.6:0),
  presence:z(R.presence.test(text)?0.7:0),
 };
 return {power,lossExposure,meaning,confidence:clamp(0.3+(p?p.confidence*0.5:0)+(R.symbolic.test(text)||R.presence.test(text)?0.2:0))};
}
export function futureSelf(text:string):FutureSelf{
 return {futureOptionValue:R.collaboration.test(text)||/\b(grant|partnership)\b/i.test(text)?0.7:/\b(qualification|certificat\w*|course|submit\w*)\b/i.test(text)||R.preventive.test(text)?0.55:R.child.test(text)&&/\b(tutor|speech|assessment|reading|ot)\b/i.test(text)?0.6:0,futureLoadReduction:R.preventive.test(text)?0.5:0};
}

// ---------- past self (PersonalEvidenceModel) ----------
// Predicts friction, timing and the help that works. Never importance.
export function pastSelfEvidence(pattern:PatternId,kind:string,history:Task[],completions:Completion[],exceptId?:string):PastSelfEvidence{
 const similar=history.filter(t=>t.id!==exceptId&&(t.load?.nodes[0]?.pattern||'UNKNOWN_LOAD')===pattern&&(pattern!=='UNKNOWN_LOAD'||t.kind===kind));
 const done=similar.filter(t=>t.status==='done');const byTask=new Map(completions.map(c=>[c.taskId,c]));
 const late=done.filter(t=>{const c=byTask.get(t.id);return c&&c.daysBeforeDue!==null&&c.daysBeforeDue<0;}).length;
 const early=done.filter(t=>{const c=byTask.get(t.id);return c&&c.daysBeforeDue!==null&&c.daysBeforeDue>=2;}).length;
 const postpones=similar.reduce((n,t)=>n+(t.postpones||0),0);const deferralRisk=similar.length?clamp(postpones/(similar.length*3)):0;
 const splitHelped=done.some(t=>t.size==='bigger')&&deferralRisk>=0.3;
 return {samples:similar.length,deferralRisk,actEarlierDays:done.length>=2&&late/done.length>=0.4?2:0,breakDown:splitHelped,easy:done.length>=3&&early/done.length>=0.6&&deferralRisk<0.15};
}

// ---------- present self ----------
// Not a clinical measure: how much Bear should avoid asking for right now.
export function presentSelf(o:{tasks:Task[];completions:Completion[];areaOf:(t:Task)=>AreaKey;today:string;actedToday:number;dayOf?:(iso:string)=>string}):PresentSelfState{
 const dayOf=o.dayOf||((iso:string)=>iso.slice(0,10));
 const byId=new Map(o.tasks.map(t=>[t.id,t]));
 const todays=o.completions.filter(c=>dayOf(c.completedAt)===o.today).map(c=>byId.get(c.taskId)).filter((t):t is Task=>!!t&&!t.isDemo);
 const demanding=todays.filter(t=>t.cognitiveEffort==='high'||t.estimatedMinutes>=20||['FORM_APPLICATION','RENEWAL','REPAIR_PROBLEM'].includes(t.load?.nodes[0]?.pattern||'')).length;
 const recentLoad=clamp((todays.length+2*demanding)/8);
 const suggestionSaturation=clamp((o.actedToday+todays.length)/6);
 // Balance is about sustained patterns (four weeks), never a single day.
 const month=o.completions.filter(c=>dayOf(c.completedAt)>=shift(o.today,-28)).map(c=>byId.get(c.taskId)).filter((t):t is Task=>!!t&&!t.isDemo);
 const share:Partial<Record<AreaKey,number>>={};for(const t of month){const a=o.areaOf(t);share[a]=(share[a]||0)+1/month.length;}
 const heavy=month.length>=8?(Object.entries(share).find(([,v])=>v>=0.75)?.[0] as AreaKey|undefined)||null:null;
 return {recentLoad,recentAccomplishment:clamp(todays.length/4),suggestionSaturation,saturated:suggestionSaturation>=0.8||recentLoad>=0.75,areaShare:share,heavyArea:heavy};
}
const shift=(iso:string,d:number)=>{const x=new Date(iso+'T12:00:00Z');x.setUTCDate(x.getUTCDate()+d);return x.toISOString().slice(0,10);};

// ---------- the adjustment ----------
export function relationalAdjust(c:RelationalContext,o:{ptm:boolean;explicitImportance:boolean;importanceBand:number;reliance:Reliance|null}):RelationalAdjustment{
 const p=c.otherPeople[0];const m=c.ptm;const conf=p?p.confidence:m?m.confidence*0.6:0.3;
 // Only relational IMPORTANCE lifts (never pressure); loss, meaning and future options add a little.
 let lift=p?0.14*(p.relationalImportance-0.4)+(p.waiting?0.08*p.dependency:0):0;
 if(o.ptm&&m){const loss=Math.max(...Object.values(m.lossExposure));const meaning=Math.max(...Object.values(m.meaning));lift+=0.06*loss+0.05*meaning+0.04*Math.max(m.power.responsibility,m.power.opportunity);}
 lift+=0.05*c.futureSelf.futureOptionValue;
 // Low-confidence inference moves things only a little.
 lift=clamp(lift*(0.4+0.6*conf),-0.04,0.16);if(o.explicitImportance)lift=0;
 const reasons=explainRelational(c,o.ptm);
 const ask=!o.reliance&&p&&p.confidence<0.5&&!p.waiting&&o.importanceBand>=0.35&&o.importanceBand<=0.65?'reliance':null;
 return {lift,leverage:p?.waiting?p.dependency:0,actEarlierDays:c.pastSelf.actEarlierDays,breakDown:c.pastSelf.breakDown,waiting:!!p?.waiting,status:p?.waiting&&(p.dependency>=0.6||p.commitment)?'closing_loop':null,reasons,ask,confidence:conf};
}
// Plain language only. No scores, no "power", no "threat", no "neglect".
function explainRelational(c:RelationalContext,ptm:boolean):Reason[]{
 const p=c.otherPeople[0];const m=c.ptm;const out:Reason[]=[];const who=p?.name;
 if(p?.waiting){
  if(p.relationshipType==='supervision')out.push({key:'person',title:`${who||'Your student'} is waiting on your feedback`,text:`Your review lets ${who||'them'} continue.`});
  else if(p.relationshipType==='mentoring')out.push({key:'person',title:`Your input could help ${who||'them'} move this forward`,text:'A small contribution from you could make a meaningful difference to their work.'});
  else out.push({key:'person',title:`${who||'Someone'} is waiting on this`,text:`${who||'They'} can’t continue until you do your part.`});
 }
 if(p?.relationshipType==='supervision')out.push({key:'responsibility',title:'This matters to your role',text:'You’re in a position to help them make progress.'});
 if(p?.relationshipType==='collaboration')out.push({key:'relationship',title:'A useful relationship to keep moving',text:'It connects with something important and could create future opportunities.'});
 if(p?.relationshipType==='household')out.push({key:'relationship',title:'Keeps the load shared',text:'If this waits, it usually lands on someone else at home.'});
 if(ptm&&m){
  if(m.lossExposure.developmental>=0.6&&p?.relationshipType==='child')out.push({key:'meaning',title:'Helps them grow',text:`This supports ${who?who+'’s':'your child’s'} development.`});
  if((p?.relationshipType==='family'||m.meaning.presence>=0.7)&&!out.some(r=>r.key==='meaning'))out.push({key:'meaning',title:'Matters to the people you care about',text:'Small things like this keep you connected.'});
  if(m.lossExposure.symbolic>=0.6&&!out.some(r=>r.key==='meaning'))out.push({key:'meaning',title:'It means something',text:'Some moments only come around once.'});
  if(m.meaning.community>=0.6)out.push({key:'meaning',title:'Good for your community',text:'It helps the people and groups you want to support.'});
  if(m.meaning.enjoyment>=0.5&&!out.length)out.push({key:'meaning',title:'Good for you now',text:'Not everything has to move a goal forward.'});
 }
 if(c.futureSelf.futureOptionValue>=0.55&&!out.some(r=>r.key==='relationship'))out.push({key:'future',title:'Opens doors later',text:'This could create useful options down the track.'});
 if(c.pastSelf.actEarlierDays>0)out.push({key:'timing',title:'Worth getting ahead of',text:'Things like this usually need a bit more back-and-forth than they first appear to.'});
 if(c.pastSelf.breakDown)out.push({key:'timing',title:'Smaller steps help',text:'Similar things went better in small pieces, so Bear starts small.'});
 return out;
}
