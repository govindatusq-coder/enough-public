import {json,readJson,withBear} from '@/lib/bear/server/context';
import {addOne,addSchema} from '@/lib/bear/board/service';
export const dynamic='force-dynamic';
export const POST=(req:Request)=>withBear(req,async({store})=>{const t=await addOne(store,addSchema.parse(await readJson(req)));return json({task:{id:t.id,title:t.title}},201);});
