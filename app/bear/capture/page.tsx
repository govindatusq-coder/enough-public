import {Suspense} from 'react';
import {BearChat} from '@/components/bear/bear-chat';
// + Bear: the first screen. The bear, a welcome, one box.
export default function CapturePage(){return <Suspense fallback={null}><BearChat/></Suspense>;}
