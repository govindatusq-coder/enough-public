// Outlook hosts allowed to show Bear's add-in pages in their task pane (Outlook on the web, new Outlook (also on outlook.cloud.microsoft),
// Outlook.com). Only /bear/outlook pages get this; everything else can't be framed at all.
export const OUTLOOK_FRAME_ANCESTORS=['https://outlook.office.com','https://outlook.office365.com','https://outlook.live.com','https://*.outlook.com','https://*.office.com','https://*.office365.com','https://*.office.net','https://*.officeapps.live.com','https://*.live.com','https://*.microsoft','https://*.microsoft.com'];
export const OFFICE_JS_ORIGIN='https://appsforoffice.microsoft.com';
// Everything Office.js itself loads: its own files (old and new Microsoft addresses), MicrosoftAjax.js
// (without which Office.js can't start inside Outlook) and Microsoft's sign-in library.
export const OFFICE_SCRIPT_ORIGINS=[OFFICE_JS_ORIGIN,'https://officeapis.public.onecdn.static.microsoft','https://ajax.aspnetcdn.com','https://alcdn.msauth.net'];
export function contentSecurityPolicy({development=false,supabaseUrl,outlook=false}:{development?:boolean;supabaseUrl?:string;outlook?:boolean}={}){
 const connections=["'self'"];
 if(supabaseUrl){const url=new URL(supabaseUrl);if(url.username||url.password||url.search||url.hash||url.pathname!=='/'||url.protocol!=='https:'&&!(development&&url.protocol==='http:'&&['localhost','127.0.0.1'].includes(url.hostname)))throw Error('Invalid public Supabase origin');connections.push(url.origin);}
 if(development)connections.push('ws:');
 return [
  "default-src 'self'",
  // Next's static App Router hydration needs inline scripts. A nonce policy
  // would require dynamic rendering throughout; never allow eval in production.
  "script-src 'self' 'unsafe-inline'"+(development?" 'unsafe-eval'":'')+(outlook?' '+OFFICE_SCRIPT_ORIGINS.join(' '):''),
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self'",
  "img-src 'self' data: blob: https://upload.wikimedia.org https://live.staticflickr.com https://images.unsplash.com https://cdn.stocksnap.io"+(outlook?' https:':''),
  'connect-src '+connections.join(' ')+(outlook?' '+OFFICE_SCRIPT_ORIGINS.join(' ')+' https://*.office.com https://*.office.net https://*.microsoft https://*.microsoft.com https://*.oaspapps.com':''),
  "media-src 'self' blob:","worker-src 'self' blob:","object-src 'none'","base-uri 'self'","form-action 'self'",outlook?"frame-src 'self' "+OFFICE_SCRIPT_ORIGINS.join(' ')+' https://*.office.com https://*.microsoft https://*.microsoft.com https://login.microsoftonline.com https://*.oaspapps.com':"frame-src 'none'",outlook?'frame-ancestors '+OUTLOOK_FRAME_ANCESTORS.join(' '):"frame-ancestors 'none'",
  ...(!development?['upgrade-insecure-requests']:[])
 ].join('; ');
}
