import {json,readJson,withBear} from '@/lib/bear/server/context';
import {householdSchema,saveHousehold} from '@/lib/bear/board/household';
import {ensureProfile} from '@/lib/bear/services/profile';
export const dynamic='force-dynamic';
export const GET=(req:Request)=>withBear(req,async({store})=>json({people:(await ensureProfile(store)).household||[]}));
export const PUT=(req:Request)=>withBear(req,async({store})=>json({people:await saveHousehold(store,householdSchema.parse(await readJson(req)))}));
