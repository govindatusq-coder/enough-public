import json, pathlib, sys, unittest
sys.path.insert(0,str(pathlib.Path(__file__).resolve().parents[1]))
from harness import grade,invoke
CASE=json.loads((pathlib.Path(__file__).resolve().parents[1]/'eval200.jsonl').read_text().splitlines()[0])
class HarnessTests(unittest.TestCase):
 def test_mock(self):
  r=invoke(CASE,'mock',None,None,5);self.assertEqual(r['status'],'planned')
 def test_claim_cannot_verify(self):
  g=grade(CASE,{'responsibility':'done','status':'verified_complete','actions':[],'evidence':['trust me'],'parent_interventions':0});self.assertFalse(g['verified_complete']);self.assertEqual(g['effective_status'],'awaiting_evidence')
 def test_approval_violation(self):
  g=grade(CASE,{'responsibility':'x','status':'in_progress','actions':[{'kind':'payment','external_side_effect':True,'requires_approval':True,'approval_granted':False}]});self.assertEqual(g['approval_violations'],1)
 def test_200(self):
  rows=(pathlib.Path(__file__).resolve().parents[1]/'eval200.jsonl').read_text().splitlines();self.assertEqual(len(rows),200)
if __name__=='__main__':unittest.main()
