export function contentSecurityPolicy({development=false,supabaseUrl}:{development?:boolean;supabaseUrl?:string}={}){
 const connections=["'self'"];
 if(supabaseUrl){const url=new URL(supabaseUrl);if(url.username||url.password||url.search||url.hash||url.pathname!=='/'||url.protocol!=='https:'&&!(development&&url.protocol==='http:'&&['localhost','127.0.0.1'].includes(url.hostname)))throw Error('Invalid public Supabase origin');connections.push(url.origin);}
 if(development)connections.push('ws:');
 return [
  "default-src 'self'",
  // Next's static App Router hydration needs inline scripts. A nonce policy
  // would require dynamic rendering throughout; never allow eval in production.
  "script-src 'self' 'unsafe-inline'"+(development?" 'unsafe-eval'":''),
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self'",
  "img-src 'self' data: blob: https://upload.wikimedia.org https://live.staticflickr.com https://images.unsplash.com https://cdn.stocksnap.io",
  'connect-src '+connections.join(' '),
  "media-src 'self' blob:","worker-src 'self' blob:","object-src 'none'","base-uri 'self'","form-action 'self'","frame-src 'none'","frame-ancestors 'none'",
  ...(!development?['upgrade-insecure-requests']:[])
 ].join('; ');
}
