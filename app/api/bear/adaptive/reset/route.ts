import {json,readJson,withBear} from '@/lib/bear/server/context';
import {resetAdaptive,resetSchema} from '@/lib/bear/adaptive/service';
export const dynamic='force-dynamic';
// Reset what Bear has learned (one store at a time, or all), or forget how her days work.
export const POST=(req:Request)=>withBear(req,async({store})=>json(await resetAdaptive(store,resetSchema.parse(await readJson(req,512)))),{write:true});
