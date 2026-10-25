import {z} from 'zod';
import {HttpError,json,readJson,withBear} from '@/lib/bear/server/context';
import {isValidTimeZone,setTimeZone} from '@/lib/bear/services/timezone';
export const dynamic='force-dynamic';
const schema=z.object({timeZone:z.string().max(60)}).strict();
export const POST=(req:Request)=>withBear(req,async({store})=>{const {timeZone}=schema.parse(await readJson(req));if(!isValidTimeZone(timeZone))throw new HttpError('That time zone is not one Bear knows.',400);return json(await setTimeZone(store,timeZone));});
