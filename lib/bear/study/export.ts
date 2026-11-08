import {researchExport,pseudonym,type ResearchRow} from '../engine/research-export.ts';
import type {BearStore} from '../store/store.ts';
import {scoreSUS,scoreTLX} from './instruments.ts';

// The researcher's export: one participant row (pseudonymous counts) and one row per survey response
// (numbers only, with TLX and SUS scores). Only for participants who consented to THIS study and haven't
// withdrawn. No titles, names, documents, amounts or free text: there is no free text to export.
export interface ResponseRow{participant:string;phase:string;week:number;instrument:string;completedOn:string;score:number|null;answers:Record<string,number>}
export async function buildStudyExport(stores:BearStore[],o:{secret:string;studyId:string;today:string}):Promise<{participants:ResearchRow[];responses:ResponseRow[];excluded:number}>{
 if(!o.secret||o.secret.length<16)throw new Error('study_secret_required');
 const participants:ResearchRow[]=[];const responses:ResponseRow[]=[];let excluded=0;
 for(const s of stores){
  const p=(await s.list('profiles',{limit:1}))[0];const r=p?.research;
  if(!r?.consent||r.studyId!==o.studyId||r.withdrawnAt){excluded++;continue;}
  const row=await researchExport(s,o.secret,o.today);if(!row){excluded++;continue;}
  participants.push(row);const id=pseudonym(s.userId,o.secret);
  for(const x of (await s.list('study_responses')).filter(x=>x.studyId===o.studyId))
   responses.push({participant:id,phase:x.phase,week:x.week,instrument:x.instrument,completedOn:x.completedAt.slice(0,10),score:x.instrument==='tlx'?scoreTLX(x.answers):x.instrument==='sus'?scoreSUS(x.answers):null,answers:x.answers});
 }
 return {participants,responses,excluded};
}
const cell=(v:unknown)=>{const t=typeof v==='object'&&v!==null?JSON.stringify(v):String(v??'');return /[",\n]/.test(t)?`"${t.replace(/"/g,'""')}"`:t;};
export function toCSV(rows:Record<string,unknown>[]){if(!rows.length)return '';const keys=[...new Set(rows.flatMap(r=>Object.keys(r)))];return [keys.join(','),...rows.map(r=>keys.map(k=>cell(r[k])).join(','))].join('\n')+'\n';}
