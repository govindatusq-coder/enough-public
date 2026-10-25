import {todayISO} from '../domain/dates.ts';
import {z} from 'zod';
import {areaKeys,dayModes,emptyMomentOptions,leadTimeOptions,nudgeToleranceOptions,personRoles,planningDetailOptions,proactiveOptions,rhythmKinds,toneOptions,weekdays,type Area,type DayMode,type Person,type Profile} from '../domain/types.ts';
import {areaLabels} from '../domain/labels.ts';
import {AU_TIMEZONE} from '../domain/dates.ts';
import {stamp,type BearStore} from '../store/store.ts';
import {recordBehaviour} from './behaviour.ts';

export {areaLabels,rhythmPresets} from '../domain/labels.ts';
export function defaultProfile(userId:string):Profile{
 return stamp<Profile>(userId,{name:'',onboardingComplete:false,onboardingStep:0,areas:[],people:[],
  pins:{preferences:{reminderLeadTime:'few_days',nudgeTolerance:'gentle',planningDetail:'a_few_steps',proactiveSuggestions:'sometimes',tone:'warm'},interests:[],needs:[],strengths:[]},
  lifeRhythm:{timezone:AU_TIMEZONE,blocks:[]},emptyMoments:[],notification:{pushEnabled:false,quietStartMinute:21*60+30,quietEndMinute:7*60,permission:'unknown'},
  dayMode:null,dayModeSetAt:null,demoOffered:false,revision:1});
}
export async function loadProfile(store:BearStore){const rows=await store.list('profiles',{limit:1});return rows[0]||null;}
export async function ensureProfile(store:BearStore){const existing=await loadProfile(store);if(existing)return existing;return store.insert('profiles',defaultProfile(store.userId));}

const block=z.object({id:z.string().min(1).max(60),kind:z.enum(rhythmKinds),label:z.string().trim().min(1).max(40),days:z.array(z.enum(weekdays)).max(7),startMinute:z.number().int().min(0).max(1439),endMinute:z.number().int().min(0).max(1439),capacity:z.enum(['none','low','some','good'])}).strict();
export const profilePatchSchema=z.object({
 name:z.string().trim().max(40).optional(),
 onboardingComplete:z.boolean().optional(),onboardingStep:z.number().int().min(0).max(20).optional(),
 areas:z.array(z.enum(areaKeys)).max(6).optional(),
 people:z.array(z.object({role:z.enum(personRoles),name:z.string().trim().max(40)}).strict()).max(20).optional(),
 pins:z.object({preferences:z.object({reminderLeadTime:z.enum(leadTimeOptions),nudgeTolerance:z.enum(nudgeToleranceOptions),planningDetail:z.enum(planningDetailOptions),autoSetup:z.boolean().optional(),proactiveSuggestions:z.enum(proactiveOptions),tone:z.enum(toneOptions)}).strict(),interests:z.array(z.string().max(60)).max(20),needs:z.array(z.string().max(60)).max(20),strengths:z.array(z.string().max(60)).max(20)}).strict().optional(),
 lifeRhythm:z.object({timezone:z.string().max(60),blocks:z.array(block).max(40)}).strict().optional(),
 emptyMoments:z.array(z.enum(emptyMomentOptions)).max(7).optional(),
 notification:z.object({pushEnabled:z.boolean(),quietStartMinute:z.number().int().min(0).max(1439),quietEndMinute:z.number().int().min(0).max(1439),permission:z.enum(['unknown','granted','denied'])}).strict().optional(),
 demoOffered:z.boolean().optional(),
}).strict();
export type ProfilePatch=z.infer<typeof profilePatchSchema>;

export async function saveProfile(store:BearStore,patch:ProfilePatch){
 const profile=await ensureProfile(store);
 const changedRhythm=patch.lifeRhythm&&JSON.stringify(patch.lifeRhythm)!==JSON.stringify(profile.lifeRhythm);
 const next=await store.update('profiles',profile.id,{...patch,revision:profile.revision+1});
 if(patch.areas)await syncAreas(store,patch.areas);
 if(patch.people)await syncPeople(store,patch.people);
 if(changedRhythm)await recordBehaviour(store,'rhythm_changed',{blocks:patch.lifeRhythm!.blocks.length});
 return next;
}
async function syncAreas(store:BearStore,keys:Profile['areas']){
 const existing=await store.list('areas');
 for(const key of keys){const row=existing.find(a=>a.key===key);if(!row)await store.insert('areas',stamp<Area>(store.userId,{key,label:areaLabels[key],archived:false}));else if(row.archived)await store.update('areas',row.id,{archived:false});}
 for(const row of existing)if(!keys.includes(row.key)&&!row.archived&&row.key!=='money')await store.update('areas',row.id,{archived:true});
}
async function syncPeople(store:BearStore,people:Profile['people']){
 const existing=await store.list('people');
 for(const p of people){const row=existing.find(e=>e.role===p.role&&e.name===p.name);if(!row)await store.insert('people',stamp<Person>(store.userId,{role:p.role,name:p.name,archived:false}));else if(row.archived)await store.update('people',row.id,{archived:false});}
 for(const row of existing)if(!people.some(p=>p.role===row.role&&p.name===row.name)&&!row.archived)await store.update('people',row.id,{archived:true});
}
export async function setDayMode(store:BearStore,mode:DayMode|null){
 const profile=await ensureProfile(store);
 const next=await store.update('profiles',profile.id,{dayMode:mode,dayModeSetAt:mode?new Date().toISOString():null});
 await recordBehaviour(store,'day_mode_set',{mode});return next;
}
export const dayModeSchema=z.object({mode:z.enum(dayModes).nullable()}).strict();
// Day mode is only trusted for the day it was set on.
export function activeDayMode(profile:Profile,todayIso:string):DayMode|null{if(!profile.dayMode||!profile.dayModeSetAt)return null;// Compare in the person's own time zone: a rating made at 9am in Sydney is still 'yesterday' in UTC.
 return todayISO(profile.lifeRhythm.timezone||'Australia/Sydney',new Date(profile.dayModeSetAt))===todayIso?profile.dayMode:null;}
