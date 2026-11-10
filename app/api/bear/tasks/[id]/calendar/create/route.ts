import {HttpError,json,readJson,withBear} from '@/lib/bear/server/context';
import {approveCalendarAdd,requestCalendarAdd} from '@/lib/bear/calendar/service';
import {calendarDeps} from '@/lib/bear/server/calendar';
export const dynamic='force-dynamic';
export const maxDuration=30;
// Two steps, both derived from the saved task (never from what the browser sends):
//  {step:'request'} shows exactly what Bear would add and records that the person was asked;
//  {step:'approve'} is only honoured for those exact details, and only then adds the event.
export const POST=(req:Request,{params}:{params:Promise<{id:string}>})=>withBear(req,async({store})=>{
 const d=calendarDeps();if(!d.cfg.ready)throw new HttpError('Outlook calendar isn’t set up yet.',404);
 const {id}=await params;const body=await readJson(req,1024) as {step?:string};
 if(body.step==='request')return json(await requestCalendarAdd(store,id,d));
 if(body.step==='approve')return json(await approveCalendarAdd(store,id,d));
 throw new HttpError('Check the details and try again.',400);
},{write:true});
