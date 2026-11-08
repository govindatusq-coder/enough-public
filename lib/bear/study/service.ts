import {z} from 'zod';
import {timingSafeEqual} from 'node:crypto';
import {todayISO} from '../domain/dates.ts';
import type {Owned} from '../domain/types.ts';
import {ensureProfile} from '../services/profile.ts';
import {stamp,type BearStore} from '../store/store.ts';
import {INSTRUMENTS,validateAnswers,type InstrumentId} from './instruments.ts';
import {nextDue,studyEndsOn} from './schedule.ts';

// The research study, inside the app. Off unless BEAR_STUDY_ENABLED=on. Joining needs the study code the
// researcher gives participants (BEAR_STUDY_CODE) AND explicit consent. Leaving is one tap and can delete
// every answer. Surveys never block using Bear, and every question can be skipped.
export interface StudyResponse extends Owned{studyId:string;phase:'baseline'|'weekly'|'end';week:number;instrument:InstrumentId;answers:Record<string,number>;completedAt:string}
export const studyEnabled=()=>process.env.BEAR_STUDY_ENABLED==='on'&&!!process.env.BEAR_STUDY_CODE;
export const studyId=()=>process.env.BEAR_STUDY_ID||'loadbear-pilot-1';
const sameCode=(a:string,b:string)=>{const x=Buffer.from(a.trim().toUpperCase()),y=Buffer.from(b.trim().toUpperCase());return x.length===y.length&&timingSafeEqual(x,y);};
const tz=(p:{lifeRhythm:{timezone?:string|null}})=>p.lifeRhythm.timezone||'Australia/Sydney';

export async function studyStatus(store:BearStore,now=new Date()){
 if(!studyEnabled())return {available:false as const};
 const p=await ensureProfile(store);const r=p.research;const today=todayISO(tz(p),now);
 if(!r?.consent||r.studyId!==studyId()||!r.enrolledOn)return {available:true as const,enrolled:false as const};
 const done=(await store.list('study_responses')).filter(x=>x.studyId===studyId());
 const due=nextDue(r.enrolledOn,today,done);
 return {available:true as const,enrolled:true as const,enrolledOn:r.enrolledOn,endsOn:studyEndsOn(r.enrolledOn),due,completed:done.length};
}
export const joinSchema=z.object({code:z.string().trim().min(3).max(40),consent:z.literal(true)}).strict();
export async function joinStudy(store:BearStore,code:string,now=new Date()){
 if(!studyEnabled())throw new Error('not_found');
 if(!sameCode(code,process.env.BEAR_STUDY_CODE!))throw new StudyError('That study code doesn’t match. Check the code in your invitation.');
 const p=await ensureProfile(store);const today=todayISO(tz(p),now);
 await store.update('profiles',p.id,{research:{consent:true,at:now.toISOString(),studyId:studyId(),enrolledOn:p.research?.studyId===studyId()&&p.research.enrolledOn?p.research.enrolledOn:today,withdrawnAt:null}});
 return studyStatus(store,now);
}
export const respondSchema=z.object({phase:z.enum(['baseline','weekly','end']),week:z.number().int().min(0).max(6),instrument:z.enum(['tlx','sus','weekly','context']),answers:z.record(z.string(),z.number())}).strict();
export async function respondStudy(store:BearStore,input:z.infer<typeof respondSchema>,now=new Date()){
 const s=await studyStatus(store,now);if(!s.available||!s.enrolled)throw new StudyError('You’re not in the study.');
 // Only what is due right now can be answered (no back-filling or duplicate submissions).
 if(!s.due||s.due.phase!==input.phase||s.due.week!==input.week||!s.due.instruments.includes(input.instrument))throw new StudyError('That survey isn’t due.');
 const v=validateAnswers(input.instrument,input.answers);if(!v.ok)throw new StudyError('Some answers were out of range.');
 await store.insert('study_responses',stamp<StudyResponse>(store.userId,{studyId:studyId(),phase:input.phase,week:input.week,instrument:input.instrument,answers:v.answers,completedAt:now.toISOString()}));
 return studyStatus(store,now);
}
export const leaveSchema=z.object({deleteAnswers:z.boolean()}).strict();
export async function leaveStudy(store:BearStore,deleteAnswers:boolean,now=new Date()){
 const p=await ensureProfile(store);
 await store.update('profiles',p.id,{research:{...(p.research||{at:now.toISOString()}),consent:false,withdrawnAt:now.toISOString()}});
 if(deleteAnswers)for(const r of await store.list('study_responses'))await store.remove('study_responses',r.id);
 return {left:true,deleted:deleteAnswers};
}
export class StudyError extends Error{readonly status=400;}
export const instrumentFor=(id:InstrumentId)=>INSTRUMENTS[id];
