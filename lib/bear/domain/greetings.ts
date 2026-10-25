// The My Bear banner changes each visit: a picture from the artwork library paired with a short
// line that fits it, chosen for the time of day and the kind of day the person said they are
// having. Lines are warm, short and never guilt people. Pure and testable.
import type {DayMode} from './types.ts';
export type PartOfDay='morning'|'afternoon'|'evening';
export interface Greeting{id:string;art:string;focus:string;zoom?:number;line:string;parts?:PartOfDay[];modes?:DayMode[]}
export const partOfDay=(hour:number):PartOfDay=>hour<12?'morning':hour<17?'afternoon':'evening';

// focus = where the bear's face sits in the picture, so the crop always keeps it in view.
export const greetingPool:Greeting[]=[
 {id:'got-you',art:'hero-bear',focus:'60% 22%',line:"Mama Bear's got you."},
 {id:'carry',art:'hero-bear',focus:'60% 22%',line:'You carry a lot. Bear carries some.'},
 {id:'thinking',art:'empty-ideas',focus:'55% 30%',line:'On your mind? Hand it over.',parts:['morning','afternoon']},
 {id:'list',art:'capture-bear',focus:'58% 24%',line:"Bear's keeping the list for you.",parts:['morning']},
 {id:'one-less',art:'empty-wins',focus:'52% 28%',line:'One less thing to carry.'},
 {id:'handled',art:'empty-wins',focus:'52% 28%',line:"Look at what you've already handled.",parts:['afternoon','evening']},
 {id:'calm',art:'home-calm',focus:'55% 30%',line:'All calm, all covered.',parts:['afternoon','evening']},
 {id:'rest-evening',art:'capacity-rest',focus:'22% 40%',zoom:1.1,line:'Rest is part of the plan.',parts:['evening']},
 {id:'head-start',art:'hero-bear',focus:'60% 22%',line:"Bear's here if you'd like a head start.",modes:['good'],parts:['morning','afternoon']},
 {id:'full-day',art:'capture-bear',focus:'58% 24%',line:"Full day? Bear's got the small stuff.",modes:['full']},
 {id:'wiped',art:'capacity-rest',focus:'22% 40%',zoom:1.1,line:'Go gently today. Bear has the rest.',modes:['wiped']},
 {id:'chaos',art:'capacity-rest',focus:'22% 40%',zoom:1.1,line:'Breathe. Bear has the rest.',modes:['chaos']},
];
export function eligible(part:PartOfDay,mode:DayMode|null){
 const timed=greetingPool.filter(g=>!g.parts||g.parts.includes(part));
 const forMode=mode?timed.filter(g=>g.modes?.includes(mode)):[];
 // On a hard day only the gentle lines show; otherwise the general ones.
 return forMode.length&&(mode==='wiped'||mode==='chaos')?forMode:timed.filter(g=>!g.modes||(mode?g.modes.includes(mode):false));
}
export function pickGreeting({hour,mode,last,random=Math.random}:{hour:number;mode:DayMode|null;last?:string|null;random?:()=>number}):Greeting{
 const part=partOfDay(hour);const pool=eligible(part,mode);const fresh=pool.filter(g=>g.id!==last);const from=fresh.length?fresh:pool;
 return from[Math.min(from.length-1,Math.floor(random()*from.length))];
}
