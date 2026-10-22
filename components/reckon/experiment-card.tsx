'use client';
import type {Experiment, ExperimentProposal} from '@/lib/reckon/types';

/** Shared rendering of an experiment's fields: What matters / Noticing / Testing / When / Try / Success means. */
export function ExperimentFields({x, editable, onChange}: {x: ExperimentProposal | Experiment; editable?: boolean; onChange?: (patch: Partial<ExperimentProposal>) => void}) {
  const field = (key: keyof ExperimentProposal, label: string, sans = false) => {
    const value = (x[key] as string | undefined) ?? '';
    if (!value && !editable) return null;
    return (
      <div key={key}>
        <dt>{label}</dt>
        {editable ? <dd><textarea className="rk-textarea" style={{minHeight: 56, fontFamily: 'inherit', fontSize: 16}} value={value} onChange={e => onChange?.({[key]: e.target.value})} /></dd> : <dd className={sans ? 'sans' : ''}>{value}</dd>}
      </div>
    );
  };
  return (
    <dl className="rk-exp">
      {field('whatMatters', 'What matters', true)}
      {field('noticing', "What I'm noticing", true)}
      {x.kind === 'thinking' ? <>{field('currentInterpretation', 'Current interpretation')}{field('alternative', "Alternative I'm testing")}{field('when', 'When it matters')}</> : null}
      {x.kind === 'relationship' ? <>{field('when', 'When')}{field('oldResponse', 'Old response')}{field('try', 'Practice')}</> : null}
      {x.kind === 'behaviour' || x.kind === 'practice' ? <>{field('testing', "What we're testing", true)}{field('when', 'When')}{field('try', 'Try')}</> : null}
      {x.kind === 'thinking' ? field('testing', "What we're testing", true) : null}
      {field('successMeans', 'Success means', true)}
    </dl>
  );
}
