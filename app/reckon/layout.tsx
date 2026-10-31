import {Inter, Playfair_Display} from 'next/font/google';
import type {Metadata, Viewport} from 'next';
import {Shell} from '@/components/reckon/shell';
import './reckon.css';

const sans = Inter({subsets: ['latin'], display: 'swap', variable: '--font-reckon-sans'});
const serif = Playfair_Display({subsets: ['latin'], display: 'swap', style: ['normal', 'italic'], variable: '--font-reckon-serif'});

export const metadata: Metadata = {
  title: 'Reckon — Ideas, lived.',
  description: 'Bring the ideas that matter out of your feed and into your life.',
  manifest: '/reckon.webmanifest',
  appleWebApp: {capable: true, title: 'Reckon', statusBarStyle: 'black-translucent'},
};
export const viewport: Viewport = {themeColor: '#0B2545', viewportFit: 'cover', width: 'device-width', initialScale: 1};

export default function ReckonLayout({children}: {children: React.ReactNode}) {
  return <div className={`${sans.variable} ${serif.variable}`}><Shell>{children}</Shell></div>;
}
