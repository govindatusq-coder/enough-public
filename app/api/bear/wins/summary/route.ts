import {json,withBear} from '@/lib/bear/server/context';
import {myWins} from '@/lib/bear/services/my-wins';
export const dynamic='force-dynamic';
// My Wins: how many things she has finished (this week, this month, all time) and the latest ones.
export const GET=(req:Request)=>withBear(req,async({store})=>json(await myWins(store)));
