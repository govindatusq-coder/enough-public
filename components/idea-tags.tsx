import {ideaTagLabels} from '@/lib/idea-tags';
import type {Idea} from '@/lib/ideas';
export function IdeaTags({idea}:{idea:Idea}){return <div className="idea-tags" aria-label="Movement type estimates" title="Template estimates, not measured effort. Choose a pace that suits you.">{ideaTagLabels(idea).map(label=><span key={label}>{label}</span>)}</div>;}
