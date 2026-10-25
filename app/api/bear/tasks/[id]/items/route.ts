import {z} from 'zod';
import {json,readJson,withBear} from '@/lib/bear/server/context';
import {setItemDone} from '@/lib/bear/services/task-edit';
export const dynamic='force-dynamic';
const schema=z.object({itemId:z.string().max(60).optional(),done:z.boolean().optional(),all:z.boolean().optional()}).strict();
export const POST=(req:Request,{params}:{params:Promise<{id:string}>})=>withBear(req,async({store})=>{const {id}=await params;return json(await setItemDone(store,id,schema.parse(await readJson(req))));});
