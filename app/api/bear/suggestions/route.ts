import {json,withBear} from '@/lib/bear/server/context';
import {refreshSuggestions} from '@/lib/bear/services/suggestions';
export const dynamic='force-dynamic';
export const GET=(req:Request)=>withBear(req,async({store})=>json({suggestions:await refreshSuggestions(store)}));
