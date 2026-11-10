import type {StatusCardModel} from '@/lib/bear/engine/status';
import {Button} from './ui';

// One responsibility, three presentations (Bear's on it / Just need you / All sorted). Uses the app's existing card,
// eyebrow and button styles; no new visual language. It renders exactly what the status model says and nothing more.
export function BearResponsibilityStatusCard({model,onAction}:{model:StatusCardModel;onAction?:()=>void}){
 return <section className="card" aria-label={model.heading} data-status={model.kind}>
  <p className="eyebrow">{model.heading}</p>
  <h2 style={{fontSize:19,lineHeight:1.3,marginTop:4,wordBreak:'break-word'}}>{model.title}</h2>
  {model.lines.length>0&&<ul className="small" style={{listStyle:'none',padding:0,margin:'8px 0 0'}}>{model.lines.map((l,i)=><li key={i} style={{marginTop:i?4:0}}>{l}</li>)}</ul>}
  {model.evidence&&<p className="small muted" style={{marginTop:8}}>{model.evidence}</p>}
  {model.action&&<div className="btn-row"><Button className="sm" onClick={onAction}>{model.action.label}</Button></div>}
 </section>;
}
