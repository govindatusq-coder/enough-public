import 'server-only';
import {signedIn} from '@/lib/supabase/server';
import {SupabaseStore} from '@/lib/bear/store/supabase';
import {MemoryBackend} from '@/lib/bear/store/memory';
import {loadProfile} from '@/lib/bear/services/profile';
import type {BearStore} from '@/lib/bear/store/store';

// Development-only harness: with BEAR_DEV_STORE=memory the app runs against an in-process
// store for a fixed dev user, so screens and browser tests work without Supabase.
// It is ignored in production builds regardless of the variable.
const g=globalThis as unknown as {__bearDevBackend?:MemoryBackend};
export function devStore():{store:BearStore;user:{id:string;email:string|null;name:string}}|null{
 if(process.env.NODE_ENV==='production'||process.env.BEAR_DEV_STORE!=='memory')return null;
 g.__bearDevBackend??=new MemoryBackend();
 const id=process.env.BEAR_DEV_USER_ID||'00000000-0000-4000-8000-000000000001';
 return {store:g.__bearDevBackend.for(id),user:{id,email:'dev@loadbear.local',name:''}};
}
export async function bearSession(req?:Request):Promise<{store:BearStore;user:{id:string;email:string|null;name:string};loadProfile:()=>ReturnType<typeof loadProfile>}|null>{
 const dev=devStore();if(dev)return {...dev,loadProfile:()=>loadProfile(dev.store)};
 if(!process.env.NEXT_PUBLIC_SUPABASE_URL)return null;
 const {db,user}=await signedIn(req);if(!user)return null;
 const store=new SupabaseStore(user.id,db);
 return {store,user:{id:user.id,email:user.email||null,name:user.user_metadata?.name||''},loadProfile:()=>loadProfile(store)};
}
