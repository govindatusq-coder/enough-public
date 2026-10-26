import {z} from 'zod';
import {localDay,type LifeMap} from './life-map.ts';
import {opportunityById,extraFor} from './opportunities.ts';
import {resolveMoment,type OpportunityMoment} from './opportunity-log.ts';
import {liveCommitments,minutesInWords,weekdayMoments,weekendMoments,type AdaptiveMovementCommitment} from './goal-fitting.ts';

/**
 * Follow-through (System B): when to speak up, what to offer, the check-in
 * after, and what Enough learns from it. Staying quiet is a real outcome.
 * Nothing rolls forward: a missed day simply disappears.
 */

export type InterventionDecision='usual'|'minimum'|'alternative'|'stay_quiet';
export const notTodayReasons=['too-busy','too-tired','couldnt-leave','didnt-feel-like-it','something-changed','felt-like-a-chore','not-a-good-fit'] as const;
export type NotTodayReason=typeof notTodayReasons[number];
export const notTodayLabels:Record<NotTodayReason,string>={'too-busy':'Too busy','too-tired':'Too tired','couldnt-leave':'Couldn’t get away','didnt-feel-like-it':'Didn’t feel like it','something-changed':'Something changed','felt-like-a-chore':'It felt like a chore','not-a-good-fit':'Not a good fit'};
export const otherKinds=['walk','on-my-feet','kids','other'] as const;
export type OtherKind=typeof otherKinds[number];
export const otherKindLabels:Record<OtherKind,string>={walk:'A walk','on-my-feet':'Jobs on my feet',kids:'Playing with the kids',other:'Something else'};
export const durationChoices=[{label:'5 min',minutes:5},{label:'10 min',minutes:10},{label:'15 min',minutes:15},{label:'30 min+',minutes:30}] as const;
export const reviewChoices=['keep','less','stop','keep-usual','take-longer'] as const;
export type ReviewChoice=typeof reviewChoices[number];

export type FollowThroughEvent={
 id:string;commitmentId:string;
 /** accepted: said yes to an invitation (or to the idea itself). review: answered "Still worth suggesting?" or an offer. */
 kind:'accepted'|'not-today'|'did-it'|'something-else'|'check-in-skipped'|'review';
 at:string;day:string;
 source:'fitting'|'invitation'|'check-in'|'my-moves';
 decision?:Exclude<InterventionDecision,'stay_quiet'>;
 minutes?:number;reason?:NotTodayReason;other?:OtherKind;review?:ReviewChoice;
 /** Set when this check-in resolved the suggestion system's planned moment, so it's counted once. */
 momentId?:string;
};
const iso=z.string().datetime({offset:true});
export const followThroughEventSchema=z.object({
 id:z.string().min(1).max(100),commitmentId:z.string().min(1).max(100),
 kind:z.enum(['accepted','not-today','did-it','something-else','check-in-skipped','review']),
 at:iso,day:z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
 source:z.enum(['fitting','invitation','check-in','my-moves']),
 decision:z.enum(['usual','minimum','alternative']).optional(),
 minutes:z.number().int().min(1).max(240).optional(),reason:z.enum(notTodayReasons).optional(),other:z.enum(otherKinds).optional(),review:z.enum(reviewChoices).optional(),
 momentId:z.string().min(1).max(100).optional()
}).strict();
export const MAX_FOLLOW_THROUGH=1500;
export const dayLoadSchema=z.object({day:z.string().regex(/^\d{4}-\d{2}-\d{2}$/),load:z.enum(['full-on'])}).strict();
export type DayLoad=z.infer<typeof dayLoadSchema>;

/** Around half an hour of movement already today is enough: Enough goes quiet. */
export const ENOUGH_TODAY_MINUTES=30;
const DAY=864e5;
const dayGap=(a:string,b:string)=>Math.round((Date.parse(b+'T12:00:00Z')-Date.parse(a+'T12:00:00Z'))/DAY);
const mine=(events:FollowThroughEvent[]|undefined,id:string)=>(events||[]).filter(e=>e.commitmentId===id);
const checkIns=(events:FollowThroughEvent[])=>events.filter(e=>e.kind==='did-it'||e.kind==='not-today'||e.kind==='something-else');
const newId=()=>globalThis.crypto?.randomUUID?globalThis.crypto.randomUUID():Math.random().toString(36).slice(2)+Date.now().toString(36);

