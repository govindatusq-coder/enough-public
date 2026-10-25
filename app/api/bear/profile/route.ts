import {json,readJson,withBear} from '@/lib/bear/server/context';
import {activeDayMode,ensureProfile,profilePatchSchema,saveProfile} from '@/lib/bear/services/profile';
import {todayISO} from '@/lib/bear/domain/dates';
import {pushConfig} from '@/lib/bear/server/push';
export const dynamic='force-dynamic';
export const GET=(req:Request)=>withBear(req,async({store,user,aiAvailable})=>{const profile=await ensureProfile(store);return json({profile,user,aiAvailable,pushAvailable:!!pushConfig(),dayMode:activeDayMode(profile,todayISO(profile.lifeRhythm.timezone||'Australia/Sydney'))});});
export const PUT=(req:Request)=>withBear(req,async({store})=>{const patch=profilePatchSchema.parse(await readJson(req));return json({profile:await saveProfile(store,patch)});});
