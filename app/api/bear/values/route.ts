import {json,readJson,withBear} from '@/lib/bear/server/context';
import {valuesMapSchema,valuesView} from '@/lib/bear/services/priority';
import {ensureProfile} from '@/lib/bear/services/profile';
export const dynamic='force-dynamic';
export const GET=(req:Request)=>withBear(req,async({store})=>json(await valuesView(store)));
export const PUT=(req:Request)=>withBear(req,async({store})=>{const valuesMap=valuesMapSchema.parse(await readJson(req));const p=await ensureProfile(store);await store.update('profiles',p.id,{valuesMap});return json(await valuesView(store));});
