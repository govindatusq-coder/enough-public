import {json,readJson,withBear} from '@/lib/bear/server/context';
import {joinSchema,joinStudy,leaveSchema,leaveStudy,respondSchema,respondStudy,studyStatus,StudyError} from '@/lib/bear/study/service';
import {INSTRUMENTS} from '@/lib/bear/study/instruments';
export const dynamic='force-dynamic';
// Research study: status (and the questions that are due), join, answer, leave. Off unless enabled.
export const GET=(req:Request)=>withBear(req,async({store})=>{const s=await studyStatus(store);if(!s.available)return json({available:false});
 return json({...s,instruments:s.enrolled&&s.due?s.due.instruments.map(i=>INSTRUMENTS[i]):[]});});
export const POST=(req:Request)=>withBear(req,async({store})=>{
 const body=await readJson(req) as {action?:string};
 try{
  if(body.action==='join'){const {code,consent}=joinSchema.parse({code:(body as {code?:string}).code,consent:(body as {consent?:boolean}).consent});void consent;return json(await joinStudy(store,code));}
  if(body.action==='respond'){const {action:_a,...rest}=body as Record<string,unknown>;void _a;return json(await respondStudy(store,respondSchema.parse(rest)));}
  if(body.action==='leave')return json(await leaveStudy(store,leaveSchema.parse({deleteAnswers:(body as {deleteAnswers?:boolean}).deleteAnswers}).deleteAnswers));
  return json({error:'Unknown action.'},400);
 }catch(e){if(e instanceof StudyError)return json({error:e.message},400);throw e;}
});
