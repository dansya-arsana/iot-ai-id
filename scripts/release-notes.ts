/** Drafts the next CHANGELOG entry from commits since the last v* tag. Review and edit before pasting. */
import {execFileSync} from 'node:child_process';

const git=(...args:string[])=>execFileSync('git',args,{encoding:'utf8'}).trim();
let since='';try{since=git('describe','--tags','--abbrev=0','--match','v*');}catch{/* No tag yet: use the whole history. */}
const range=since?`${since}..HEAD`:'HEAD';
const log=git('log',range,'--no-merges','--pretty=%h%x09%s');
const groups:Record<string,string[]>={Added:[],Changed:[],Fixed:[],Security:[],Removed:[],Docs:[],Other:[]};
const securityHint=/\b(security|secrets?|credentials?|auth\w*|login|encrypt\w*|xss|csrf|cve|permissions?|sanitiz\w*|api keys?)\b/i;
for(const line of log?log.split('\n'):[]){
 const [hash,subject]=line.split('\t');
 const m=subject.match(/^(\w+)(?:\([^)]*\))?(!)?:\s*(.+)$/);const type=m?.[1]??'';const text=`${m?.[3]??subject} (${hash})`;
 if(type==='security'||securityHint.test(subject))groups.Security.push(text);
 if(type==='feat')groups.Added.push(text);
 else if(type==='fix')groups.Fixed.push(text);
 else if(['refactor','perf','style','chore','build','ci'].includes(type))groups.Changed.push(text);
 else if(type==='revert')groups.Removed.push(text);
 else if(type==='docs')groups.Docs.push(text);
 else if(type!=='security')groups.Other.push(text);
}
console.log(`## [Unreleased] — since ${since||'first commit'}\n`);
for(const [name,items] of Object.entries(groups))if(items.length)console.log(`### ${name}\n${items.map(i=>`- ${i}`).join('\n')}\n`);
if(!log)console.log('No commits since the last tag.');
