'use client';
import Link from 'next/link';
import {ChevronLeft} from 'lucide-react';
import type {ReactNode} from 'react';
import {ReckonWordmark} from './mark';

export function Card({children, tone, className = '', style}: {children: ReactNode; tone?: 'navy' | 'plain' | 'flat'; className?: string; style?: React.CSSProperties}) {
  return <section className={`rk-card ${tone ?? ''} ${className}`} style={style}>{children}</section>;
}
export const Eyebrow = ({children}: {children: ReactNode}) => <div className="rk-eyebrow">{children}</div>;

export function PageHeader({title, back, lead, action}: {title?: string; back?: string; lead?: string; action?: ReactNode}) {
  return (
    <>
      <header className="rk-header">
        {back ? <Link href={back} className="rk-back"><ChevronLeft size={18} /> Back</Link> : <ReckonWordmark />}
        {action}
      </header>
      {title && <h1 className="rk-h1">{title}</h1>}
      {lead && <p className="rk-lead">{lead}</p>}
    </>
  );
}

export function Thinking({label = 'Adding to Reckon…'}: {label?: string}) {
  return <div className="rk-status" role="status" aria-live="polite"><span className="rk-dotpulse" />{label}</div>;
}

export function Ripple() {
  return <div className="rk-ripple" aria-hidden="true"><span /><span /><span /><i /></div>;
}

export const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('en-AU', {day: 'numeric', month: 'short'});
