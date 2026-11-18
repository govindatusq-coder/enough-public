import {z} from 'zod';
import {json,readJson,withBear} from '@/lib/bear/server/context';
import {trustedWrite} from '@/lib/public-auth';
import {triage,TriageError} from '@/lib/bear/services/triage-service';
import {researcherFromEnv} from '@/lib/bear/ai/web-lookup';
export const dynamic='force-dynamic';
// A long handwritten list can take a few minutes to read and file; the reading service watches its own time inside this.
export const maxDuration=300;
// Triage: photos, PDFs and pasted or forwarded emails, read by Claude's vision in one pass (no text extraction first), with
// the person's local date and family as anchors, returning ready-to-use action cards. The family profile and date are taken
// from the server's own records; anything the page sends for them is only a hint and is not trusted.
const MAX_ITEM=4.4*1024*1024;
const schema=z.object({
 inputs:z.array(z.object({kind:z.enum(['image','pdf','text']),mime:z.string().max(60),data:z.string().max(Math.ceil(MAX_ITEM*1.4)),name:z.string().max(200).optional()}).strict()).min(1).max(6),
 currentDateTime:z.string().max(80).optional(),timeZone:z.string().max(60).optional(),familyProfile:z.unknown().optional(),
}).strict();
const IMAGE=/^image\/(jpeg|png|webp|gif)$/;
const b64=(s:string)=>Buffer.from(s.replace(/^data:[^;]+;base64,/,''),'base64');
// Same-site only: a preflight from anywhere else is refused.
export function OPTIONS(req:Request){
 const ok=trustedWrite(req);const origin=req.headers.get('origin');
 return new Response(null,{status:ok?204:403,headers:ok&&origin?{'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Methods':'POST, OPTIONS','Access-Control-Allow-Headers':'Content-Type, Authorization','Access-Control-Max-Age':'600',Vary:'Origin'}:{Vary:'Origin'}});
}
export const POST=(req:Request)=>withBear(req,async({store,provider})=>{
 const body=schema.safeParse(await readJson(req,5*1024*1024));
 if(!body.success)return json({error:'Bear couldn’t read what was sent. Try again.',code:'bad_request',issues:body.error.issues.slice(0,3).map(i=>i.path.join('.'))},400);
 const images:{mime:string;bytes:Uint8Array}[]=[];const documents:{mime:string;bytes:Uint8Array}[]=[];const texts:string[]=[];
 for(const i of body.data.inputs){
  if(i.kind==='text'){texts.push(i.data.slice(0,60000));continue;}
  const bytes=new Uint8Array(b64(i.data));if(!bytes.length)continue;if(bytes.length>MAX_ITEM)return json({error:'One of those files is too big. Try a smaller photo or fewer pages.',code:'too_large'},413);
  if(i.kind==='image'&&IMAGE.test(i.mime))images.push({mime:i.mime,bytes});
  else if(i.kind==='pdf'&&i.mime==='application/pdf'&&bytes[0]===0x25)documents.push({mime:'application/pdf',bytes});
  else return json({error:'Bear can read photos (JPEG, PNG, WebP) and PDFs.',code:'unsupported'},415);
 }
 try{return json(await triage(store,provider,{images,documents,text:texts.join('\n\n')||null},new Date(),researcherFromEnv()),201);}
 // No AI key is an expected state, not a failure: said plainly with 200 so the app can use its older reading quietly.
 catch(e){if(e instanceof TriageError)return json({error:e.message,code:e.code},e.code==='missing_key'?200:e.status);throw e;}
},{write:true});
