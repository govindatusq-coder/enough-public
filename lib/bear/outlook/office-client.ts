'use client';
// Browser-only glue for Bear in Outlook: loading Microsoft's Office.js, reading the open email, and the
// add-in's own sign-in. The add-in keeps its OWN Bear session (made in the sign-in popup), separate from
// the browser's, so it works however Outlook treats cookies and never disturbs Bear in a normal tab.
import {createClient,type SupabaseClient} from '@supabase/supabase-js';
import {base64ToBytes,mimeOf,type OutlookAttachment,type OutlookItem} from './item.ts';

declare global{interface Window{Office?:any}}
import {OFFICE_JS} from './boot.ts';

let loading:Promise<boolean>|null=null;
// The pages start loading Office.js the moment they open (see OFFICE_BOOT); this waits for it. True when
// running inside Outlook. (Office.js removes history.pushState/replaceState, which Next.js needs; the boot
// script guards them, and they're put back here too in case it didn't run.)
export function loadOffice(timeoutMs=10000):Promise<boolean>{
 if(loading)return loading;
 loading=new Promise(resolve=>{
  const keep={push:history.pushState,replace:history.replaceState};
  const restore=()=>{if(typeof history.pushState!=='function')history.pushState=keep.push;if(typeof history.replaceState!=='function')history.replaceState=keep.replace;};
  let done=false;const finish=(v:boolean)=>{if(done)return;done=true;clearTimeout(timer);restore();resolve(v);};
  const timer=setTimeout(()=>finish(false),timeoutMs);
  const ready=()=>{try{window.Office.onReady((info:{host?:string}|undefined)=>finish(info?.host==='Outlook'||!!window.Office?.context?.mailbox));}catch{finish(false);}};
  if(window.Office){ready();return;}
  let s=document.getElementById('office-js') as HTMLScriptElement|null;
  if(!s){s=document.createElement('script');s.id='office-js';s.src=OFFICE_JS;document.head.appendChild(s);}
  s.addEventListener('load',ready);s.addEventListener('error',()=>finish(false));
  // It may have finished loading before this ran.
  const poll=setInterval(()=>{if(window.Office){clearInterval(poll);ready();}else if(done)clearInterval(poll);},100);
 });
 return loading;
}
const mailbox=()=>window.Office?.context?.mailbox;
export const supports=(set:string,version:string)=>{try{return !!window.Office?.context?.requirements?.isSetSupported(set,version);}catch{return false;}};

export async function readOpenItem():Promise<{id:string|null;item:OutlookItem;attachments:OutlookAttachment[]}|null>{
 const it=mailbox()?.item;if(!it)return null;
 const body=await new Promise<string>(resolve=>{try{it.body.getAsync(window.Office.CoercionType.Text,(r:any)=>resolve(r?.status==='succeeded'?String(r.value||''):''));}catch{resolve('');}});
 const from=it.from?(it.from.displayName&&it.from.emailAddress&&it.from.displayName!==it.from.emailAddress?`${it.from.displayName} <${it.from.emailAddress}>`:it.from.emailAddress||it.from.displayName):null;
 const created=it.dateTimeCreated instanceof Date?it.dateTimeCreated.toISOString():null;
 const attachments=(Array.isArray(it.attachments)?it.attachments:[]).map((a:any)=>({id:String(a.id),name:String(a.name||'attachment'),contentType:a.contentType||null,size:Number(a.size)||0,isInline:!!a.isInline,attachmentType:a.attachmentType||null}));
 return {id:it.itemId||null,item:{subject:typeof it.subject==='string'?it.subject:null,from,received:created,body},attachments};
}
export function onItemChanged(cb:()=>void){
 try{mailbox()?.addHandlerAsync(window.Office.EventType.ItemChanged,cb);}catch{/* pinning not supported: one email per pane */}
 return()=>{try{mailbox()?.removeHandlerAsync(window.Office.EventType.ItemChanged);}catch{/* nothing to remove */}};
}
// Attachment bytes need Mailbox 1.8; on older Outlooks Bear says so instead of pretending.
export const canReadAttachments=()=>supports('Mailbox','1.8');
export async function attachmentFile(a:OutlookAttachment):Promise<File|null>{
 const it=mailbox()?.item;if(!it||!canReadAttachments())return null;
 return new Promise(resolve=>{try{it.getAttachmentContentAsync(a.id,(r:any)=>{
  if(r?.status!=='succeeded'||r.value?.format!=='base64'){resolve(null);return;}
  try{const bytes=base64ToBytes(String(r.value.content||''));resolve(new File([bytes],a.name,{type:mimeOf(a)}));}catch{resolve(null);}
 });}catch{resolve(null);}});
}
// Opens a reply window with the draft filled in. The person reads, edits and sends it; Bear never sends.
export function showReplyDraft(html:string){
 try{const it=mailbox()?.item;if(!it?.displayReplyForm)return false;it.displayReplyForm(html);return true;}catch{return false;}
}
export const canShowReply=()=>{try{return typeof mailbox()?.item?.displayReplyForm==='function';}catch{return false;}};
export function openInBrowser(url:string){
 try{if(window.Office?.context?.ui?.openBrowserWindow){window.Office.context.ui.openBrowserWindow(url);return;}}catch{/* fall through */}
 window.open(url,'_blank','noopener');
}

