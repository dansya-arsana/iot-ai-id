/** Pure: builds the /partner prefill for "assemble and test at a Lab Mitra". /partner reads only query params today, so everything is a short string. */
export type PrefillInput={projectId:string;revision:number;buildSheetUrl:string;bom:{key:string;qty:number}[]};
const MAX_BOM=20;
export function partnerPrefill(i:PrefillInput):{kind:'vendor';message:string;href:string}{
 const lines=i.bom.slice(0,MAX_BOM).map(b=>`${b.key} x${b.qty}`);
 const more=i.bom.length>MAX_BOM?` (+${i.bom.length-MAX_BOM} more)`:'';
 const message=`Assemble and test: project ${i.projectId} revision ${i.revision}. BOM: ${lines.join(', ')}${more}. Build Sheet: ${i.buildSheetUrl}`.slice(0,1000);
 const q=new URLSearchParams({kind:'vendor',project:i.projectId,rev:String(i.revision),sheet:i.buildSheetUrl.slice(0,300),msg:message});
 return{kind:'vendor',message,href:`/partner?${q}`};
}
