import {z} from 'zod';
import {json,readJson,withBear} from '@/lib/bear/server/context';
export const dynamic='force-dynamic';
// Edit a project: its name, how much it matters (importance, not priority; null = Bear decide),
// what it mainly does for the person (null = Bear decide), and pause/unpause. The to-dos keep their own names.
const editSchema=z.object({title:z.string().trim().min(1).max(80).optional(),importance:z.enum(['very','nice','not']).nullable().optional(),role:z.enum(['progress','maintain','prevent','restore']).nullable().optional(),paused:z.boolean().optional()}).strict();
export const PATCH=(req:Request,{params}:{params:Promise<{id:string}>})=>withBear(req,async({store})=>{
 const {id}=await params;const patch=editSchema.parse(await readJson(req));
 const p=await store.get('projects',id);if(!p)return json({error:"Bear couldn't find that project."},404);
 // The person's own say resets the squeezed-out count: it's a fresh plan.
 const reset=patch.importance!==undefined||patch.paused!==undefined?{strategicDeferrals:0}:{};
 return json({project:await store.update('projects',id,{...patch,...reset})});
});