// ---------- the add-in's own session ----------
const memory=new Map<string,string>();
const storage={
 getItem:(k:string)=>{try{return localStorage.getItem(k);}catch{return memory.get(k)??null;}},
 setItem:(k:string,v:string)=>{try{localStorage.setItem(k,v);}catch{memory.set(k,v);}},
 removeItem:(k:string)=>{try{localStorage.removeItem(k);}catch{memory.delete(k);}},
};
export const authConfigured=()=>!!process.env.NEXT_PUBLIC_SUPABASE_URL&&!!process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
let client:SupabaseClient|null=null;
export function addinAuth(){
 if(!authConfigured())return null;
 client??=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,{auth:{storageKey:'bear-outlook-session',storage,persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}});
 return client;
}
// The sign-in popup's client never stores anything: it signs in, hands the session to the pane, and closes.
export function popupAuth(){
 if(!authConfigured())return null;
 return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
}
export async function accessToken():Promise<string|null>{const a=addinAuth();if(!a)return null;const {data}=await a.auth.getSession();return data.session?.access_token||null;}

// Opens the sign-in popup and resolves once it hands back a session (or the person closes it).
export function signInWithPopup(origin:string):Promise<'signed_in'|'closed'|'blocked'>{
 return new Promise(resolve=>{
  const ui=window.Office?.context?.ui;if(!ui?.displayDialogAsync){resolve('blocked');return;}
  ui.displayDialogAsync(origin+'/bear/outlook/connect',{height:70,width:35,promptBeforeOpen:false},(res:any)=>{
   if(res?.status!=='succeeded'){resolve('blocked');return;}
   const dialog=res.value;
   dialog.addEventHandler(window.Office.EventType.DialogMessageReceived,async(arg:any)=>{
    let msg:{type?:string;access_token?:string;refresh_token?:string}={};try{msg=JSON.parse(arg.message);}catch{/* ignore */}
    try{dialog.close();}catch{/* already closed */}
    if(msg.type==='bear-session'&&msg.access_token&&msg.refresh_token){const a=addinAuth();const r=await a?.auth.setSession({access_token:msg.access_token,refresh_token:msg.refresh_token});resolve(r&&!r.error?'signed_in':'closed');}
    else resolve('closed');
   });
   dialog.addEventHandler(window.Office.EventType.DialogEventReceived,()=>resolve('closed'));
  });
 });
}
export function sendToPane(message:Record<string,string>){try{window.Office?.context?.ui?.messageParent(JSON.stringify(message));return true;}catch{return false;}}
