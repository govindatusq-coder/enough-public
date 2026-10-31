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
 // ?v= busts the browser's stubborn cached tab icon whenever the artwork changes.
 icons:{icon:[{url:'/bear/favicon.ico?v=4',sizes:'48x48'},{url:'/bear/icon-32.png?v=4',type:'image/png',sizes:'32x32'},{url:'/bear/icon-192.png?v=4',type:'image/png',sizes:'192x192'}],shortcut:'/bear/favicon.ico?v=4',apple:[{url:'/bear/apple-touch-icon.png?v=4',sizes:'180x180'}]},
};
export const viewport:Viewport={themeColor:'#FFF7E8',viewportFit:'cover',width:'device-width',initialScale:1,maximumScale:1};

export default function BearLayout({children}:{children:React.ReactNode}){
 return <div id="bear-root" className={`bear ${display.variable} ${ui.variable} ${hand.variable}`}><div className="bear-bg" aria-hidden="true"/>{children}<BearRuntime/></div>;
}
