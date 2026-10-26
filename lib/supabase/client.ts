import {createClient} from '@supabase/supabase-js';
import {createBrowserClient} from '@supabase/ssr';
export function browserClient(){return createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!);}
// For Bear's email-confirmation link only: the implicit flow puts the token in the link itself,
// so it works when opened on another device or in Safari (no code verifier needed), and it
// never replaces the session on this device.
export function linkClient(){return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,{auth:{flowType:'implicit',persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});}
