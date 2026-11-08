import {z} from 'zod';
import {json,readJson,withBear} from '@/lib/bear/server/context';
import {coverageView,setCoverage} from '@/lib/bear/coverage/coverage-service';
export const dynamic='force-dynamic';
export const GET=(req:Request)=>withBear(req,async({store})=>json(await coverageView(store)));
const schema=z.object({pack:z.enum(['school']),active:z.boolean()}).strict();
// Only full packs can be switched on; definitions do nothing yet, so there is nothing to switch.
export const POST=(req:Request)=>withBear(req,async({store})=>{const {pack,active}=schema.parse(await readJson(req));await setCoverage(store,pack,active);return json(await coverageView(store));});
