// Need a Break: one restorative idea that fits the time she has. Drawn from her PINS interests (if she has given any) and
// what she has said "Sounds good" to before. Breaks are for her: never chores, emails, errands or anything productive.
// No streaks, scores or timers. Only her explicit "Sounds good" teaches Bear; "Another idea" and "Not now" mean nothing more.
import {z} from 'zod';
import type {BearStore} from '../store/store.ts';
import {ensureProfile} from './profile.ts';

export interface BreakIdea{id:string;title:string;line:string;minutes:number;kind:string;interests:string[];icon:'air'|'music'|'tea'|'walk'|'book'|'heart'|'rest'|'create'|'sun'}
// Interests as onboarding names them: Family time, Friends, Movement, Quiet, Creativity, Travel, Learning, Career, Outdoors,
// Date time, Community, Doing absolutely nothing. `minutes` is the least time an idea needs; `kind` keeps "another idea" varied.
export const BREAKS:BreakIdea[]=[
 {id:'fresh-air',title:'Step outside for some fresh air',line:'A couple of minutes of sky and air, with nothing to do.',minutes:2,kind:'outside',interests:['Outdoors','Quiet'],icon:'air'},
 {id:'one-song',title:'Listen to a song you love',line:'Pick one favourite and just listen, start to finish.',minutes:2,kind:'music',interests:['Creativity','Quiet'],icon:'music'},
 {id:'sit-still',title:'Sit somewhere comfy, no demands',line:'Feet up, phone down. Nothing needs you for a minute.',minutes:2,kind:'rest',interests:['Doing absolutely nothing','Quiet'],icon:'rest'},
 {id:'stretch',title:'A slow, easy stretch',line:'Shoulders, neck, back: whatever feels good.',minutes:2,kind:'move',interests:['Movement'],icon:'walk'},
 {id:'window',title:'Look out the window for a bit',line:'Let your eyes rest on something far away.',minutes:2,kind:'rest',interests:['Quiet','Doing absolutely nothing'],icon:'sun'},
 {id:'tea',title:'Make a cup of tea and actually enjoy it',line:'Sit down with it while it’s still hot.',minutes:5,kind:'treat',interests:['Quiet','Doing absolutely nothing'],icon:'tea'},
 {id:'sunny-spot',title:'Sit in a sunny spot',line:'Find a patch of sun and stay there a while.',minutes:5,kind:'outside',interests:['Outdoors','Quiet'],icon:'sun'},
 {id:'hello-friend',title:'Send a hello to a friend you love',line:'Just because, with no plans to make.',minutes:5,kind:'people',interests:['Friends'],icon:'heart'},
 {id:'doodle',title:'Doodle or colour for a few minutes',line:'No goal, just pen on paper.',minutes:5,kind:'create',interests:['Creativity'],icon:'create'},
 {id:'trip-photos',title:'Look back at photos from a trip you loved',line:'A few minutes somewhere else.',minutes:5,kind:'memories',interests:['Travel'],icon:'heart'},
 {id:'music-few',title:'Put on music you love',line:'A few favourite songs, nothing else at the same time.',minutes:5,kind:'music',interests:['Creativity','Quiet'],icon:'music'},
 {id:'short-walk',title:'A short walk',line:'Around the block or to the end of the street, at your own pace.',minutes:10,kind:'move',interests:['Movement','Outdoors'],icon:'walk'},
 {id:'read-pages',title:'Read a few pages of a book',line:'Something you’re enjoying, not something you should read.',minutes:10,kind:'read',interests:['Learning','Quiet'],icon:'book'},
 {id:'podcast',title:'Listen to part of a podcast you like',line:'Somewhere comfy, just listening.',minutes:10,kind:'listen',interests:['Learning','Career'],icon:'music'},
 {id:'call-someone',title:'Call someone who makes you laugh',line:'A catch-up with no agenda.',minutes:10,kind:'people',interests:['Friends','Family time'],icon:'heart'},
 {id:'cuppa-partner',title:'Share a cuppa with your partner, phones away',line:'Ten quiet minutes together.',minutes:10,kind:'people',interests:['Date time'],icon:'tea'},
 {id:'play-kids',title:'Ten minutes of play with the kids',line:'Their game, their rules, just for fun.',minutes:10,kind:'family',interests:['Family time'],icon:'heart'},
 {id:'garden',title:'Wander around the garden',line:'Have a look at what’s growing. Nothing to fix.',minutes:10,kind:'outside',interests:['Outdoors'],icon:'sun'},
 {id:'neighbour',title:'Stop for a chat with a neighbour',line:'Easy, friendly, nothing to arrange.',minutes:10,kind:'people',interests:['Community','Friends'],icon:'heart'},
 {id:'rest-eyes',title:'Lie down and rest your eyes',line:'You don’t have to sleep. Just stop for a bit.',minutes:10,kind:'rest',interests:['Doing absolutely nothing'],icon:'rest'},
 {id:'chapter',title:'Read a chapter of something good',line:'Make a drink first and get comfortable.',minutes:20,kind:'read',interests:['Learning','Quiet'],icon:'book'},
 {id:'hobby',title:'Spend some time on a hobby you love',line:'Twenty uninterrupted minutes just for that.',minutes:20,kind:'create',interests:['Creativity'],icon:'create'},
 {id:'long-walk',title:'A longer walk somewhere pleasant',line:'Somewhere green if you can, no rushing.',minutes:20,kind:'move',interests:['Movement','Outdoors'],icon:'walk'},
 {id:'episode',title:'Watch an episode of something light',line:'Something that makes you smile.',minutes:20,kind:'watch',interests:['Doing absolutely nothing'],icon:'rest'},
 {id:'bath',title:'Have a slow shower or bath',line:'Take your time. Everything else can wait.',minutes:20,kind:'treat',interests:['Quiet','Doing absolutely nothing'],icon:'rest'},
 {id:'learn-curious',title:'Read about something you’re curious about',line:'Just for interest, not for work.',minutes:20,kind:'read',interests:['Learning','Career','Travel'],icon:'book'},
];
const DAY=86400000;
export const breakSchema=z.object({minutes:z.number().int().min(1).max(240),exclude:z.array(z.string().max(40)).max(30).default([])}).strict();
export const breakFeedbackSchema=z.object({id:z.string().max(40),value:z.literal('liked')}).strict();
// Pick one idea. Fits the time; her interests and past "Sounds good"s count; something she saw in the last day counts
// against it; "another idea" never repeats and moves to a different kind of break when it can.
export function chooseBreak(minutes:number,interests:string[],liked:Record<string,number>,recent:{id:string;at:string}[],exclude:string[],now=new Date()):BreakIdea|null{
 const fits=BREAKS.filter(b=>b.minutes<=minutes&&!exclude.includes(b.id));if(!fits.length)return null;
 const lastKinds=new Set(exclude.map(id=>BREAKS.find(b=>b.id===id)?.kind).filter(Boolean));
 const seen=new Set(recent.filter(r=>now.getTime()-Date.parse(r.at)<DAY).map(r=>r.id));
 const score=(b:BreakIdea)=>b.interests.filter(i=>interests.includes(i)).length*3+Math.min(liked[b.id]||0,3)*2+(b.minutes>=Math.min(minutes,20)*0.5?1:0)-(seen.has(b.id)?2:0)-(lastKinds.has(b.kind)?4:0);
 // A steady order for equal scores that still varies from day to day.
 const day=Math.floor(now.getTime()/DAY);const tie=(b:BreakIdea)=>[...b.id].reduce((h,c)=>(h*31+c.charCodeAt(0)+day)%9973,7);
 return [...fits].sort((a,b)=>score(b)-score(a)||tie(a)-tie(b))[0];
}
export async function suggestBreak(store:BearStore,input:z.infer<typeof breakSchema>,now=new Date()){
 const p=await ensureProfile(store);const prefs=p.breakPrefs||{liked:{},recent:[]};
 const idea=chooseBreak(input.minutes,p.pins?.interests||[],prefs.liked,prefs.recent,input.exclude,now);
 if(idea)await store.update('profiles',p.id,{breakPrefs:{liked:prefs.liked,recent:[{id:idea.id,at:now.toISOString()},...prefs.recent].slice(0,20)}});
 return {idea,personal:(p.pins?.interests||[]).length>0||Object.keys(prefs.liked).length>0};
}
// Her "Sounds good": the only signal Bear learns from.
export async function likeBreak(store:BearStore,id:string){
 if(!BREAKS.some(b=>b.id===id))return;const p=await ensureProfile(store);const prefs=p.breakPrefs||{liked:{},recent:[]};
 await store.update('profiles',p.id,{breakPrefs:{...prefs,liked:{...prefs.liked,[id]:Math.min((prefs.liked[id]||0)+1,20)}}});
}
