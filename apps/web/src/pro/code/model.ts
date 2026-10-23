/** Code tab model: pure functions over a SystemSpec revision (no React). Server-owned values are read, never recomputed. */
import type {SystemSpec} from '../../../../../packages/pro-contract/system-spec';
import type {DisplayRefs} from '../../../../../packages/pro-contract/refs';

export type CodeFile=SystemSpec['code'][number];
export type BadgeTone='ok'|'warn'|'error'|'muted';
export interface Badge{label:string;tone:BadgeTone}

export interface FileEntry{file:CodeFile;index:number;badge:Badge;/** verification stamp from the gate, or the reason it is missing */gate:Badge}
export interface NodeGroup{nodeId:string;ref:string;board:string;files:FileEntry[]}

const errCount=(f:CodeFile)=>f.verify.diagnostics.filter(d=>d.severity==='error').length;

/** Short toolchain tag, e.g. 'arduino-cli esp32:esp32@3.0.7' -> 'esp32 3.0.7'. */
export function toolchainShort(t:string):string{
 const m=/@?([a-z0-9_-]+)(?::[a-z0-9_-]+)?@(\d[\w.]*)/i.exec(t);
 return m?`${m[1]} ${m[2]}`:t;
}

export function fileBadge(f:CodeFile):Badge{
 const v=f.verify;
 if(v.status==='compiled')return{label:`✓ compiled · ${toolchainShort(v.toolchain)}`,tone:'ok'};
 if(v.status==='linted')return{label:`linted only · ${toolchainShort(v.toolchain)}`,tone:'warn'};
 if(v.status==='failed'){const n=errCount(f);return{label:`✕ failed · ${n} error${n===1?'':'s'}`,tone:'error'};}
 return{label:'pending · not checked',tone:'muted'};
}
/** "verified" only when the save gate stamped /code/<i> as verified; otherwise say why not. */
export function gateBadge(spec:SystemSpec,index:number):Badge{
 const st=spec.code[index]?.verify.status;
 if(st==='failed')return{label:'unverified · compile failed',tone:'error'};
 if(st==='pending')return{label:'unverified · not checked yet',tone:'muted'};
 const s=spec.verification?.[`/code/${index}`];
 if(!s)return{label:'unverified · no gate stamp',tone:'muted'};
 if(s.status==='verified')return{label:`verified · ${s.by}`,tone:'ok'};
 return{label:`${s.status} · ${s.note??'no reason recorded'}`,tone:s.status==='failed'?'error':'warn'};
}

export function groupFiles(spec:SystemSpec,refs:DisplayRefs):NodeGroup[]{
 const out:NodeGroup[]=[];
 for(const n of spec.nodes){
  const files:FileEntry[]=[];
  spec.code.forEach((file,index)=>{if(file.nodeId===n.id)files.push({file,index,badge:fileBadge(file),gate:gateBadge(spec,index)});});
  if(files.length)out.push({nodeId:n.id,ref:refs.nodes[n.id]??n.id,board:n.board,files});
 }
 return out;
}

export interface PinInfo{symbol:string;pin:string;gpio:number|null;func:string;partId:string|null;partLabel:string;wireId:string|null;note?:string;lines:number[]}
/** Resolve each referenced pin symbol to its part and wire, using the node's pin table and wires. */
export function pinInfos(spec:SystemSpec,file:CodeFile):PinInfo[]{
 const node=spec.nodes.find(n=>n.id===file.nodeId);
 return file.pinsReferenced.map(r=>{
  const row=node?.pins.find(p=>p.symbol===r.symbol)??node?.pins.find(p=>p.boardPin===r.pin&&p.func!=='power'&&p.func!=='ground');
  const wire=row?node?.wires.find(w=>{const [a,b]=[w.from,w.to];const bd=a.part==='board'?a:b.part==='board'?b:null;const pt=bd===a?b:a;return bd?.pin===row.boardPin&&pt.part===row.part;}):undefined;
  const part=row?node?.parts.find(p=>p.id===row.part):undefined;
  return{symbol:r.symbol,pin:r.pin,gpio:row?.gpio??null,func:row?.func??'',partId:row?.part??null,
   partLabel:row?`${part?.kind??row.part} · ${row.partPin}`:'not in the pin table',wireId:wire?.id??null,note:row?.note?.en,lines:r.lines};
 });
}

// ---------- syntax highlighting (small, dependency free) ----------
export type TokKind='comment'|'string'|'pre'|'kw'|'type'|'num'|'text';
export interface Tok{kind:TokKind;text:string}
const KW_CPP=new Set('if else for while do switch case break continue return void static const constexpr extern volatile unsigned signed sizeof struct class enum namespace using new delete true false nullptr HIGH LOW INPUT OUTPUT INPUT_PULLUP'.split(' '));
const TY_CPP=new Set('int long short char bool float double byte uint8_t uint16_t uint32_t uint64_t int8_t int16_t int32_t size_t String'.split(' '));
const KW_PY=new Set('and as assert break class continue def del elif else except finally for from global if import in is lambda None not or pass raise return try while with yield True False async await'.split(' '));

