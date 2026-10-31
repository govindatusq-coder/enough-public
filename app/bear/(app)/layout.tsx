import {BottomNav} from '@/components/bear/bottom-nav';
import {Splash} from '@/components/bear/splash';
export default function AppLayout({children}:{children:React.ReactNode}){return <>{children}<BottomNav/><Splash/></>;}
