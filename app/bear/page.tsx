import {redirect} from 'next/navigation';
import {bearSession} from '@/lib/bear/server/session';
export const dynamic='force-dynamic';
export default async function BearRoot(){
 const session=await bearSession();
 if(!session)redirect('/bear/welcome');
 let target='/bear/onboarding';
 try{const profile=await session.loadProfile();if(profile?.onboardingComplete)target='/bear/home';}catch{target='/bear/home';}
 redirect(target);
}
