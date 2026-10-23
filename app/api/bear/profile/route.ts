import {json,readJson,withBear} from '@/lib/bear/server/context';
import {ensureProfile,profilePatchSchema,saveProfile} from '@/lib/bear/services/profile';
import {pushConfig} from '@/lib/bear/server/push';
export const dynamic='force-dynamic';
export const GET=(req:Request)=>withBear(req,async({store,user,aiAvailable})=>json({profile:await ensureProfile(store),user,aiAvailable,pushAvailable:!!pushConfig()}));
export const PUT=(req:Request)=>withBear(req,async({store})=>{const patch=profilePatchSchema.parse(await readJson(req));return json({profile:await saveProfile(store,patch)});});