export function highlight(source:string,language:string):Tok[][]{
 const py=language!=='arduino-cpp',KW=py?KW_PY:KW_CPP;
 let inBlock=false;
 return source.replace(/\n$/,'').split('\n').map(line=>{
  const toks:Tok[]=[];let i=0;const push=(kind:TokKind,text:string)=>{if(text)toks.push({kind,text});};
  if(inBlock){const e=line.indexOf('*/');if(e<0){push('comment',line);return toks;}push('comment',line.slice(0,e+2));i=e+2;inBlock=false;}
  if(!py&&/^\s*#\s*(include|define|if|ifdef|ifndef|endif|else|pragma)/.test(line.slice(i))&&i===0){
   const c=line.indexOf('//');const head=c<0?line:line.slice(0,c);push('pre',head);push('comment',c<0?'':line.slice(c));return toks;}
  while(i<line.length){
   const rest=line.slice(i),ch=line[i];
   if((py&&ch==='#')||(!py&&rest.startsWith('//'))){push('comment',rest);break;}
   if(!py&&rest.startsWith('/*')){const e=rest.indexOf('*/',2);if(e<0){push('comment',rest);inBlock=true;break;}push('comment',rest.slice(0,e+2));i+=e+2;continue;}
   if(ch==='"'||ch==="'"){let j=i+1;while(j<line.length&&line[j]!==ch){if(line[j]==='\\')j++;j++;}push('string',line.slice(i,j+1));i=j+1;continue;}
   const num=/^(0x[0-9a-fA-F]+|\d+(\.\d+)?([eE][+-]?\d+)?[fFuUlL]*)\b/.exec(rest);
   if(num&&!/[A-Za-z0-9_]/.test(line[i-1]??' ')){push('num',num[0]);i+=num[0].length;continue;}
   const id=/^[A-Za-z_][A-Za-z0-9_]*/.exec(rest);
   if(id){const w=id[0];push(KW.has(w)?'kw':!py&&TY_CPP.has(w)?'type':'text',w);i+=w.length;continue;}
   push('text',ch);i++;
  }
  return toks;
 });
}

/** Split a token text into plain parts and pin-symbol parts (underlined, linked to the wiring). */
export function splitSymbols(text:string,symbols:ReadonlySet<string>):{text:string;symbol?:string}[]{
 if(!symbols.size)return[{text}];
 const out:{text:string;symbol?:string}[]=[];let last=0;
 for(const m of text.matchAll(/[A-Za-z_][A-Za-z0-9_]*/g)){
  if(!symbols.has(m[0]))continue;
  if(m.index>last)out.push({text:text.slice(last,m.index)});
  out.push({text:m[0],symbol:m[0]});last=m.index+m[0].length;
 }
 if(last<text.length)out.push({text:text.slice(last)});
 return out;
}

/** Blocks = runs of lines separated by blank lines (1-based inclusive ranges), for per-block copy. */
export function blocks(source:string):{from:number;to:number;text:string}[]{
 const lines=source.replace(/\n$/,'').split('\n'),out:{from:number;to:number;text:string}[]=[];
 let start=-1;
 lines.forEach((l,i)=>{
  if(l.trim()===''){if(start>=0){out.push({from:start+1,to:i,text:lines.slice(start,i).join('\n')});start=-1;}}
  else if(start<0)start=i;
 });
 if(start>=0)out.push({from:start+1,to:lines.length,text:lines.slice(start).join('\n')});
 return out;
}

/** Bidi controls, zero-width and other invisible/control characters (Trojan Source). Tab and newlines are allowed. The server gate is not assumed to reject them. */
// eslint-disable-next-line no-control-regex
const HIDDEN=/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F\u00AD\u061C\u180E\u200B-\u200F\u202A-\u202E\u2060-\u2064\u2066-\u206F\uFEFF]/g;
export const hasHidden=(t:string)=>{HIDDEN.lastIndex=0;return HIDDEN.test(t);};
export const stripHidden=(t:string)=>t.replace(HIDDEN,'');
/** Visible form for print: each hidden character becomes <U+XXXX>. */
export const revealHidden=(t:string)=>t.replace(HIDDEN,c=>`<U+${c.codePointAt(0)!.toString(16).toUpperCase().padStart(4,'0')}>`);

/** Copy-all text: header uses the file language's own comment marker; filename is reduced to safe characters; hidden characters are stripped. */
export function copyAllText(g:NodeGroup):string{
 return g.files.map(e=>{
  const py=e.file.language!=='arduino-cpp',name=e.file.filename.replace(/[^A-Za-z0-9._\- /]/g,'_');
  return `${py?'#':'//'} ===== ${name} =====\n${stripHidden(e.file.content).replace(/\n$/,'')}\n`;
 }).join('\n');
}

/** Status-bar style summary for the whole spec. */
export function codeSummary(spec:SystemSpec){
 const c=(s:string)=>spec.code.filter(f=>f.verify.status===s).length;
 return{compiled:c('compiled'),linted:c('linted'),failed:c('failed'),pending:c('pending'),runOnHardware:0};
}
