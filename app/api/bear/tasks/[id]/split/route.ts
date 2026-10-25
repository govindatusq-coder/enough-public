import {z} from 'zod';
import {json,readJson,withBear} from '@/lib/bear/server/context';
import {splitIntoPurchases} from '@/lib/bear/services/task-edit';
export const dynamic='force-dynamic';
const schema=z.object({parts:z.number().int().min(2).max(6)}).strict();
export const POST=(req:Request,{params}:{params:Promise<{id:string}>})=>withBear(req,async({store})=>{const {id}=await params;return json(await splitIntoPurchases(store,id,schema.parse(await readJson(req)).parts),201);});
