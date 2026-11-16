import {json,readJson,withBear} from '@/lib/bear/server/context';
import {z} from 'zod';
import {preferenceSchema,preferencesView,removePreference,setPreference} from '@/lib/bear/rre/service';
export const dynamic='force-dynamic';
export const GET=(req:Request)=>withBear(req,async({store})=>json({preferences:await preferencesView(store)}));
export const PUT=(req:Request)=>withBear(req,async({store})=>{await setPreference(store,preferenceSchema.parse(await readJson(req)));return json({preferences:await preferencesView(store)});});
export const DELETE=(req:Request)=>withBear(req,async({store})=>{const {id}=z.object({id:z.string().uuid()}).strict().parse(await readJson(req));await removePreference(store,id);return json({preferences:await preferencesView(store)});});
