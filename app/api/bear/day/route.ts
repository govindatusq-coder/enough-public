import {json,readJson,withBear} from '@/lib/bear/server/context';
import {dayModeSchema,setDayMode} from '@/lib/bear/services/profile';
import {dayModeReply} from '@/lib/bear/domain/copy';
export const dynamic='force-dynamic';
export const POST=(req:Request)=>withBear(req,async({store})=>{const {mode}=dayModeSchema.parse(await readJson(req));const profile=await setDayMode(store,mode);return json({profile,reply:mode?dayModeReply[mode]:null});});