/** Minutes the person said they moved today, from any source. */
export function activeMinutesToday(moments:OpportunityMoment[]|undefined,events:FollowThroughEvent[]|undefined,now=new Date()){
 const today=localDay(now);let total=0;
 for(const m of moments||[])if(m.status==='done'&&m.doneAt&&localDay(new Date(m.doneAt))===today)total+=m.minutes;
 for(const e of events||[])if(e.day===today&&!e.momentId&&(e.kind==='did-it'||e.kind==='something-else'))total+=e.minutes||0;
 return total;
}
/** Not-today answers in a row, most recent first, ignoring reviews and skipped check-ins. */
function declineRun(events:FollowThroughEvent[]){
 const list=checkIns(events);let n=0;
 for(let i=list.length-1;i>=0&&list[i].kind==='not-today';i--)n++;
 return n;
}
const recentReasons=(events:FollowThroughEvent[],count=3)=>checkIns(events).slice(-count).map(e=>e.reason).filter(Boolean) as NotTodayReason[];

export type DecisionContext={now:Date;events?:FollowThroughEvent[];lifeMap?:LifeMap;activeMinutes:number;dayLoad?:DayLoad};
/** usual, minimum, alternative or stay quiet, with the reason. Deterministic and explainable. */
export function decideInvitation(c:AdaptiveMovementCommitment,ctx:DecisionContext):{decision:InterventionDecision;reason:string}{
 const quiet=(reason:string)=>({decision:'stay_quiet' as const,reason});
 const today=localDay(ctx.now),events=mine(ctx.events,c.id);
 if(c.status==='paused'||c.status==='retired')return quiet('paused');
 if(c.invite==='never'||c.frequencyIntent==='once')return quiet('not-invited');
 if(events.some(e=>e.day===today))return quiet('handled-today');
 if(ctx.activeMinutes>=ENOUGH_TODAY_MINUTES)return quiet('already-active');
 const weekend=ctx.now.getDay()===0||ctx.now.getDay()===6,pattern=ctx.lifeMap?.fitting?.workPattern,anchor=c.anchor?.type as never;
 // Shift and changeable work can put a "weekday" moment on any day.
 if(pattern!=='shifts'&&pattern!=='some-weeks'&&anchor&&weekend&&weekdayMoments.includes(anchor))return quiet('wrong-day');
 if(anchor&&!weekend&&weekendMoments.includes(anchor))return quiet('wrong-day');
 const declines=declineRun(events),limit=c.demandSensitivity==='high'?2:3;
 if(declines>=limit+2)return quiet('backing-off');
 const last=events.filter(e=>e.kind!=='review').at(-1);
 const spacing=declines>=limit?3:c.frequencyIntent==='sometimes'||c.invite==='rarely'?2:1;
 if(last&&dayGap(last.day,today)<spacing)return quiet('spacing');
 const reasons=recentReasons(events);
 if(c.answers?.['camera-off']==='no'||reasons.filter(r=>r==='couldnt-leave'||r==='not-a-good-fit').length>=2)return {decision:'alternative',reason:'poor-fit'};
 if(ctx.dayLoad?.day===today)return {decision:'minimum',reason:'full-on-day'};
 if(reasons.filter(r=>r==='too-busy'||r==='too-tired').length>=2)return {decision:'minimum',reason:'recently-stretched'};
 return {decision:'usual',reason:'decent-fit'};
}
/** At most one invitation a day across everything the person has adopted. */
export function todaysInvitation(commitments:AdaptiveMovementCommitment[]|undefined,ctx:DecisionContext){
 const order:Record<InterventionDecision,number>={usual:0,minimum:1,alternative:2,stay_quiet:9};
 const lastSeen=(c:AdaptiveMovementCommitment)=>mine(ctx.events,c.id).at(-1)?.at||c.createdAt;
 return liveCommitments(commitments).map(c=>({commitment:c,...decideInvitation(c,ctx)}))
  .filter(x=>x.decision!=='stay_quiet')
  .sort((a,b)=>order[a.decision]-order[b.decision]||Date.parse(lastSeen(a.commitment))-Date.parse(lastSeen(b.commitment)))[0]||null;
}

