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
  // Reckon shows provider thumbnails that oEmbed / Open Graph legitimately return.
  "img-src 'self' data: blob: https://upload.wikimedia.org https://live.staticflickr.com https://images.unsplash.com https://cdn.stocksnap.io https://*.cdninstagram.com https://*.fbcdn.net https://i.ytimg.com https://*.tiktokcdn.com https://*.tiktokcdn-us.com",
  'connect-src '+connections.join(' '),
  "media-src 'self' blob:","worker-src 'self' blob:","object-src 'none'","base-uri 'self'","form-action 'self'",
  // Reckon embeds the original post via each provider's official embed endpoint only.
  "frame-src https://www.instagram.com https://www.youtube-nocookie.com https://www.tiktok.com","frame-ancestors 'none'",
  ...(!development?['upgrade-insecure-requests']:[])
 ].join('; ');
}
