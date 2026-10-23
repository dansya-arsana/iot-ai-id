/** Staff-authored skills (ADR 012 §5). Markdown with a small frontmatter; versioned by sha256 of the body. */
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';

export interface Skill{name:string;version:string;summary:string;sha256:string;body:string}
export const SKILL_NAMES=['agri-id','lora-as923-id','power-solar-tropics'] as const;
export type SkillName=typeof SKILL_NAMES[number];

const parse=(file:string):Skill=>{
 const raw=readFileSync(new URL('./'+file+'.md',import.meta.url),'utf8');
 const m=/^---\n([\s\S]*?)\n---\n([\s\S]*)$/.exec(raw);
 if(!m)throw new Error('skill '+file+' has no frontmatter');
 const meta=Object.fromEntries(m[1]!.split('\n').map(l=>{const i=l.indexOf(':');return [l.slice(0,i).trim(),l.slice(i+1).trim()];}));
 if(meta.name!==file||!meta.version||!meta.summary)throw new Error('skill '+file+' has bad frontmatter');
 const body=m[2]!.trim();
 return {name:meta.name,version:meta.version,summary:meta.summary,sha256:createHash('sha256').update(body).digest('hex'),body};
};
let cache:Skill[]|undefined;
export const listSkills=():Skill[]=>cache??=SKILL_NAMES.map(parse);
/** One-line summaries for the system prompt (names and summaries only). */
export const skillIndex=():{name:string;summary:string}[]=>listSkills().map(s=>({name:s.name,summary:s.summary}));
export const loadSkill=(name:string):Skill|undefined=>listSkills().find(s=>s.name===name);