/** Invitation words. Conditional ("If there's…"), because Enough doesn't know what's on today. Gentler for people who push back on pressure. */
export function invitationCopy(c:AdaptiveMovementCommitment,decision:Exclude<InterventionDecision,'stay_quiet'>){
 const o=opportunityById(c.originalSuggestionId),title=c.originalSuggestionSnapshot.title,pairs=o?.pairsWith;
 const high=c.demandSensitivity==='high',low=c.demandSensitivity==='low';
 const usual=c.usualVersion?.minutes??c.originalSuggestionSnapshot.movementMinutes??10,min=c.minimumVersion?.minutes??5;
 const when=pairs?`If there’s ${pairs} today`:'If a moment comes up today';
 const actions={yes:'Yep',no:'Not today'};
 if(decision==='minimum')return {...actions,heading:high?'Busy one?':'Full-on day?',body:`${minutesInWords(min,true)} would be plenty${pairs?`, if there’s ${pairs}`:''}.`};
 if(decision==='alternative'){const alt=c.fallbackOptions?.[0]||'Stand up and stretch for a minute';return {...actions,heading:high?'A smaller one, if you like':'A smaller version?',body:`${alt}${pairs?`, if there’s ${pairs}`:''}.`};}
 if(high)return {...actions,heading:`${title}, if you feel like it`,body:`${when}, this could fit. Around ${usual} minutes, only if you fancy it.`};
 return {...actions,heading:`${title}?`,body:low?`${when}, it looks like a good one. Your usual is around ${usual} minutes.`:`${when}, it could be a good one for this. Around ${usual} minutes would do it.`};
}

/** Check-ins get lighter as Enough learns: full at first, then one tap. */
export function checkInMode(c:AdaptiveMovementCommitment,events:FollowThroughEvent[]|undefined):'full'|'light'{
 const list=checkIns(mine(events,c.id));
 const did=list.filter(e=>e.kind==='did-it'&&e.minutes).slice(-3).map(e=>e.minutes!);
 const usual=c.usualVersion?.minutes??0;
 return list.length>=4&&did.length===3&&did.every(m=>Math.abs(m-usual)<=3)?'light':'full';
}
/** Accepted today or yesterday and not answered yet. Older ones quietly drop away. */
export function pendingCheckIns(commitments:AdaptiveMovementCommitment[]|undefined,events:FollowThroughEvent[]|undefined,now=new Date()){
 const today=localDay(now);
 return liveCommitments(commitments).filter(c=>{
  const list=mine(events,c.id),accepted=list.filter(e=>e.kind==='accepted').at(-1);
  if(!accepted||dayGap(accepted.day,today)>1)return false;
  return !list.some(e=>e.kind!=='accepted'&&e.kind!=='review'&&Date.parse(e.at)>=Date.parse(accepted.at));
 });
}
/** "Still worth suggesting?" after a run of no's or a couple of "chore" answers, or every few weeks; never more than once a fortnight. */
export function reviewDue(c:AdaptiveMovementCommitment,events:FollowThroughEvent[]|undefined,now=new Date()){
 if(c.status!=='learning'&&c.status!=='active')return false;
 const list=mine(events,c.id),lastReview=list.filter(e=>e.kind==='review'&&e.review!=='keep-usual'&&e.review!=='take-longer').at(-1);
 if(lastReview&&now.getTime()-Date.parse(lastReview.at)<14*DAY)return false;
 const since=lastReview?list.filter(e=>Date.parse(e.at)>Date.parse(lastReview.at)):list;
 const limit=c.demandSensitivity==='high'?2:3;
 if(declineRun(since)>=limit+2)return true;
 if(recentReasons(since,4).filter(r=>r==='felt-like-a-chore'||r==='not-a-good-fit').length>=2)return true;
 return checkIns(since).length>=6&&now.getTime()-Date.parse(lastReview?.at||c.createdAt)>=21*DAY;
}
/** "You've been going longer lately": an offer, never a silent increase. */
export function longerOffer(c:AdaptiveMovementCommitment,events:FollowThroughEvent[]|undefined):number|null{
 const list=mine(events,c.id),usual=c.usualVersion?.minutes;if(!usual)return null;
 const lastAnswer=list.filter(e=>e.kind==='review'&&(e.review==='keep-usual'||e.review==='take-longer')).at(-1);
 const did=list.filter(e=>e.kind==='did-it'&&e.minutes&&(!lastAnswer||Date.parse(e.at)>Date.parse(lastAnswer.at))).slice(-4).map(e=>e.minutes!);
 const longer=did.filter(m=>m>=usual+5);
 if(did.length<3||longer.length<3)return null;
 const o=opportunityById(c.originalSuggestionId),sorted=[...longer].sort((a,b)=>a-b),median=sorted[Math.floor(sorted.length/2)];
 const offer=Math.min(o?.maxMinutes??median,Math.round(median/5)*5);
 return offer>usual?offer:null;
}

