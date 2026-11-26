import {json,readJson,withBear} from '@/lib/bear/server/context';
import {allowAgain,allowAgainSchema,feedbackSchema,giveFeedback} from '@/lib/bear/adaptive/feedback';
export const dynamic='force-dynamic';
// Optional feedback on a suggestion (PUT), and "allow this kind of thing again" (DELETE body {pattern, domain}).
export const PUT=(req:Request)=>withBear(req,async({store})=>json(await giveFeedback(store,feedbackSchema.parse(await readJson(req,1024)))),{write:true});
export const DELETE=(req:Request)=>withBear(req,async({store})=>json(await allowAgain(store,allowAgainSchema.parse(await readJson(req,512)))),{write:true});
