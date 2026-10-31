import {json,readJson,withBear} from '@/lib/bear/server/context';
import {acceptPlan,acceptPlanSchema} from '@/lib/bear/services/reminder-planning';
export const dynamic='force-dynamic';
export const POST=(req:Request,{params}:{params:Promise<{id:string}>})=>withBear(req,async({store})=>{const {id}=await params;const input=acceptPlanSchema.parse({...await readJson(req),taskId:id});return json({reminders:await acceptPlan(store,input)},201);});
