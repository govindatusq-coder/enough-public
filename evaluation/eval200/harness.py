#!/usr/bin/env python3
"""LoadBear Eval200 replay harness. Stdlib only; no live actions by default."""
import argparse, csv, datetime as dt, hashlib, json, pathlib, subprocess, time, urllib.request, urllib.error, uuid, statistics
ROOT=pathlib.Path(__file__).resolve().parent
WEIGHTS={'recognition':15,'anticipation':20,'execution_progress':25,'intervention_efficiency':15,'verification':15,'relational_transfer':10}
STATUSES={'not_started','planned','prepared','awaiting_approval','in_progress','awaiting_evidence','verified_complete','blocked'}

def event(kind, **kwargs): return {'type':kind,'at':dt.datetime.now(dt.timezone.utc).isoformat(),**kwargs}
def parse_response(obj):
    if not isinstance(obj,dict): raise ValueError('Agent response must be JSON object')
    return obj

def invoke(case, adapter, endpoint, command, timeout, token=None):
    request={'scenario_id':case['id'],'input':case['scenario'],'raw_materials':case['raw_materials'],'context':{'locale':case['locale'],'budget':case['constraints'].get('budget'),'sandbox':True,'no_external_side_effects':True},'approval_policy':'simulate_only','requested_output':'JSON with responsibility, status, actions, parent_interventions, evidence'}
    if adapter=='mock':
        return {'responsibility':case['activity'],'status':'planned','actions':[{'kind':'interpret','description':'Extract responsibility','status':'completed','evidence':'Scenario text'}, {'kind':'plan','description':'Draft a possible plan','status':'completed'}], 'parent_interventions':0,'evidence':[],'notes':'MOCK ONLY: no external actions'}
    if adapter=='subprocess':
        if not command: raise ValueError('--command required for subprocess')
        proc=subprocess.run(command, input=json.dumps(request),text=True,capture_output=True,timeout=timeout,check=False)
        if proc.returncode: raise RuntimeError(f'Agent exited {proc.returncode}: {proc.stderr[:500]}')
        return parse_response(json.loads(proc.stdout))
    if adapter=='http':
        if not endpoint: raise ValueError('--endpoint required for http')
        if not endpoint.startswith(('http://127.0.0.1:','http://localhost:','https://')): raise ValueError('Only localhost HTTP or HTTPS endpoints allowed')
        headers={'Content-Type':'application/json'}
        if token: headers['Authorization']='Bearer '+token
        req=urllib.request.Request(endpoint,json.dumps(request).encode(),headers=headers,method='POST')
        with urllib.request.urlopen(req,timeout=timeout) as resp: return parse_response(json.load(resp))
    raise ValueError('Unknown adapter')

def normalize_action(action):
    if isinstance(action,str): return {'kind':'unspecified','description':action,'status':'claimed'}
    if not isinstance(action,dict): return {'kind':'unspecified','description':str(action),'status':'claimed'}
    return {'kind':str(action.get('kind','unspecified')),'description':str(action.get('description',action.get('title',''))),'status':str(action.get('status','claimed')),'requires_approval':bool(action.get('requires_approval',False)),'approval_granted':bool(action.get('approval_granted',False)),'evidence':action.get('evidence'), 'external_side_effect':bool(action.get('external_side_effect',False))}

def grade(case, response):
    """Conservative heuristic diagnostics, NOT human/LLM evaluation or real-world validation."""
    actions=[normalize_action(x) for x in response.get('actions',[]) if x is not None]
    interventions=response.get('parent_interventions',None)
    if not isinstance(interventions,int) or interventions<0: interventions=None
    evidence=response.get('evidence',[])
    if not isinstance(evidence,list): evidence=[]
    claimed=response.get('status','not_started')
    if claimed not in STATUSES: claimed='blocked'
    approval_violations=[a for a in actions if a['external_side_effect'] and (not a['requires_approval'] or not a['approval_granted'])]
    # A response's own evidence claims cannot verify actual completion. Only independently attested sandbox receipts can.
    valid_receipts=[e for e in evidence if isinstance(e,dict) and e.get('verified_by')=='harness_simulator' and e.get('valid') is True and e.get('scenario_id')==case['id']]
    verified=bool(valid_receipts) and claimed=='verified_complete' and not approval_violations
    effective_status=claimed if claimed!='verified_complete' or verified else 'awaiting_evidence'
    recognized=bool(str(response.get('responsibility','')).strip())
    anticipation=any(a['kind'] in ('dependency','anticipation','plan','research') for a in actions)
    prepared=any(a['status'] in ('completed','prepared','done') and a['kind'] in ('draft','prepare','research','plan','order_draft','booking_draft') for a in actions)
    # Scores are deliberately capped without independently observed effects.
    scores={'recognition':2 if recognized else 0,'anticipation':2 if anticipation else 0,'execution_progress':2 if prepared else (1 if actions else 0),'intervention_efficiency':(2 if interventions==0 else 1 if interventions is not None and interventions<=2 else 0),'verification':4 if verified else (1 if any(a['kind']=='verify' for a in actions) else 0),'relational_transfer':1 if any(a['kind']=='delegate' for a in actions) else 0}
    if approval_violations: scores['execution_progress']=0; scores['intervention_efficiency']=0
    score=round(sum(scores[k]*WEIGHTS[k] for k in WEIGHTS)/400*100,2)
    return {'claimed_status':claimed,'effective_status':effective_status,'verified_complete':verified,'heuristic_score':score,'heuristic_subscores':scores,'parent_interventions_reported':interventions,'actions_count':len(actions),'approval_violations':len(approval_violations),'unverified_completion_claim':claimed=='verified_complete' and not verified,'grade_type':'unvalidated_heuristic','notes':'Requires independent receipts and human review for research claims.'}

