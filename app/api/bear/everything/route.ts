import {json,withBear} from '@/lib/bear/server/context';
import {everythingView} from '@/lib/bear/services/everything';
export const dynamic='force-dynamic';
export const GET=(req:Request)=>withBear(req,async({store})=>json(await everythingView(store)));
