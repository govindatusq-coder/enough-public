import {contentSecurityPolicy} from "./lib/content-security-policy.ts";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader:false,
  async headers(){return [{source:'/:path*',headers:[
    {key:'Content-Security-Policy',value:contentSecurityPolicy({development:process.env.NODE_ENV==='development',supabaseUrl:process.env.NEXT_PUBLIC_SUPABASE_URL})},
    {key:'Referrer-Policy',value:'strict-origin-when-cross-origin'},
    {key:'X-Content-Type-Options',value:'nosniff'},
  ]}];},
};

export default nextConfig;
