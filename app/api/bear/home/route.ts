import {json,withBear} from '@/lib/bear/server/context';
import {homeView} from '@/lib/bear/services/home';
import {ensureProfile} from '@/lib/bear/services/profile';
export const dynamic='force-dynamic';
export const GET=(req:Request)=>withBear(req,async({store,aiAvailable,user})=>{let profile=await ensureProfile(store);if(!profile.name&&user.name)profile=await store.update('profiles',profile.id,{name:user.name});if(!profile.onboardingComplete)return json({onboarding:true,profile});return json({home:await homeView(store,new Date(),user.name||''),aiAvailable});});
