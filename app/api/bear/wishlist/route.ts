import {json,withBear} from '@/lib/bear/server/context';
import {wishlistView} from '@/lib/bear/services/task-edit';
export const dynamic='force-dynamic';
export const GET=(req:Request)=>withBear(req,async({store})=>json(await wishlistView(store)));
