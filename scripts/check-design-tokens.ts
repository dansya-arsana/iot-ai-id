/**
 * Design-system guard: raw colour literals belong in apps/web/src/design/tokens.css only.
 * A line may opt out with a `ds-allow-hex` comment when the colour encodes data (e.g. wire colours).
 */
import {readdirSync,readFileSync,statSync} from 'node:fs';
import {join,relative} from 'node:path';

const ROOT='apps/web/src';
const TOKENS=join(ROOT,'design/tokens.css');
const HEX=/#[0-9a-fA-F]{3,8}\b/g;
const RGB=/\brgba?\(\s*\d/g;

function walk(dir:string):string[]{
 return readdirSync(dir).flatMap(name=>{const path=join(dir,name);return statSync(path).isDirectory()?walk(path):[path];});
}
const files=walk(ROOT).filter(f=>/\.(css|tsx?)$/.test(f)&&f!==TOKENS);
const violations:string[]=[];
for(const file of files){
 const lines=readFileSync(file,'utf8').split('\n');
 lines.forEach((line,i)=>{
  if(line.includes('ds-allow-hex'))return;
  const isCss=file.endsWith('.css');
  // In TS/TSX only flag colour-looking strings inside style props or CSS-in-JS; skip URL fragments and ids.
  const hits=[...line.matchAll(HEX)].map(m=>m[0]).filter(()=>isCss||/(color|background|fill|stroke|border)\s*[:=]/i.test(line));
  const rgb=isCss?[...line.matchAll(RGB)].map(m=>m[0]):[];
  for(const h of [...hits,...rgb])violations.push(`${relative('.',file)}:${i+1}  ${h}`);
 });
}
if(violations.length){
 console.error(`Design token check failed: ${violations.length} raw colour value(s) outside design/tokens.css.\nUse var(--ds-…) tokens, or mark a data-encoding colour with a ds-allow-hex comment.\n`);
 const byFile=new Map<string,number>();for(const v of violations){const f=v.split(':')[0];byFile.set(f,(byFile.get(f)??0)+1);}
 for(const [f,n] of [...byFile].sort((a,b)=>b[1]-a[1]))console.error(`  ${n.toString().padStart(4)}  ${f}`);
 if(process.argv.includes('--verbose'))console.error('\n'+violations.join('\n'));
 process.exit(1);
}
console.log(`Design token check passed (${files.length} files).`);