/** What Enough learns from a check-in. The usual can come down on its own; it only goes up when the person says so. */
export function learn(c:AdaptiveMovementCommitment,events:FollowThroughEvent[],now=new Date()):AdaptiveMovementCommitment{
 const list=mine(events,c.id);let next=c;
 if(next.status==='learning'&&checkIns(list).length>=3)next={...next,status:'active'};
 const changed=[...(c.adaptations||[])].reverse().find(a=>a.kind==='person-changed'||a.kind==='usual-down'||a.kind==='usual-up');
 const did=list.filter(e=>e.kind==='did-it'&&e.minutes&&(!changed||Date.parse(e.at)>Date.parse(changed.at))).slice(-6).map(e=>e.minutes!);
 const usual=next.usualVersion?.minutes;
 if(usual&&did.length>=3){
  const sorted=[...did].sort((a,b)=>a-b),median=sorted[Math.floor((sorted.length-1)/2)];
  if(median<=usual-3){
   const lo=sorted[Math.floor((sorted.length-1)/4)],hi=Math.max(lo,sorted[Math.ceil((sorted.length-1)*3/4)]),to=Math.max(1,median);
   const min=next.minimumVersion?.minutes??5,newMin=min<to?min:to>=5?2:1;
   const range=lo===hi?`${to}`:`${lo}–${hi}`,at=now.toISOString();
   next={...next,updatedAt:at,usualVersion:{minutes:to,description:`Around ${range} minutes.`},
    minimumVersion:newMin===min?next.minimumVersion:{minutes:newMin,description:newMin===1?'Even a minute counts.':`${minutesInWords(newMin,true)} is enough.`},
    adaptations:[...(next.adaptations||[]),{at,kind:'usual-down' as const,from:usual,to,note:`Your usual is more like ${range} minutes, so that’s what Enough expects now.`}].slice(-40)};
  }
 }
 return next;
}

export type CheckIn={commitmentId:string;kind:'accepted'|'not-today'|'did-it'|'something-else'|'check-in-skipped';source:FollowThroughEvent['source'];decision?:FollowThroughEvent['decision'];minutes?:number;reason?:NotTodayReason;other?:OtherKind};
/**
 * Records an answer. The first answer for an idea also settles the suggestion
 * system's planned moment exactly as "It happened" or "Not this time" did:
 * done with the minutes, or skipped. That keeps the suggestion inputs the same.
 */
export function recordCheckIn(parts:{commitments?:AdaptiveMovementCommitment[];events?:FollowThroughEvent[];moments?:OpportunityMoment[]},input:CheckIn,now=new Date()){
 const c=(parts.commitments||[]).find(x=>x.id===input.commitmentId);
 if(!c)return {commitments:parts.commitments||[],events:parts.events||[],moments:parts.moments||[]};
 let moments=parts.moments||[],momentId:string|undefined;
 const planned=c.plannedMomentId&&moments.find(m=>m.id===c.plannedMomentId&&m.status==='planned');
 if(planned&&(input.kind==='did-it'||input.kind==='not-today'||input.kind==='something-else')){
  moments=resolveMoment(moments,planned.id,input.kind==='did-it',input.kind==='did-it'?input.minutes:undefined,now);
  momentId=planned.id;
 }
 const event:FollowThroughEvent={id:newId(),commitmentId:c.id,kind:input.kind,at:now.toISOString(),day:localDay(now),source:input.source,
  ...(input.decision?{decision:input.decision}:{}),...(input.minutes?{minutes:Math.max(1,Math.min(240,Math.round(input.minutes)))}:{}),
  ...(input.reason?{reason:input.reason}:{}),...(input.other?{other:input.other}:{}),...(momentId?{momentId}:{})};
 const events=[...(parts.events||[]),event].slice(-MAX_FOLLOW_THROUGH);
 const learned=learn(c,events,now);
 return {commitments:(parts.commitments||[]).map(x=>x.id===c.id?learned:x),events,moments};
}
/** Adds the optional "what got in the way" to the latest not-today answer. */
export function addNotTodayReason(events:FollowThroughEvent[]|undefined,commitmentId:string,reason:NotTodayReason){
 const list=[...(events||[])];
 for(let i=list.length-1;i>=0;i--)if(list[i].commitmentId===commitmentId&&list[i].kind==='not-today'){list[i]={...list[i],reason};break;}
 return list;
}
export function recordReview(parts:{commitments?:AdaptiveMovementCommitment[];events?:FollowThroughEvent[]},commitmentId:string,review:ReviewChoice,now=new Date(),offer?:number){
 const at=now.toISOString(),event:FollowThroughEvent={id:newId(),commitmentId,kind:'review',at,day:localDay(now),source:'check-in',review};
 const commitments=(parts.commitments||[]).map(c=>{
  if(c.id!==commitmentId)return c;
  if(review==='less')return {...c,invite:'rarely' as const,updatedAt:at,adaptations:[...(c.adaptations||[]),{at,kind:'less-often' as const,note:'You asked Enough to bring this up less often.'}].slice(-40)};
  if(review==='stop')return {...c,status:'paused' as const,updatedAt:at};
  if(review==='take-longer'&&offer&&offer>(c.usualVersion?.minutes??0))return {...c,updatedAt:at,usualVersion:{minutes:offer,description:`Around ${offer} minutes.`},adaptations:[...(c.adaptations||[]),{at,kind:'usual-up' as const,from:c.usualVersion?.minutes,to:offer,note:`You made ${offer} minutes your usual.`}].slice(-40)};
  return c;
 });
 return {commitments,events:[...(parts.events||[]),event].slice(-MAX_FOLLOW_THROUGH)};
}

