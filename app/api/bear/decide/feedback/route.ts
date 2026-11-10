import {HttpError,json,readJson,withBear} from '@/lib/bear/server/context';
import {flags} from '@/lib/bear/flags';
import {recordDecisionFeedback} from '@/lib/bear/services/decision-feedback';
export const dynamic='force-dynamic';
// Labels only (what Bear said, what it should have said). Never the email.
export const POST=(req:Request)=>withBear(req,async({store})=>{
 if(!flags.decisions())throw new HttpError('Not available.',404);
 try{return json(await recordDecisionFeedback(store,await readJson(req,2*1024)));}
 catch(e){if(e instanceof HttpError)throw e;throw new HttpError('Check the details and try again.',400);}
},{write:true});
