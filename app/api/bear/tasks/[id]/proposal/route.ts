import {z} from 'zod';
import {json,readJson,withBear} from '@/lib/bear/server/context';
import {resolveProposal} from '@/lib/bear/engine/proposals';
export const dynamic='force-dynamic';
const schema=z.object({accept:z.boolean()}).strict();
export const POST=(req:Request,{params}:{params:Promise<{id:string}>})=>withBear(req,async({store})=>{const {id}=await params;const {accept}=schema.parse(await readJson(req));return json({task:await resolveProposal(store,id,accept)});});
