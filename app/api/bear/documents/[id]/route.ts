import {withBear} from '@/lib/bear/server/context';
export const dynamic='force-dynamic';
// Streams the user's own original bill from private storage (never a public URL).
export const GET=(req:Request,{params}:{params:Promise<{id:string}>})=>withBear(req,async({store})=>{
 const {id}=await params;const doc=await store.get('source_documents',id);if(!doc)return new Response('Not found',{status:404});
 const file=await store.getFile(doc.objectKey);if(!file)return new Response('Not found',{status:404});
 return new Response(file.bytes as unknown as BodyInit,{headers:{'Content-Type':doc.mime,'Cache-Control':'private, no-store','Content-Disposition':`inline; filename="${doc.originalName.replace(/[^\w.-]/g,'_')}"`,'X-Content-Type-Options':'nosniff'}});
});
