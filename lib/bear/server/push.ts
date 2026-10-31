import 'server-only';
import webpush from 'web-push';
// Web Push delivery. Configured only when VAPID keys exist; otherwise push is visibly off.
export function pushConfig(){const publicKey=process.env.BEAR_VAPID_PUBLIC_KEY,privateKey=process.env.BEAR_VAPID_PRIVATE_KEY,subject=process.env.BEAR_VAPID_SUBJECT;if(!publicKey||!privateKey||!subject)return null;return {publicKey,privateKey,subject};}
export async function sendPush(subscription:{endpoint:string;keys:{p256dh:string;auth:string}},payload:{title:string;body:string;url:string;tag:string}):Promise<'sent'|'gone'|'failed'>{
 const cfg=pushConfig();if(!cfg)return 'failed';
 webpush.setVapidDetails(cfg.subject,cfg.publicKey,cfg.privateKey);
 try{await webpush.sendNotification(subscription,JSON.stringify(payload),{TTL:6*3600,urgency:'normal'});return 'sent';}
 catch(error){const status=(error as {statusCode?:number}).statusCode;return status===404||status===410?'gone':'failed';}
}
