import type { NextConfig } from "next";
import {securityHeaders} from './lib/security-headers.ts';

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [{source:'/:path*',headers:securityHeaders({
      supabaseUrl:process.env.NEXT_PUBLIC_SUPABASE_URL,
      development:process.env.NODE_ENV==='development',
    })}];
  },
};

export default nextConfig;
