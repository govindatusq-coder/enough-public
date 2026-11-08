// Resend receiving API (checked against Resend's docs): the email.received webhook carries metadata only;
// the body is GET https://api.resend.com/emails/receiving/{id} and attachments are listed at
// .../emails/receiving/{id}/attachments with a download_url valid for one hour.
export interface ReceivedEmail{text:string|null;html:string|null;subject:string|null}
export interface ReceivedAttachment{filename:string;contentType:string;size:number;downloadUrl:string}
export interface InboundMailProvider{
 getEmail(emailId:string):Promise<ReceivedEmail>;
 listAttachments(emailId:string):Promise<ReceivedAttachment[]>;
 download(url:string,maxBytes:number):Promise<Uint8Array>;
}
const API='https://api.resend.com';
export class ResendInbound implements InboundMailProvider{
 private apiKey:string;private f:typeof fetch;
 constructor(apiKey:string,f:typeof fetch=fetch){this.apiKey=apiKey;this.f=f;}
 private async get(path:string){const r=await this.f(`${API}${path}`,{headers:{Authorization:`Bearer ${this.apiKey}`,Accept:'application/json'}});if(!r.ok)throw new Error(`provider_${r.status}`);return r.json();}
 async getEmail(id:string){const j=await this.get(`/emails/receiving/${encodeURIComponent(id)}`);return {text:typeof j.text==='string'?j.text:null,html:typeof j.html==='string'?j.html:null,subject:typeof j.subject==='string'?j.subject:null};}
 async listAttachments(id:string){const j=await this.get(`/emails/receiving/${encodeURIComponent(id)}/attachments`);const list=Array.isArray(j.data)?j.data:[];
  return list.map((a:Record<string,unknown>)=>({filename:String(a.filename||'attachment'),contentType:String(a.content_type||''),size:Number(a.size||0),downloadUrl:String(a.download_url||'')}));}
 async download(url:string,maxBytes:number){
  // Only Resend's own HTTPS download hosts, and never more than the limit (checked while reading).
  const u=new URL(url);if(u.protocol!=='https:'||!/(^|\.)resend\.(com|app)$/.test(u.hostname))throw new Error('untrusted_download_host');
  const r=await this.f(url);if(!r.ok||!r.body)throw new Error(`download_${r.status}`);
  const len=Number(r.headers.get('content-length')||0);if(len>maxBytes)throw new Error('too_large');
  const reader=r.body.getReader();const chunks:Uint8Array[]=[];let total=0;
  for(;;){const {done,value}=await reader.read();if(done)break;total+=value.byteLength;if(total>maxBytes){await reader.cancel();throw new Error('too_large');}chunks.push(value);}
  const out=new Uint8Array(total);let o=0;for(const c of chunks){out.set(c,o);o+=c.byteLength;}return out;
 }
}
