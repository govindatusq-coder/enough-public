import {z} from 'zod';
import {json,readJson,withBear} from '@/lib/bear/server/context';
import {actOnLoad} from '@/lib/bear/services/load';
export const dynamic='force-dynamic';
const actSchema=z.object({stepId:z.string().min(1).max(200),evidence:z.string().max(120).nullable().optional()}).strict();
// The person did the one thing that needed them (or answered Bear's one question).
export const POST=(req:Request,{params}:{params:Promise<{id:string}>})=>withBear(req,async({store})=>{
 const {id}=await params;const input=actSchema.parse(await readJson(req));
 try{const r=await actOnLoad(store,id,input);return json({view:r.view,said:r.said,done:r.task.status==='done',win:r.win});}
 catch(e){if((e as Error).message==='not_found'||(e as Error).message==='step_not_found')return json({error:"Bear couldn't find that."},404);throw e;}
});
