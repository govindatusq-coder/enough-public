// Optional, occasional feedback on a suggestion (at most once a day, never after every interaction). Read cautiously:
// "not the right moment" says nothing about motivation. "Don't suggest this kind of thing" can be undone in Settings.
import {z} from 'zod';
import type {BearStore} from '../store/store.ts';
import {ensureProfile} from '../services/profile.ts';
import {FEEDBACK,learnFeedback} from './learning.ts';
import {attributesOf} from './attributes.ts';
import {statusOf} from '../rre/plan.ts';
export const feedbackSchema=z.object({taskId:z.string().uuid().nullable().default(null),kind:z.enum(FEEDBACK),strategy:z.enum(['allocate','prioritise','synchronise','adapt','match','offload','protect']).nullable().default(null)}).strict();
export const allowAgainSchema=z.object({pattern:z.string().max(40),domain:z.string().max(40)}).strict();
export async function giveFeedback(store:BearStore,input:z.infer<typeof feedbackSchema>,now=new Date()){
 const p=await ensureProfile(store);let pattern:string|null=null,domain:string|null=null;
 if(input.taskId){const t=await store.get('tasks',input.taskId);if(t?.rre){const a=attributesOf(t,t.rre,{status:statusOf(t.rre,t.status,now.toISOString().slice(0,10))});pattern=a.pattern;domain=a.domain;}}
 await store.update('profiles',p.id,{adaptive:learnFeedback(p.adaptive,input.kind,{strategy:input.strategy,pattern,domain},now.toISOString())});
 return {ok:true};
}
export async function allowAgain(store:BearStore,input:z.infer<typeof allowAgainSchema>){
 const p=await ensureProfile(store);const a=p.adaptive;if(!a)return {ok:true};
 await store.update('profiles',p.id,{adaptive:{...a,suppressed:a.suppressed.filter(s=>!(s.pattern===input.pattern&&s.domain===input.domain))}});return {ok:true};
}
