import {json,withBear} from '@/lib/bear/server/context';
import {brainView} from '@/lib/bear/rre/service';
export const dynamic='force-dynamic';
export const GET=(req:Request)=>withBear(req,async({store})=>json(await brainView(store)));
