import {json,withBear} from '@/lib/bear/server/context';
import {rejectCapture} from '@/lib/bear/services/capture';
export const dynamic='force-dynamic';
export const POST=(req:Request,{params}:{params:Promise<{id:string}>})=>withBear(req,async({store})=>{const {id}=await params;return json({capture:await rejectCapture(store,id)});});
