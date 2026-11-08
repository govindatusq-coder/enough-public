import {createHmac,timingSafeEqual} from 'node:crypto';

// Reference integration for an employee-benefits platform (Employment Hero is the reference commercial
// case, NOT a technical dependency). No vendor API is assumed: the platform talks to Load Bear's v1 API,
// and this adapter interface is what a real connector would implement once a partner provides access.
export interface BenefitsPlatformAdapter{
 name:string;
 provisionEmployee(externalId:string):Promise<{ok:boolean}>;
 deprovisionEmployee(externalId:string):Promise<{ok:boolean}>;
 launchUrl(externalId:string):Promise<string>;
 usageReport():Promise<unknown>;
}
// Launch tokens: short-lived (5 min), HMAC-signed, single subject. The platform's app opens
// /bear/launch?token=… and Load Bear exchanges it for a session (exchange not wired yet: needs a partner
// SSO decision, see docs/acquisition/INTEGRATION_GUIDE.md).
export function signLaunch(secret:string,tenantId:string,externalId:string,nowMs=Date.now(),ttlMs=5*60_000){
 const payload=Buffer.from(JSON.stringify({t:tenantId,s:externalId,exp:nowMs+ttlMs})).toString('base64url');
 return `${payload}.${createHmac('sha256',secret).update(payload).digest('base64url')}`;
}
export function verifyLaunch(secret:string,token:string,nowMs=Date.now()):{tenantId:string;externalId:string}|null{
 const [payload,sig]=token.split('.');if(!payload||!sig)return null;
 const exp=Buffer.from(createHmac('sha256',secret).update(payload).digest('base64url'));const got=Buffer.from(sig);
 if(exp.length!==got.length||!timingSafeEqual(exp,got))return null;
 try{const p=JSON.parse(Buffer.from(payload,'base64url').toString());if(typeof p.exp!=='number'||p.exp<nowMs)return null;return {tenantId:String(p.t),externalId:String(p.s)};}catch{return null;}
}
// A MOCK connector for demonstrations and tests only. It calls the real v1 API handler in-process.
export class MockBenefitsPlatform implements BenefitsPlatformAdapter{
 name='Mock benefits platform (demo only)';
 private call:(method:string,path:string,body?:unknown)=>Promise<{status:number;body:unknown}>;private secret:string;private tenantId:string;private base:string;
 constructor(o:{call:(method:string,path:string,body?:unknown)=>Promise<{status:number;body:unknown}>;launchSecret:string;tenantId:string;baseUrl:string}){this.call=o.call;this.secret=o.launchSecret;this.tenantId=o.tenantId;this.base=o.baseUrl;}
 async provisionEmployee(externalId:string){return {ok:(await this.call('POST','/api/v1/members',{externalId})).status===201};}
 async deprovisionEmployee(externalId:string){return {ok:(await this.call('DELETE',`/api/v1/members/${encodeURIComponent(externalId)}`)).status===200};}
 async launchUrl(externalId:string){return `${this.base}/bear/launch?token=${signLaunch(this.secret,this.tenantId,externalId)}`;}
 async usageReport(){return (await this.call('GET','/api/v1/reports/usage')).body;}
}
