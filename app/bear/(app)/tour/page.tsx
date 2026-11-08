'use client';
import {useRouter} from 'next/navigation';
import {HowBearWorks} from '@/components/bear/how-bear-works';
// Replay "How Bear works" from Settings.
export default function Tour(){const router=useRouter();return <HowBearWorks replay onDone={()=>router.push('/bear/me')}/>;}
