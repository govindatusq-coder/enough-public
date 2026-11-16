import {json,readJson,withBear} from '@/lib/bear/server/context';
import {z} from 'zod';
import {openTasks,timeZoneOf} from '@/lib/bear/board/service';
import {pickMoments} from '@/lib/bear/board/logic';
import {todayISO} from '@/lib/bear/domain/dates';
export const dynamic='force-dynamic';
// "I've got 10 minutes": up to three things that fit, can move right now, and suit the hour.
export const POST=(req:Request)=>withBear(req,async({store})=>{
 const {minutes}=z.object({minutes:z.number().int().min(1).max(240)}).strict().parse(await readJson(req));
 const now=new Date();const zone=await timeZoneOf(store);
 return json({minutes,...pickMoments(await openTasks(store),minutes,now,zone,todayISO(zone,now))});
});
