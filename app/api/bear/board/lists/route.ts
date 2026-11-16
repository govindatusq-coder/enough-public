import {json,readJson,withBear} from '@/lib/bear/server/context';
import {listsSchema,saveLists} from '@/lib/bear/board/service';
import {listsOf,LIST_ICONS} from '@/lib/bear/board/logic';
import {ensureProfile} from '@/lib/bear/services/profile';
export const dynamic='force-dynamic';
export const GET=(req:Request)=>withBear(req,async({store})=>json({lists:listsOf(await ensureProfile(store)),icons:LIST_ICONS}));
export const PUT=(req:Request)=>withBear(req,async({store})=>json(await saveLists(store,listsSchema.parse(await readJson(req)))));
