import {json,readJson,withBear} from '@/lib/bear/server/context';
import {moveSchema,moveTask} from '@/lib/bear/board/service';
export const dynamic='force-dynamic';
export const POST=(req:Request,{params}:{params:Promise<{id:string}>})=>withBear(req,async({store})=>{const {id}=await params;const t=await moveTask(store,id,moveSchema.parse(await readJson(req)));return json({task:{id:t.id,listId:t.listId??null}});});
