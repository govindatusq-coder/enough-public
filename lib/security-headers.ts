import {randomBytes} from 'node:crypto';

type PolicyOptions={nonce?:string;supabaseUrl?:string;development?:boolean};
// Library photographs are returned only from this existing route allowlist.
export const photographOrigins=['https://upload.wikimedia.org','https://live.staticflickr.com','https://images.unsplash.com','https://cdn.stocksnap.io'];

export function supabaseOrigin(value:string|undefined,development=false){
 if(!value)return null;
 const url=new URL(value);
 const local=development&&['localhost','127.0.0.1','[::1]'].includes(url.hostname);
 if((url.protocol!=='https:'&&!(local&&url.protocol==='http:'))||url.username||url.password||url.pathname!=='/'||url.search||url.hash)throw Error('NEXT_PUBLIC_SUPABASE_URL must be a secure service origin.');
 return url.origin;
}
export const createScriptNonce=()=>randomBytes(16).toString('base64');
export function contentSecurityPolicy({nonce,supabaseUrl,development=false}:PolicyOptions={}){
 if(nonce&&!/^[A-Za-z0-9+/=]{22,64}$/.test(nonce))throw Error('Invalid script nonce.');
 const backend=supabaseOrigin(supabaseUrl,development);
 return [
  "default-src 'self'",
  "base-uri 'none'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "frame-src 'none'",
  "form-action 'self'",
  `script-src 'self'${nonce?` 'nonce-${nonce}' 'strict-dynamic'`:''}${development?" 'unsafe-eval'":''}`,
  // Existing artwork, charts and Base UI use inline style attributes. This does
  // not permit inline scripts; fonts are removed from this list in roadmap PR 9.
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  `img-src 'self' data: blob: ${photographOrigins.join(' ')}`,
  `connect-src 'self'${backend?' '+backend:''}${development?' ws:':''}`,
  "media-src 'self' blob:",
  "worker-src 'self' blob:",
  ...(!development?['upgrade-insecure-requests']:[]),
 ].join('; ');
}
export const permissionsPolicy=[
 'accelerometer=(self)','gyroscope=(self)','magnetometer=(self)','camera=(self)',
 'autoplay=()','microphone=()','geolocation=()','payment=()','usb=()','serial=()','hid=()',
 'bluetooth=()','display-capture=()','fullscreen=()','picture-in-picture=()',
 'clipboard-read=()','clipboard-write=()','publickey-credentials-create=()',
 'publickey-credentials-get=()','identity-credentials-get=()','screen-wake-lock=()',
 'encrypted-media=()','midi=()','speaker-selection=()','web-share=()',
 'local-fonts=()','window-management=()','storage-access=()',
 'browsing-topics=()','join-ad-interest-group=()','run-ad-auction=()',
].join(', ');
export function securityHeaders(options:PolicyOptions={}){
 return [
  {key:'Content-Security-Policy',value:contentSecurityPolicy(options)},
  {key:'Referrer-Policy',value:'strict-origin-when-cross-origin'},
  {key:'Permissions-Policy',value:permissionsPolicy},
  {key:'X-Content-Type-Options',value:'nosniff'},
  {key:'X-Frame-Options',value:'DENY'},
 ];
}
