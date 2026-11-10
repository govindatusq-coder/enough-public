import {json,withBear} from '@/lib/bear/server/context';
import {isConnected} from '@/lib/bear/calendar/accounts';
import {calendarDeps} from '@/lib/bear/server/calendar';
export const dynamic='force-dynamic';
// Is Outlook calendar available (switched on and fully set up), and has this person connected it? No tokens, no details.
export const GET=(req:Request)=>withBear(req,async({store})=>{const {cfg}=calendarDeps();return json({available:cfg.ready,connected:cfg.ready?await isConnected(store):false});});
