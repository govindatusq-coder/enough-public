import {Suspense} from 'react';
import {SignInForm} from './form';
export default function SignIn(){return <Suspense fallback={null}><SignInForm/></Suspense>;}
