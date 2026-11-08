// Outlook hosts allowed to show Bear's add-in pages in their task pane (Outlook on the web, new Outlook (also on outlook.cloud.microsoft),
// Outlook.com). Only /bear/outlook pages get this; everything else can't be framed at all.
export const OUTLOOK_FRAME_ANCESTORS=['https://outlook.office.com','https://outlook.office365.com','https://outlook.live.com','https://*.outlook.com','https://*.office.com','https://*.office365.com','https://*.officeapps.live.com','https://*.cloud.microsoft'];
export const OFFICE_JS_ORIGIN='https://appsforoffice.microsoft.com';
export function contentSecurityPolicy({development=false,supabaseUrl,outlook=false}:{development?:boolean;supabaseUrl?:string;outlook?:boolean}={}){
 const connections=["'self'"];
 if(supabaseUrl){const url=new URL(supabaseUrl);if(url.username||url.password||url.search||url.hash||url.pathname!=='/'||url.protocol!=='https:'&&!(development&&url.protocol==='http:'&&['localhost','127.0.0.1'].includes(url.hostname)))throw Error('Invalid public Supabase origin');connections.push(url.origin);}
 if(development)connections.push('ws:');
 return [
  "default-src 'self'",
  // Next's static App Router hydration needs inline scripts. A nonce policy
  // would require dynamic rendering throughout; never allow eval in production.
  "script-src 'self' 'unsafe-inline'"+(development?" 'unsafe-eval'":'')+(outlook?' '+OFFICE_JS_ORIGIN:''),
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self'",
  "img-src 'self' data: blob: https://upload.wikimedia.org https://live.staticflickr.com https://images.unsplash.com https://cdn.stocksnap.io",
  'connect-src '+connections.join(' ')+(outlook?' '+OFFICE_JS_ORIGIN:''),
  "media-src 'self' blob:","worker-src 'self' blob:","object-src 'none'","base-uri 'self'","form-action 'self'",outlook?"frame-src 'self' "+OFFICE_JS_ORIGIN:"frame-src 'none'",outlook?'frame-ancestors '+OUTLOOK_FRAME_ANCESTORS.join(' '):"frame-ancestors 'none'",
  ...(!development?['upgrade-insecure-requests']:[])
 ].join('; ');
}
