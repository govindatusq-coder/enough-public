'use client';
// Before signing up: the three screens on what Bear does, then creating her account.
import {useRouter} from 'next/navigation';
import {HowBearWorks} from '@/components/bear/how-bear-works';
export default function Intro(){const router=useRouter();return <HowBearWorks preview onDone={()=>router.push('/bear/signin?mode=create')}/>;}
