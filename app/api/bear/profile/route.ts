import {json,readJson,withBear} from '@/lib/bear/server/context';
import {activeDayMode,ensureProfile,profilePatchSchema,saveProfile} from '@/lib/bear/services/profile';
import {todayISO} from '@/lib/bear/domain/dates';
import {pushConfig} from '@/lib/bear/server/push';
export const dynamic='force-dynamic';
export const GET=(req:Request)=>withBear(req,async({store,user,aiAvailable})=>{let profile=await ensureProfile(store);
 // The name she gave when signing up is her name in Bear too, so it's never asked twice.
 if(!profile.name?.trim()&&user.name?.trim())profile=await saveProfile(store,{name:user.name.trim().slice(0,40)});return json({profile,user,emailConfirmed:!!profile.emailVerifiedAt||!!user.emailConfirmed||!user.email||user.email.endsWith('.local'),aiAvailable,pushAvailable:!!pushConfig(),dayMode:activeDayMode(profile,todayISO(profile.lifeRhythm.timezone||'Australia/Sydney'))});});
export const PUT=(req:Request)=>withBear(req,async({store})=>{const patch=profilePatchSchema.parse(await readJson(req));return json({profile:await saveProfile(store,patch)});});