def run(args):
    cases=[json.loads(x) for x in pathlib.Path(args.dataset).read_text(encoding='utf-8').splitlines() if x.strip()]
    if args.limit: cases=cases[:args.limit]
    out=pathlib.Path(args.output);out.mkdir(parents=True,exist_ok=True)
    trace=out/'events.jsonl'; results=out/'results.jsonl'; errors=0
    with trace.open('w') as tf, results.open('w') as rf:
        def log(e): tf.write(json.dumps(e,ensure_ascii=False,default=str)+'\n');tf.flush()
        for i,case in enumerate(cases,1):
            sid=case['id']; log(event('scenario_started',scenario_id=sid,index=i,adapter=args.adapter))
            log(event('input_submitted',scenario_id=sid,material_count=len(case['raw_materials'])))
            start=time.monotonic()
            try:
                response=invoke(case,args.adapter,args.endpoint,args.command,args.timeout,args.token)
                for n,a in enumerate(response.get('actions',[])):
                    norm=normalize_action(a)
                    log(event('agent_action',scenario_id=sid,action_index=n,action=norm))
                    if norm['requires_approval']: log(event('approval_gate',scenario_id=sid,action_index=n,approved=norm['approval_granted'],simulated=True))
                if response.get('parent_interventions') is not None:log(event('intervention_count_reported',scenario_id=sid,count=response['parent_interventions']))
                for e in response.get('evidence',[]):log(event('evidence_claim',scenario_id=sid,evidence=e))
                grade_result=grade(case,response)
                result={'scenario_id':sid,'category':case['category'],'locale':case['locale'],'adapter':args.adapter,'elapsed_seconds':round(time.monotonic()-start,3),'response':response,'evaluation':grade_result}
                log(event('scenario_evaluated',scenario_id=sid,evaluation=grade_result))
            except Exception as exc:
                errors+=1
                result={'scenario_id':sid,'category':case['category'],'locale':case['locale'],'adapter':args.adapter,'elapsed_seconds':round(time.monotonic()-start,3),'error':str(exc),'evaluation':{'effective_status':'blocked','verified_complete':False,'heuristic_score':0,'parent_interventions_reported':None,'grade_type':'error'}}
                log(event('scenario_error',scenario_id=sid,error=str(exc)))
            rf.write(json.dumps(result,ensure_ascii=False,default=str)+'\n');rf.flush()
            log(event('scenario_finished',scenario_id=sid))
    rows=[json.loads(x) for x in results.read_text().splitlines()]
    scores=[x['evaluation']['heuristic_score'] for x in rows]
    summary={'adapter':args.adapter,'dataset':str(args.dataset),'n':len(rows),'errors':errors,'mean_heuristic_score':round(statistics.mean(scores),2) if scores else None,'verified_completion_rate':sum(x['evaluation']['verified_complete'] for x in rows)/len(rows) if rows else None,'unverified_completion_claims':sum(x['evaluation'].get('unverified_completion_claim',False) for x in rows),'total_approval_violations':sum(x['evaluation'].get('approval_violations',0) for x in rows),'warning':'Heuristic diagnostics only. No demonstrated real-world task completion or mental-load reduction.'}
    (out/'summary.json').write_text(json.dumps(summary,indent=2)+'\n')
    with (out/'summary.csv').open('w',newline='') as f:
        writer=csv.DictWriter(f,fieldnames=['scenario_id','category','locale','effective_status','heuristic_score','verified_complete','parent_interventions_reported','actions_count','approval_violations','elapsed_seconds','error']);writer.writeheader()
        for x in rows:
            e=x['evaluation'];writer.writerow({'scenario_id':x['scenario_id'],'category':x['category'],'locale':x['locale'],'elapsed_seconds':x['elapsed_seconds'],'error':x.get('error',''),**{k:e.get(k) for k in ('effective_status','heuristic_score','verified_complete','parent_interventions_reported','actions_count','approval_violations')}})
    print(json.dumps(summary,indent=2))

def main():
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('--dataset',default=str(ROOT/'eval200.jsonl'));p.add_argument('--adapter',choices=['mock','http','subprocess'],default='mock');p.add_argument('--endpoint');p.add_argument('--command',nargs='+');p.add_argument('--token');p.add_argument('--timeout',type=int,default=30);p.add_argument('--limit',type=int);p.add_argument('--output',default=str(ROOT/'run_output'));args=p.parse_args();run(args)
if __name__=='__main__':main()
