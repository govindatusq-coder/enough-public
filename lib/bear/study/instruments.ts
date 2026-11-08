// Study instruments. Only measures whose wording can be used freely are built in:
//  - NASA-TLX (Hart & Staveland, 1988; NASA, public domain), raw TLX, worded for household admin.
//    Adapting the context wording is common practice, but the adapted version is not separately validated.
//  - System Usability Scale (Brooke, 1996), free to use with attribution.
//  - Purpose-built items (admin minutes, mental-load rating, notification burden, trust, carrying load):
//    clearly labelled; NO psychometric properties are claimed for them.
// Published scales whose item wording needs permission (e.g. Work–Family Conflict, Netemeyer et al. 1996;
// Trust in Automation, Jian et al. 2000) are listed in the protocol to add once permission is confirmed;
// their items are deliberately not reproduced here.
export type ItemKind='scale'|'number';
export interface Item{id:string;text:string;kind:ItemKind;min:number;max:number;step?:number;low?:string;high?:string;reverse?:boolean}
export interface Instrument{id:'tlx'|'sus'|'weekly'|'context';name:string;source:string;purposeBuilt:boolean;items:Item[]}

const tlx=(id:string,text:string,low:string,high:string,reverse=false):Item=>({id,text,kind:'scale',min:0,max:100,step:5,low,high,reverse});
export const TLX:Instrument={id:'tlx',name:'Workload of household admin (NASA-TLX, raw)',source:'Hart & Staveland (1988). NASA Task Load Index. Public domain. Context wording adapted for household admin.',purposeBuilt:false,items:[
 tlx('tlx_mental','Over the past week, how mentally demanding was keeping on top of household admin?','Very low','Very high'),
 tlx('tlx_physical','How physically demanding was it?','Very low','Very high'),
 tlx('tlx_temporal','How hurried or rushed did it feel?','Very low','Very high'),
 tlx('tlx_performance','How successful were you at keeping on top of things?','Perfect','Failure'),
 tlx('tlx_effort','How hard did you have to work to keep on top of things?','Very low','Very high'),
 tlx('tlx_frustration','How insecure, discouraged, irritated or stressed did it make you?','Very low','Very high'),
]};
const sus=(n:number,text:string):Item=>({id:`sus_${n}`,text,kind:'scale',min:1,max:5,low:'Strongly disagree',high:'Strongly agree'});
export const SUS:Instrument={id:'sus',name:'System Usability Scale',source:'Brooke, J. (1996). SUS: a "quick and dirty" usability scale. Free to use with attribution. "System" replaced with "Load Bear".',purposeBuilt:false,items:[
 sus(1,'I think that I would like to use Load Bear frequently.'),sus(2,'I found Load Bear unnecessarily complex.'),sus(3,'I thought Load Bear was easy to use.'),
 sus(4,'I think that I would need the support of a technical person to be able to use Load Bear.'),sus(5,'I found the various functions in Load Bear were well integrated.'),
 sus(6,'I thought there was too much inconsistency in Load Bear.'),sus(7,'I would imagine that most people would learn to use Load Bear very quickly.'),
 sus(8,'I found Load Bear very cumbersome to use.'),sus(9,'I felt very confident using Load Bear.'),sus(10,'I needed to learn a lot of things before I could get going with Load Bear.'),
]};
// Purpose-built, short, every week (about a minute).
export const WEEKLY:Instrument={id:'weekly',name:'Weekly check-in',source:'Purpose-built for this study. No psychometric properties claimed.',purposeBuilt:true,items:[
 {id:'admin_minutes',text:'Roughly how many minutes did you spend on household admin in the past 7 days?',kind:'number',min:0,max:3000,step:5},
 {id:'mental_load',text:'How much household admin was on your mind this week?',kind:'scale',min:0,max:10,low:'None',high:'Constantly'},
 {id:'dropped_balls',text:'How many household admin things slipped (missed or late) this week?',kind:'number',min:0,max:50,step:1},
 {id:'notification_burden',text:'Reminders this week felt…',kind:'scale',min:1,max:5,low:'Far too few',high:'Far too many'},
]};
// Purpose-built context items at baseline and end (carrying load, trust).
export const CONTEXT:Instrument={id:'context',name:'Context',source:'Purpose-built for this study. No psychometric properties claimed.',purposeBuilt:true,items:[
 {id:'share_carried',text:'What share of your household’s admin do you personally keep track of?',kind:'scale',min:0,max:100,step:10,low:'None of it',high:'All of it'},
 {id:'trust_bear',text:'I trust Load Bear to keep track of things I give it. (End of study only; skip at the start.)',kind:'scale',min:1,max:5,low:'Strongly disagree',high:'Strongly agree'},
 {id:'admin_minutes',text:'Roughly how many minutes did you spend on household admin in the past 7 days?',kind:'number',min:0,max:3000,step:5},
]};
export const INSTRUMENTS={tlx:TLX,sus:SUS,weekly:WEEKLY,context:CONTEXT} as const;
export type InstrumentId=keyof typeof INSTRUMENTS;

// Scoring (documented, deterministic).
export function scoreTLX(a:Record<string,number>){const v=TLX.items.map(i=>a[i.id]);if(v.some(x=>typeof x!=='number'))return null;return v.reduce((s,x)=>s+x,0)/v.length;}
// SUS: odd items (x-1), even items (5-x), sum × 2.5 → 0–100.
export function scoreSUS(a:Record<string,number>){let s=0;for(let n=1;n<=10;n++){const x=a[`sus_${n}`];if(typeof x!=='number')return null;s+=n%2?x-1:5-x;}return s*2.5;}
export function validateAnswers(id:InstrumentId,answers:Record<string,unknown>):{ok:true;answers:Record<string,number>}|{ok:false;reason:string}{
 const inst=INSTRUMENTS[id];const out:Record<string,number>={};
 for(const [k,v] of Object.entries(answers)){const item=inst.items.find(i=>i.id===k);if(!item)return {ok:false,reason:`unknown item ${k}`};
  if(typeof v!=='number'||!Number.isFinite(v)||v<item.min||v>item.max)return {ok:false,reason:`out of range ${k}`};out[k]=Math.round(v*100)/100;}
 // Every item is optional except that something must be answered (people may skip any question).
 if(!Object.keys(out).length)return {ok:false,reason:'empty'};
 return {ok:true,answers:out};
}
