import {json,withBear} from '@/lib/bear/server/context';
import {seedDemo} from '@/lib/bear/services/demo';
export const dynamic='force-dynamic';
export const POST=(req:Request)=>withBear(req,async({store})=>json(await seedDemo(store),201));
