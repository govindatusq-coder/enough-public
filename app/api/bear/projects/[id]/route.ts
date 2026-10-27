import {z} from 'zod';
import {json,readJson,withBear} from '@/lib/bear/server/context';
export const dynamic='force-dynamic';
const renameSchema=z.object({title:z.string().trim().min(1).max(80)}).strict();
// Rename a project (a heading from a brain dump, or any project). The to-dos keep their own names.
export const PATCH=(req:Request,{params}:{params:Promise<{id:string}>})=>withBear(req,async({store})=>{
 const {id}=await params;const {title}=renameSchema.parse(await readJson(req));
 const p=await store.get('projects',id);if(!p)return json({error:"Bear couldn't find that project."},404);
 return json({project:await store.update('projects',id,{title})});
});
