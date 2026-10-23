import {json,readJson,withBear} from '@/lib/bear/server/context';
import {completeSchema,completeTask} from '@/lib/bear/services/completion';
export const dynamic='force-dynamic';
export const POST=(req:Request,{params}:{params:Promise<{id:string}>})=>withBear(req,async({store})=>{const {id}=await params;const input=completeSchema.parse({...await readJson(req),taskId:id});return json(await completeTask(store,input),201);});
