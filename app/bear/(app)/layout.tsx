import {BottomNav} from '@/components/bear/bottom-nav';
import {CoachTour} from '@/components/bear/coach-tour';
import {Splash} from '@/components/bear/splash';
export default function AppLayout({children}:{children:React.ReactNode}){return <>{children}<BottomNav/><Splash/><CoachTour/></>;}
