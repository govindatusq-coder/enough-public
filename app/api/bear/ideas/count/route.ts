import {json,withBear} from '@/lib/bear/server/context';
import {ideasCount} from '@/lib/bear/services/ideas';
export const dynamic='force-dynamic';
// The Bear Ideas tab badge: the same ideas the page shows, counted fresh every time.
export const GET=(req:Request)=>withBear(req,async({store})=>json({count:await ideasCount(store)}));