// ── My Wins ─────────────────────────────────────────────────────────────────
type LegacyEntry={status:string;completedAt?:string;minutes?:number;timeCombined?:number};
export type WinLine={title:string;minutes:number;extraMinutes:number;times:number};
/**
 * This period's movement, by opportunity: what happened, how much extra time
 * it really took and how many opportunities were used. Counts only what the
 * person said happened; each event is counted once.
 */
export function winsLedger(input:{moments?:OpportunityMoment[];events?:FollowThroughEvent[];commitments?:AdaptiveMovementCommitment[];entries?:LegacyEntry[];since:Date;now?:Date}){
 const now=input.now||new Date(),lines=new Map<string,WinLine>();
 const inPeriod=(at?:string)=>!!at&&new Date(at)>=input.since&&new Date(at)<=now;
 const add=(title:string,minutes:number,extra:number)=>{const l=lines.get(title)||{title,minutes:0,extraMinutes:0,times:0};l.minutes+=minutes;l.extraMinutes+=Math.min(extra,minutes);l.times++;lines.set(title,l);};
 for(const m of input.moments||[]){if(m.status!=='done'||!inPeriod(m.doneAt))continue;const o=opportunityById(m.opportunityId);if(o)add(o.title,m.minutes,m.extraMinutes);}
 for(const e of input.events||[]){
  if(!inPeriod(e.at)||e.momentId||!e.minutes)continue;
  if(e.kind==='did-it'){const c=(input.commitments||[]).find(c=>c.id===e.commitmentId),o=c&&opportunityById(c.originalSuggestionId);if(c)add(c.originalSuggestionSnapshot.title,e.minutes,o?extraFor(o,e.minutes):0);}
  else if(e.kind==='something-else')add(otherKindLabels[e.other||'other'],e.minutes,0);
 }
 for(const e of input.entries||[]){if(e.status!=='completed'||!inPeriod(e.completedAt))continue;const minutes=e.minutes||0;add('From the classic library',minutes,Math.max(0,minutes-Math.min(minutes,e.timeCombined||0)));}
 const list=[...lines.values()].sort((a,b)=>b.minutes-a.minutes);
 const movement=list.reduce((n,l)=>n+l.minutes,0),extra=list.reduce((n,l)=>n+l.extraMinutes,0),used=list.reduce((n,l)=>n+l.times,0);
 return {lines:list,movement,extra,used,insideExisting:movement-extra};
}

// ── My Enough: things Enough has learnt ─────────────────────────────────────
export function learnedFacts(commitments:AdaptiveMovementCommitment[]|undefined,events:FollowThroughEvent[]|undefined):string[]{
 const facts:string[]=[];
 for(const c of commitments||[]){
  const a=(c.adaptations||[]).at(-1);if(a)facts.push(`${c.originalSuggestionSnapshot.title}: ${a.note.charAt(0).toLowerCase()+a.note.slice(1)}`);
  if(c.status==='paused')facts.push(`${c.originalSuggestionSnapshot.title} is paused. It’s in My Moves if you want it back.`);
 }
 const reasons=(events||[]).filter(e=>e.reason).map(e=>e.reason);
 if(reasons.filter(r=>r==='too-busy'||r==='too-tired').length>=2)facts.push('On stretched days, Enough offers the small version first.');
 if((events||[]).some(e=>e.kind==='something-else'))facts.push('You find your own movement too. It all counts.');
 return facts.slice(-8);
}
