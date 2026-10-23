import {json,withBear} from '@/lib/bear/server/context';
import {homeView} from '@/lib/bear/services/home';
import {ensureProfile} from '@/lib/bear/services/profile';
export const dynamic='force-dynamic';
export const GET=(req:Request)=>withBear(req,async({store,aiAvailable})=>{const profile=await ensureProfile(store);if(!profile.onboardingComplete)return json({onboarding:true,profile});return json({home:await homeView(store),aiAvailable});});
