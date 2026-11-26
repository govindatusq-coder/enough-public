// Adaptive Responsibility Engine: what Bear can actually do, checked before it offers to do anything.
// When something isn't available, Bear prepares the closest useful thing instead, and never pretends an outside action
// happened. Outside actions need her approval, run once (idempotency keys), and report what proves they happened.
export interface Capability{id:string;label:string;available:boolean;external:boolean;needsApproval:boolean;reversible:boolean;
 output:string;evidence:string|null;fallback:string|null;why:string}
export interface CapabilityContext{env?:Record<string,string|undefined>;outlookConnected?:boolean;aiAvailable?:boolean}

export function capabilities(ctx:CapabilityContext={}):Capability[]{
 const env=ctx.env||{};
 // Same rule as Share Bear's own texting (lib/bear/sharebear/sms.ts smsFromEnv); only names are read, never the secrets' values.
 const sms=env.SHARE_BEAR_SMS==='mock'||(!env.NEXT_PUBLIC_SUPABASE_URL&&env.SHARE_BEAR_SMS!=='twilio')?'mock':env.TWILIO_ACCOUNT_SID&&env.TWILIO_AUTH_TOKEN&&env.TWILIO_FROM?'twilio':'none';
 const C=(c:Capability)=>c;
 return [
  C({id:'draft_email',label:'Draft an email or message',available:true,external:false,needsApproval:false,reversible:true,output:'A draft she can edit',evidence:null,fallback:null,why:'Bear writes drafts; she sends them.'}),
  C({id:'send_email',label:'Send an email',available:false,external:true,needsApproval:true,reversible:false,output:'A sent email',evidence:'Provider message id',fallback:'draft_email',why:'No email account is connected for sending. Bear opens her Mail with the draft instead.'}),
  C({id:'read_calendar',label:'Read her calendar',available:!!ctx.outlookConnected,external:true,needsApproval:false,reversible:true,output:'Busy times',evidence:null,fallback:null,why:ctx.outlookConnected?'Outlook is connected.':'No calendar is connected.'}),
  C({id:'propose_calendar_event',label:'Suggest a time',available:true,external:false,needsApproval:false,reversible:true,output:'A suggested time she can add',evidence:null,fallback:null,why:'Bear suggests; nothing is added until she says.'}),
  C({id:'create_calendar_event',label:'Add to her calendar',available:!!ctx.outlookConnected,external:true,needsApproval:true,reversible:true,output:'A calendar event',evidence:'Calendar event id',fallback:'propose_calendar_event',why:ctx.outlookConnected?'Outlook is connected; she approves each one.':'No calendar is connected; a calendar file can be downloaded instead.'}),
  C({id:'extract_document',label:'Read photos, PDFs and emails',available:!!ctx.aiAvailable,external:false,needsApproval:false,reversible:true,output:'Tasks and dates from the document',evidence:null,fallback:null,why:ctx.aiAvailable?'The AI service is connected.':'The AI service isn’t connected; typed text still works.'}),
  C({id:'prepare_form',label:'Prepare a form',available:true,external:false,needsApproval:false,reversible:true,output:'What to fill in, ready to copy',evidence:null,fallback:null,why:'Bear prepares; she submits.'}),
  C({id:'send_message',label:'Text someone for her',available:sms==='twilio'||sms==='mock',external:true,needsApproval:true,reversible:false,output:'A sent text',evidence:'Provider message id',fallback:'draft_email',why:sms==='twilio'?'Texting is set up; she approves each one.':sms==='mock'?'Test mode: nothing is really sent.':'Texting isn’t set up; her Messages app opens with the text ready.'}),
  C({id:'request_transfer',label:'Ask someone to take it on (Share Bear)',available:true,external:true,needsApproval:true,reversible:true,output:'A request they can accept or decline',evidence:'Their answer on the request page',fallback:null,why:'It’s only theirs once they accept.'}),
  C({id:'monitor_responses',label:'Follow up and watch for answers',available:true,external:false,needsApproval:false,reversible:true,output:'Reminders and news when things change',evidence:null,fallback:null,why:'The scheduled job checks every 15 minutes.'}),
  C({id:'search_information',label:'Look things up',available:!!ctx.aiAvailable&&env.BEAR_WEB_LOOKUP==='1',external:false,needsApproval:false,reversible:true,output:'Options with where they came from',evidence:null,fallback:null,why:'Only when web look-ups are switched on.'}),
  C({id:'make_purchase',label:'Buy something',available:false,external:true,needsApproval:true,reversible:false,output:'An order',evidence:'Order confirmation',fallback:'draft_email',why:'Bear never buys anything. It finds options and she orders.'}),
  C({id:'make_payment',label:'Pay a bill',available:false,external:true,needsApproval:true,reversible:false,output:'A payment',evidence:'Receipt',fallback:'prepare_form',why:'Bear never pays. It gets the details ready.'}),
 ];
}
export const can=(caps:Capability[],id:string)=>!!caps.find(c=>c.id===id)?.available;
