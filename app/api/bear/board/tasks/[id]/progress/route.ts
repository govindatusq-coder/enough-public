import {json,readJson,withBear} from '@/lib/bear/server/context';
import {progressSchema,saveProgress} from '@/lib/bear/board/service';
export const dynamic='force-dynamic';
export const PUT=(req:Request,{params}:{params:Promise<{id:string}>})=>withBear(req,async({store})=>{const {id}=await params;const t=await saveProgress(store,id,progressSchema.parse(await readJson(req)));return json({savedAt:t.progress?.savedAt||null});});
