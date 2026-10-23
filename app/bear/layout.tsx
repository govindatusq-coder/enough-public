import type {Metadata,Viewport} from 'next';
import {Archivo_Black,Caveat,Inter} from 'next/font/google';
import './bear.css';
import {BearRuntime} from '@/components/bear/runtime';

const display=Archivo_Black({weight:'400',subsets:['latin'],display:'swap',variable:'--font-archivo'});
const ui=Inter({subsets:['latin'],display:'swap',variable:'--font-inter'});
const hand=Caveat({weight:['500','600'],subsets:['latin'],display:'swap',variable:'--font-caveat'});

export const metadata:Metadata={
 title:'Load Bear — Your mental load is ours to bear.',
 description:'A second brain for everything you carry. Give a bill to Bear, verify it, forget about it, and get one useful reminder at a good time.',
 manifest:'/bear/manifest.webmanifest',
 appleWebApp:{capable:true,statusBarStyle:'default',title:'Load Bear'},
 icons:{icon:[{url:'/bear/icon.svg',type:'image/svg+xml'}],apple:[{url:'/bear/apple-touch-icon.png',sizes:'180x180'}]},
};
export const viewport:Viewport={themeColor:'#FFF7E8',viewportFit:'cover',width:'device-width',initialScale:1,maximumScale:1};

export default function BearLayout({children}:{children:React.ReactNode}){
 return <div id="bear-root" className={`bear ${display.variable} ${ui.variable} ${hand.variable}`}><div className="bear-bg" aria-hidden="true"/>{children}<BearRuntime/></div>;
}
