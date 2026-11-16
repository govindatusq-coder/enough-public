import {json,withBear} from '@/lib/bear/server/context';
import {giveToBear} from '@/lib/bear/rre/service';
export const dynamic='force-dynamic';export const maxDuration=60;
// Give it to Bear: Bear prepares its part (it never buys, sends, books or submits), then it's her turn.
export const POST=(req:Request,{params}:{params:Promise<{id:string}>})=>withBear(req,async({store,provider})=>{const {id}=await params;return json(await giveToBear(store,provider,id));});
