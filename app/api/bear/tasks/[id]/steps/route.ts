import {HttpError,json,readJson,withBear} from '@/lib/bear/server/context';
import {addStep,removeStep,stepSchema} from '@/lib/bear/services/task-edit';
export const dynamic='force-dynamic';
export const POST=(req:Request,{params}:{params:Promise<{id:string}>})=>withBear(req,async({store})=>{const {id}=await params;return json({step:await addStep(store,id,stepSchema.parse(await readJson(req)).title)},201);});
export const DELETE=(req:Request,{params}:{params:Promise<{id:string}>})=>withBear(req,async({store})=>{const {id}=await params;const step=new URL(req.url).searchParams.get('step');if(!step)throw new HttpError('Say which step.',400);await removeStep(store,id,step);return json({ok:true});});
