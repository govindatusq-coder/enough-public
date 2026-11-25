import {Suspense} from 'react';
import {MyWinsScreen} from './my-wins';
export default function Wins(){return <Suspense fallback={null}><MyWinsScreen/></Suspense>;}
