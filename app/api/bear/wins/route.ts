import {json,withBear} from '@/lib/bear/server/context';
import {winsView} from '@/lib/bear/services/wins';
export const dynamic='force-dynamic';
export const GET=(req:Request)=>withBear(req,async({store})=>json(await winsView(store)));
