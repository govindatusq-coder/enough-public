import {z} from 'zod';
import {json,readJson,withBear} from '@/lib/bear/server/context';
import {pushConfig} from '@/lib/bear/server/push';
import {stamp} from '@/lib/bear/store/store';
import type {PushSubscriptionRow} from '@/lib/bear/domain/types';
export const dynamic='force-dynamic';
const schema=z.object({endpoint:z.string().url().max(2000),keys:z.object({p256dh:z.string().min(10).max(500),auth:z.string().min(5).max(200)}).strict()}).strict();
export const GET=(req:Request)=>withBear(req,async({store})=>{const cfg=pushConfig();const subs=await store.list('push_subscriptions');return json({available:!!cfg,publicKey:cfg?.publicKey||null,subscriptions:subs.length});});
export const POST=(req:Request)=>withBear(req,async({store})=>{
 if(!pushConfig())return json({error:'Push notifications are not connected yet.'},503);
 const sub=schema.parse(await readJson(req));
 const existing=(await store.list('push_subscriptions',{where:[{column:'endpoint',value:sub.endpoint}]}))[0];
 if(existing)return json({subscription:existing});
 return json({subscription:await store.insert('push_subscriptions',stamp<PushSubscriptionRow>(store.userId,{endpoint:sub.endpoint,keys:sub.keys,userAgent:req.headers.get('user-agent')?.slice(0,200)||null}))},201);
});
export const DELETE=(req:Request)=>withBear(req,async({store})=>{const {endpoint}=z.object({endpoint:z.string().url()}).parse(await readJson(req));for(const s of await store.list('push_subscriptions',{where:[{column:'endpoint',value:endpoint}]}))await store.remove('push_subscriptions',s.id);return json({ok:true});});
