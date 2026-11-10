import {HttpError,json,withBear} from '@/lib/bear/server/context';
import {calendarFileFor} from '@/lib/bear/services/calendar-file';
export const dynamic='force-dynamic';
// A calendar file for the person to open (iPhone, Mac, Outlook, Google all read it). Nothing is added to anyone's
// calendar by Bear. Only the signed-in person's own responsibility; 404 if it has no event date.
export const GET=(req:Request,{params}:{params:Promise<{id:string}>})=>withBear(req,async({store})=>{
 const {id}=await params;const f=await calendarFileFor(store,id);if(!f)throw new HttpError('Bear couldn’t find an event to add.',404);
 return new Response(f.ics,{headers:{'Content-Type':'text/calendar; charset=utf-8','Content-Disposition':`attachment; filename="${f.filename}"`,'Cache-Control':'private, no-store'}});
});
