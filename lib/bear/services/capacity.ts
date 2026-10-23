import {localParts,zonedDateTime,addDays,parseISODate,weekdayOf} from '../domain/dates.ts';
import type {CapacityWindow,DayMode,Profile,RhythmBlock,Weekday} from '../domain/types.ts';
import type {BehaviourSignals} from './behaviour.ts';

// CapacityModelService. Produces probabilistic capacity windows from Life Rhythm,
// the "running on empty" answers, the day's mode and past behaviour. These are
// estimates; the UI never claims Bear knows how the user feels.
const SLOT_MINUTES=30;
const capacityPrior={none:0.05,low:0.3,some:0.6,good:0.9};
const emptyMomentPenalty:Record<string,{days:Weekday[]|null;from:number;to:number}>={
 morning_scramble:{days:null,from:6*60,to:9*60},mid_afternoon:{days:null,from:14*60,to:16*60},after_work:{days:['mon','tue','wed','thu','fri'],from:17*60,to:18*60+30},
 dinner_bedtime:{days:null,from:17*60+30,to:20*60},sunday_night:{days:['sun'],from:18*60,to:23*60},
};
function inBlock(b:RhythmBlock,day:Weekday,minute:number){if(!b.days.includes(day))return false;return b.startMinute<=b.endMinute?minute>=b.startMinute&&minute<b.endMinute:minute>=b.startMinute||minute<b.endMinute;}
function overnight(day:Weekday,minute:number,blocks:RhythmBlock[]){
 // Sleep blocks wrap past midnight: a block starting yesterday may still cover this minute.
 const prev=(['sun','mon','tue','wed','thu','fri','sat'] as Weekday[])[(['mon','tue','wed','thu','fri','sat','sun'].indexOf(day)+6)%7];
 return blocks.some(b=>b.startMinute>b.endMinute&&b.days.includes(prev)&&minute<b.endMinute);
}
export interface CapacityOptions{profile:Profile;signals?:BehaviourSignals|null;dayMode?:DayMode|null;now:Date;days?:number}
export function capacityWindows({profile,signals,dayMode,now,days=10}:CapacityOptions):CapacityWindow[]{
 const tz=profile.lifeRhythm.timezone||'Australia/Sydney';const blocks=profile.lifeRhythm.blocks;
 const start=localParts(now,tz);const windows:CapacityWindow[]=[];
 const nudge=profile.pins.preferences.nudgeTolerance;
 for(let d=0;d<days;d++){
  const date=addDays(start.date,d);const day=weekdayOf(parseISODate(date)!);
  for(let minute=0;minute<1440;minute+=SLOT_MINUTES){
   if(d===0&&minute+SLOT_MINUTES<=start.minuteOfDay)continue;
   const active=blocks.filter(b=>inBlock(b,day,minute));
   const asleep=overnight(day,minute,blocks)||active.some(b=>b.kind==='sleep');
   // No rhythm defined for this slot: default waking-hours prior (quiet at night).
   const night=minute<7*60||minute>=21*60+30;
   let time=asleep?0:active.length?Math.min(...active.map(b=>capacityPrior[b.capacity])):night?0.1:0.5;
   let cognitive=time,physical=time,emotional=0.3;
   for(const m of profile.emptyMoments){const p=emptyMomentPenalty[m];if(!p)continue;if((p.days===null||p.days.includes(day))&&minute>=p.from&&minute<p.to){cognitive*=0.35;physical*=0.5;emotional=0.8;}}
   if(profile.emptyMoments.includes('it_changes')){cognitive*=0.9;emotional=Math.max(emotional,0.45);}
   const routineFit=active.some(b=>b.kind==='admin')?1:active.some(b=>b.kind==='my_time')?0.6:active.length?0.3:0.7;
   const hour=Math.floor(minute/60);const history=signals&&signals.sampleSize>=5?signals.hourResponsiveness[hour]:0;
   let score=time*0.3+cognitive*0.3+physical*0.1+(1-emotional)*0.15+routineFit*0.1+(history+1)/2*0.05;
   if(d===0&&dayMode){const factor=dayMode==='chaos'?0.1:dayMode==='wiped'?0.3:dayMode==='full'?0.6:1.05;score*=factor;}
   if(nudge==='minimal')score*=minute>=20*60||minute<9*60?0.8:1;
   const protectedSlot=asleep||active.some(b=>['morning_rush','school_run','dinner','bedtime','after_school'].includes(b.kind))||(d===0&&dayMode==='chaos');
   windows.push({id:`${date}T${String(hour).padStart(2,'0')}${String(minute%60).padStart(2,'0')}`,start:zonedDateTime(date,minute,tz),end:zonedDateTime(date,Math.min(minute+SLOT_MINUTES,1439),tz),label:labelFor(active,minute),time,cognitive,physical,emotionalLoad:emotional,routineFit,history,score:Math.max(0,Math.min(1,score)),protected:protectedSlot});
  }
 }
 return windows;
}
function labelFor(active:RhythmBlock[],minute:number){if(active.length)return active.map(b=>b.label).join(' / ');const h=Math.floor(minute/60);return h<12?'morning':h<17?'afternoon':'evening';}
