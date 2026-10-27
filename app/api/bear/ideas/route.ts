import {json,withBear} from '@/lib/bear/server/context';
import {bearIdeas,ideaEnabled} from '@/lib/bear/services/ideas';
export const dynamic='force-dynamic';
// Bear Ideas (bearIdeasIntelligenceV2): a few ideas chosen from every engine, or nothing.
export const GET=(req:Request)=>withBear(req,async({store})=>{if(!ideaEnabled())return json({legacy:true});const f=await bearIdeas(store);
 // Scores are internal: the page gets words and actions, never numbers.
 return json({ideas:f.ideas.map(({score:_s,...i})=>{void _s;return i;}),askCapacity:f.askCapacity,capacity:f.capacity});});
