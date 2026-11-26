import {json,readJson,withBear} from '@/lib/bear/server/context';
import {adaptiveView,saveAnswers,saveAnswersSchema} from '@/lib/bear/adaptive/service';
export const dynamic='force-dynamic';
// How her days work (onboarding and Settings): GET what Bear has, POST her answers (scored on the server, deterministically).
export const GET=(req:Request)=>withBear(req,async({store})=>json(await adaptiveView(store)));
export const POST=(req:Request)=>withBear(req,async({store})=>json(await saveAnswers(store,saveAnswersSchema.parse(await readJson(req,4096)))),{write:true});
