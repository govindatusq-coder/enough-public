'use client';
import {useState} from 'react';
import {browserClient} from '@/lib/supabase/client';
export default function SignOut(){const [error,setError]=useState('');return <main style={{maxWidth:'28rem',margin:'4rem auto',padding:'1.5rem'}}><h1>Sign out of ENOUGH?</h1><p>Your saved profile and progress will be here when you return.</p><button className="primary" onClick={async()=>{const {error}=await browserClient().auth.signOut({scope:'local'});if(error)setError('Sign-out failed. Try again.');else window.location.assign('/')}}>Sign out</button><a className="text-button" href="/">Stay signed in</a>{error&&<p role="alert">{error}</p>}</main>}
