import {contentSecurityPolicy} from "./lib/content-security-policy.ts";
import type { NextConfig } from "next";

import {execSync} from 'node:child_process';
const gitStamp=()=>{try{return execSync('git rev-parse --short=12 HEAD',{stdio:['ignore','pipe','ignore']}).toString().trim();}catch{return 'dev';}};
// Stable per commit so a running server and the client bundle it served always agree.
const buildStamp=(process.env.VERCEL_GIT_COMMIT_SHA||process.env.GITHUB_SHA||gitStamp()).slice(0,12);
const nextConfig: NextConfig = {
  poweredByHeader:false,
  env:{NEXT_PUBLIC_BEAR_BUILD:buildStamp},
  async headers(){return [{source:'/:path*',headers:[
    {key:'Content-Security-Policy',value:contentSecurityPolicy({development:process.env.NODE_ENV==='development',supabaseUrl:process.env.NEXT_PUBLIC_SUPABASE_URL})},
    {key:'Referrer-Policy',value:'strict-origin-when-cross-origin'},
    {key:'X-Content-Type-Options',value:'nosniff'},
  ]}];},
};

export default nextConfig;
