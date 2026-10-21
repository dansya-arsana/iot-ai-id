/** Small C/Arduino tokenizer for the read-only code view. Pure, no DOM. */
export type TokenKind='comment'|'string'|'number'|'keyword'|'type'|'constant'|'function'|'ident'|'punct'|'space'|'param';
export interface Token{kind:TokenKind;text:string;param?:string}

const KEYWORDS=new Set(['void','if','else','for','while','do','return','const','static','volatile','break','continue','switch','case','default','unsigned','signed','struct','#include','#define']);
const TYPES=new Set(['int','long','byte','char','bool','boolean','float','double','short','word','String','Servo','uint8_t','uint16_t','uint32_t','int8_t','int16_t','int32_t','size_t']);
const CONSTANTS=new Set(['HIGH','LOW','INPUT','OUTPUT','INPUT_PULLUP','true','false','LED_BUILTIN','A0','A1','A2','A3','A4','A5','NULL']);

/** Tokenize one line. `inBlock` carries block-comment state across lines. */
export function tokenizeLine(line:string,inBlock=false):{tokens:Token[];inBlock:boolean}{
 const out:Token[]=[];
 let i=0;
 const push=(kind:TokenKind,text:string,param?:string)=>{if(text)out.push(param===undefined?{kind,text}:{kind,text,param});};
 if(inBlock){
  const end=line.indexOf('*/');
  if(end<0){push('comment',line);return {tokens:out,inBlock:true};}
  push('comment',line.slice(0,end+2));i=end+2;inBlock=false;
 }
 while(i<line.length){
  const ch=line[i];
  const rest=line.slice(i);
  if(rest.startsWith('{{')){
   const m=/^\{\{\s*([A-Za-z_]\w*)\s*\}\}/.exec(rest);
   if(m){push('param',m[0],m[1]);i+=m[0].length;continue;}
  }
  if(rest.startsWith('//')){push('comment',rest);break;}
  if(rest.startsWith('/*')){
   const end=rest.indexOf('*/',2);
   if(end<0){push('comment',rest);return {tokens:out,inBlock:true};}
   push('comment',rest.slice(0,end+2));i+=end+2;continue;
  }
  if(ch==='"'||ch==="'"){
   let j=i+1;
   while(j<line.length&&line[j]!==ch){if(line[j]==='\\')j++;j++;}
   push('string',line.slice(i,Math.min(j+1,line.length)));i=j+1;continue;
  }
  if(/\s/.test(ch)){const m=/^\s+/.exec(rest);push('space',m?m[0]:ch);i+=m?m[0].length:1;continue;}
  if(/[0-9]/.test(ch)||(ch==='.'&&/[0-9]/.test(line[i+1]??''))){
   const m=/^(0[xX][0-9a-fA-F]+|\d*\.?\d+(?:[eE][+-]?\d+)?)[uUlLfF]*/.exec(rest);
   const t=m?m[0]:ch;push('number',t);i+=t.length;continue;
  }
  if(/[A-Za-z_#]/.test(ch)){
   const m=/^#?[A-Za-z_]\w*/.exec(rest);
   const w=m?m[0]:ch;
   const after=line.slice(i+w.length).match(/^\s*(.)/);
   let kind:TokenKind='ident';
   if(KEYWORDS.has(w))kind='keyword';
   else if(TYPES.has(w))kind='type';
   else if(CONSTANTS.has(w))kind='constant';
   else if(after&&after[1]==='(')kind='function';
   push(kind,w);i+=w.length;continue;
  }
  push('punct',ch);i++;
 }
 return {tokens:out,inBlock};
}

export function highlightLines(text:string):Token[][]{
 let block=false;
 return text.split('\n').map(l=>{const r=tokenizeLine(l,block);block=r.inBlock;return r.tokens;});
}

/** Replace {{name}} with the current value (unknown names are left as is). */
export function fillTemplate(template:string,values:Record<string,number>):string{
 return template.replace(/\{\{\s*([A-Za-z_]\w*)\s*\}\}/g,(m,n:string)=>n in values?String(values[n]):m);
}
