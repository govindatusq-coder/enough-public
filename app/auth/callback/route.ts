import {NextResponse} from 'next/server';
import {serverClient} from '@/lib/supabase/server';
import {safeReturn} from '@/lib/public-auth';
export async function GET(req:Request){
 const url=new URL(req.url),code=url.searchParams.get('code');
 if(code){const db=await serverClient();const {error}=await db.auth.exchangeCodeForSession(code);if(!error)return NextResponse.redirect(new URL(safeReturn(url.searchParams.get('next')),url.origin),{headers:{'Cache-Control':'private, no-store'}});}
 return NextResponse.redirect(new URL('/signin?error=callback',url.origin),{headers:{'Cache-Control':'private, no-store'}});
}
