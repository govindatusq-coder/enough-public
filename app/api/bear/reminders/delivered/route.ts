import {z} from 'zod';
import {json,readJson,withBear} from '@/lib/bear/server/context';
import {markDelivered} from '@/lib/bear/services/reminders';
export const dynamic='force-dynamic';
const schema=z.object({reminderId:z.string().uuid(),via:z.enum(['in_app','local'])}).strict();
export const POST=(req:Request)=>withBear(req,async({store})=>{const {reminderId,via}=schema.parse(await readJson(req));return json({reminder:await markDelivered(store,reminderId,via)});});
