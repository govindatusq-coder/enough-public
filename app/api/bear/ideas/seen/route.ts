import {json,readJson,withBear} from '@/lib/bear/server/context';
import {markIdeasSeen,seenSchema} from '@/lib/bear/services/ideas';
export const dynamic='force-dynamic';
// Bear Ideas was opened and these ideas were on screen: they no longer count as new on the tab badge.
export const POST=(req:Request)=>withBear(req,async({store})=>{const {ids}=seenSchema.parse(await readJson(req));await markIdeasSeen(store,ids);return json({ok:true});});
