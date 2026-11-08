import {addDays,daysBetween} from '../domain/dates.ts';

// The study schedule: baseline at enrolment (context + TLX), a one-minute check-in every 7 days for six
// weeks, and an end survey (context + TLX + SUS) at week 6. Nothing is ever due more than once, and the
// person can skip anything.
export const STUDY_WEEKS=6;
export interface StudyResponseLite{phase:'baseline'|'weekly'|'end';week:number;instrument:string}
export interface Due{phase:'baseline'|'weekly'|'end';week:number;instruments:('context'|'tlx'|'sus'|'weekly')[];label:string}
export function nextDue(enrolledOn:string,today:string,done:StudyResponseLite[]):Due|null{
 const has=(phase:string,week:number,inst:string)=>done.some(d=>d.phase===phase&&d.week===week&&d.instrument===inst);
 const base:Due['instruments']=['context','tlx'].filter(i=>!has('baseline',0,i)) as Due['instruments'];
 if(base.length)return {phase:'baseline',week:0,instruments:base,label:'Starting survey (about 4 minutes)'};
 const day=daysBetween(enrolledOn,today)??0;const week=Math.min(STUDY_WEEKS,Math.floor(day/7));
 if(week>=STUDY_WEEKS){const end:Due['instruments']=(['context','tlx','sus'] as const).filter(i=>!has('end',STUDY_WEEKS,i));return end.length?{phase:'end',week:STUDY_WEEKS,instruments:end,label:'Final survey (about 6 minutes)'}:null;}
 // Weekly check-ins for weeks 1–5 (week 6 is the end survey). A missed week isn't carried over.
 if(week>=1&&!has('weekly',week,'weekly'))return {phase:'weekly',week,instruments:['weekly'],label:'Weekly check-in (about a minute)'};
 return null;
}
export const studyEndsOn=(enrolledOn:string)=>addDays(enrolledOn,STUDY_WEEKS*7);
