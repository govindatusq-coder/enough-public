import {json,readJson,withBear} from '@/lib/bear/server/context';
import {respondSchema,respondToSuggestion} from '@/lib/bear/services/suggestions';
export const dynamic='force-dynamic';
export const POST=(req:Request)=>withBear(req,async({store})=>json({suggestion:await respondToSuggestion(store,respondSchema.parse(await readJson(req)))}));
