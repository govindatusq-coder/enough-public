// Synthetic school permission forms for tests (real AcroForm PDFs made with pdf-lib). No real school or family data.
import {PDFDocument} from 'pdf-lib';
export async function makeForm(o={}){
 const doc=await PDFDocument.create();const page=doc.addPage([595,842]);const form=doc.getForm();let y=800;
 const text=(name,{max,value,readOnly}={})=>{const f=form.createTextField(name);if(max)f.setMaxLength(max);if(value)f.setText(value);f.addToPage(page,{x:50,y,width:300,height:18});if(readOnly)f.enableReadOnly();y-=28;};
 const box=(name)=>{const c=form.createCheckBox(name);c.addToPage(page,{x:50,y,width:14,height:14});y-=28;};
 for(const n of (o.text||['Student_Name','Year_Level','Excursion_Name','Excursion_Date','Parent_Guardian_Name','Parent_Mobile','Parent_Email','Home_Address','Medical_Conditions','Allergies','Emergency_Contact_Name','Emergency_Contact_Phone','Parent_Signature','Date_Signed','Text1']))text(n,o.opts?.[n]);
 for(const n of (o.boxes||['Consent_Given','Photo_Permission']))box(n);
 if(o.title)doc.setTitle(o.title);
 return await doc.save();
}
