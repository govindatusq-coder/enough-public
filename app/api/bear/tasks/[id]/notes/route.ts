import {HttpError,json,withBear} from '@/lib/bear/server/context';
export const dynamic='force-dynamic';
// The person has read the notes about what changed: clear them.
export const POST=(req:Request,{params}:{params:Promise<{id:string}>})=>withBear(req,async({store})=>{
 const {id}=await params;const t=await store.get('tasks',id);if(!t)throw new HttpError('Bear couldn’t find that.',404);
 return json({task:await store.update('tasks',id,{changeNotes:[]})});
},{write:true});
