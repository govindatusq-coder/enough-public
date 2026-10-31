import {NextResponse} from 'next/server';
import {z} from 'zod';
import {serverClient} from '@/lib/supabase/server';
import {SupabaseStore} from '@/lib/bear/store/supabase';
import {ensureProfile} from '@/lib/bear/services/profile';
export const dynamic='force-dynamic';
// Called after the person opens the confirmation link Bear emailed them (on any device).
// The access token is checked with Supabase, and it must come from an emailed link (amr: otp),
// not a password sign-in, so it genuinely proves they can read that inbox.
const body=z.object({accessToken:z.string().min(20).max(4000)}).strict();
export async function POST(req:Request){
 const parsed=body.safeParse(await req.json().catch(()=>null));if(!parsed.success)return NextResponse.json({error:'Bad request'},{status:400});
 const token=parsed.data.accessToken;const db=await serverClient(token);
 const {data,error}=await db.auth.getUser(token);if(error||!data.user)return NextResponse.json({error:'That link has expired. Send a new one from Settings.'},{status:401});
 let methods:string[]=[];try{const payload=JSON.parse(Buffer.from(token.split('.')[1],'base64url').toString('utf8'));methods=(payload.amr||[]).map((a:{method:string})=>a.method);}catch{/* unreadable token */}
 if(!methods.some(m=>['otp','magiclink','email/signup'].includes(m)))return NextResponse.json({error:'That sign-in didn’t come from your email link.'},{status:403});
 const store=new SupabaseStore(data.user.id,db);const profile=await ensureProfile(store);
 await store.update('profiles',profile.id,{emailVerifiedAt:new Date().toISOString()});
 return NextResponse.json({ok:true},{headers:{'Cache-Control':'private, no-store'}});
}
