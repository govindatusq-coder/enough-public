import {json,withBear} from '@/lib/bear/server/context';
export const dynamic='force-dynamic';
export const GET=(req:Request,{params}:{params:Promise<{id:string}>})=>withBear(req,async({store})=>{
 const {id}=await params;const capture=await store.get('captures',id);if(!capture)return json({error:"Bear couldn't find that."},404);
 const extraction=capture.extractionId?await store.get('extractions',capture.extractionId):null;
 const document=capture.documentId?await store.get('source_documents',capture.documentId):null;
 const duplicate=extraction?.duplicateOfBillId?await store.get('bills',extraction.duplicateOfBillId):null;
 return json({capture,extraction,document:document?{id:document.id,name:document.originalName,mime:document.mime,url:`/api/bear/documents/${document.id}`}:null,duplicate:duplicate?{id:duplicate.id,biller:duplicate.biller,dueAt:duplicate.dueAt,amountCents:duplicate.amountCents,status:duplicate.status}:null});
});
