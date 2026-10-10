import {forwardRef,type AnchorHTMLAttributes,type ButtonHTMLAttributes,type HTMLAttributes,type InputHTMLAttributes,type ReactNode,type SelectHTMLAttributes,type TextareaHTMLAttributes} from 'react';
import {Link,type LinkProps} from 'react-router-dom';
import {CheckCircleIcon,InfoIcon,WarningIcon,XCircleIcon} from '@phosphor-icons/react';
import {useLang,type Lang} from '../i18n';
import './ui.css';

const cx=(...names:(string|false|null|undefined)[])=>names.filter(Boolean).join(' ');
type Variant='primary'|'secondary'|'ghost'|'inverse';
type Size='md'|'sm';
const buttonClass=(variant:Variant='primary',size:Size='md',extra?:string)=>cx('ds-button',`ds-button--${variant}`,size==='sm'&&'ds-button--sm',extra);

/** Pill button. Use `LinkButton` for navigation and `AnchorButton` for external links or downloads. */
export const Button=forwardRef<HTMLButtonElement,ButtonHTMLAttributes<HTMLButtonElement>&{variant?:Variant;size?:Size}>(
 function Button({variant,size,className,type='button',...props},ref){return <button ref={ref} type={type} className={buttonClass(variant,size,className)} {...props}/>;});
export function LinkButton({variant,size,className,...props}:LinkProps&{variant?:Variant;size?:Size}){return <Link className={buttonClass(variant,size,className)} {...props}/>;}
export function AnchorButton({variant,size,className,...props}:AnchorHTMLAttributes<HTMLAnchorElement>&{variant?:Variant;size?:Size}){return <a className={buttonClass(variant,size,className)} {...props}/>;}
export function IconButton({label,className,children,...props}:ButtonHTMLAttributes<HTMLButtonElement>&{label:string}){return <button type="button" aria-label={label} title={label} className={cx('ds-icon-button',className)} {...props}>{children}</button>;}
export function TextLink({className,...props}:LinkProps){return <Link className={cx('ds-text-link',className)} {...props}/>;}

/** Mono uppercase label. `rule` adds the leading hairline used in section indexes. */
export function Eyebrow({children,rule,className,as:Tag='p'}:{children:ReactNode;rule?:boolean;className?:string;as?:'p'|'span'|'div'}){return <Tag className={cx('ds-eyebrow',rule&&'ds-eyebrow--rule',className)}>{children}</Tag>;}

export function PageHeader({eyebrow,title,lead,actions,className}:{eyebrow?:ReactNode;title:ReactNode;lead?:ReactNode;actions?:ReactNode;className?:string}){
 return <header className={cx('ds-page-header',className)}>{eyebrow&&<Eyebrow>{eyebrow}</Eyebrow>}<h1>{title}</h1>{lead&&<p className="ds-lead">{lead}</p>}{actions&&<div className="ds-actions">{actions}</div>}</header>;
}
export function SectionHeader({eyebrow,title,lead,aside}:{eyebrow?:ReactNode;title:ReactNode;lead?:ReactNode;aside?:ReactNode}){
 return <div className="ds-section-header"><div>{eyebrow&&<Eyebrow>{eyebrow}</Eyebrow>}<h2>{title}</h2>{lead&&<p className="ds-lead">{lead}</p>}</div>{aside&&<div className="ds-section-aside">{aside}</div>}</div>;
}

type CardProps=HTMLAttributes<HTMLElement>&{brackets?:boolean;tone?:'surface'|'raised'|'inverse'|'plain';interactive?:boolean;as?:'article'|'section'|'div'|'li'};
export function Card({brackets,tone='surface',interactive,className,as:Tag='article',...props}:CardProps){return <Tag className={cx('ds-card',`ds-card--${tone}`,brackets&&'ds-brackets',interactive&&'ds-card--interactive',className)} {...props}/>;}
export function CardLink({brackets,className,...props}:LinkProps&{brackets?:boolean}){return <Link className={cx('ds-card','ds-card--surface','ds-card--interactive',brackets&&'ds-brackets',className)} {...props}/>;}

export function Tag({children,tone='neutral',className}:{children:ReactNode;tone?:'neutral'|'ok'|'warn'|'error'|'inverse';className?:string}){return <span className={cx('ds-tag',`ds-tag--${tone}`,className)}>{children}</span>;}
export function TagList({items}:{items:ReactNode[]}){return <ul className="ds-tag-list">{items.map((item,i)=><li key={i}><Tag>{item}</Tag></li>)}</ul>;}

type FieldShell={label:ReactNode;hint?:ReactNode;error?:ReactNode;id:string;hideLabel?:boolean};
function FieldFrame({label,hint,error,id,hideLabel,children}:FieldShell&{children:ReactNode}){
 return <div className={cx('ds-field',!!error&&'ds-field--error')}><label htmlFor={id} className={hideLabel?'ds-sr-only':undefined}>{label}</label>{children}{hint&&!error&&<small id={`${id}-hint`}>{hint}</small>}{error&&<small id={`${id}-error`} role="alert">{error}</small>}</div>;
}
const describedBy=({hint,error,id}:FieldShell)=>error?`${id}-error`:hint?`${id}-hint`:undefined;
export function Input({label,hint,error,id,hideLabel,className,...props}:FieldShell&InputHTMLAttributes<HTMLInputElement>){return <FieldFrame {...{label,hint,error,id,hideLabel}}><input id={id} className={cx('ds-input',className)} aria-invalid={!!error||undefined} aria-describedby={describedBy({label,hint,error,id})} {...props}/></FieldFrame>;}
export function Select({label,hint,error,id,hideLabel,className,children,...props}:FieldShell&SelectHTMLAttributes<HTMLSelectElement>){return <FieldFrame {...{label,hint,error,id,hideLabel}}><select id={id} className={cx('ds-input','ds-select',className)} aria-invalid={!!error||undefined} aria-describedby={describedBy({label,hint,error,id})} {...props}>{children}</select></FieldFrame>;}
export function Textarea({label,hint,error,id,hideLabel,className,...props}:FieldShell&TextareaHTMLAttributes<HTMLTextAreaElement>){return <FieldFrame {...{label,hint,error,id,hideLabel}}><textarea id={id} className={cx('ds-input','ds-textarea',className)} aria-invalid={!!error||undefined} aria-describedby={describedBy({label,hint,error,id})} {...props}/></FieldFrame>;}

/** Segmented control for 2–5 mutually exclusive options. */
export function Segmented<T extends string>({value,options,onChange,label,size='md'}:{value:T;options:{value:T;label:ReactNode}[];onChange:(value:T)=>void;label:string;size?:Size}){
 return <div className={cx('ds-segmented',size==='sm'&&'ds-segmented--sm')} role="group" aria-label={label}>{options.map(o=><button key={o.value} type="button" aria-pressed={value===o.value} onClick={()=>onChange(o.value)}>{o.label}</button>)}</div>;
}
export function LangToggle({size='sm'}:{size?:Size}){const{lang,setLang}=useLang();return <Segmented<Lang> label="Language" size={size} value={lang} onChange={setLang} options={[{value:'en',label:'EN'},{value:'id',label:'ID'}]}/>;}

export function Stat({value,label,className}:{value:ReactNode;label:ReactNode;className?:string}){return <div className={cx('ds-stat',className)}><dt>{label}</dt><dd>{value}</dd></div>;}
export function StatGrid({children}:{children:ReactNode}){return <dl className="ds-stat-grid">{children}</dl>;}

const noticeIcon={info:InfoIcon,ok:CheckCircleIcon,warn:WarningIcon,error:XCircleIcon};
export function Notice({tone='info',title,children,action,className}:{tone?:'info'|'ok'|'warn'|'error';title?:ReactNode;children?:ReactNode;action?:ReactNode;className?:string}){
 const Icon=noticeIcon[tone];
 return <div className={cx('ds-notice',`ds-notice--${tone}`,className)} role={tone==='error'?'alert':'status'}><Icon size={18} weight="bold" aria-hidden="true"/><div>{title&&<strong>{title}</strong>}{children&&<p>{children}</p>}</div>{action&&<div className="ds-notice-action">{action}</div>}</div>;
}
export function EmptyState({eyebrow,title,children,action}:{eyebrow?:ReactNode;title:ReactNode;children?:ReactNode;action?:ReactNode}){
 return <div className="ds-empty ds-brackets">{eyebrow&&<Eyebrow>{eyebrow}</Eyebrow>}<h3>{title}</h3>{children&&<p>{children}</p>}{action&&<div className="ds-actions">{action}</div>}</div>;
}

export function CodeBlock({children,label,className}:{children:ReactNode;label?:ReactNode;className?:string}){return <figure className={cx('ds-code',className)}>{label&&<figcaption>{label}</figcaption>}<pre>{children}</pre></figure>;}

/** Two-column definition rows for spec sheets: label left, value right. */
export function SpecList({rows,className}:{rows:[ReactNode,ReactNode][];className?:string}){return <dl className={cx('ds-spec',className)}>{rows.map(([k,v],i)=><div key={i}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>;}

export function Container({children,className,wide}:{children:ReactNode;className?:string;wide?:boolean}){return <div className={cx('ds-container',wide&&'ds-container--wide',className)}>{children}</div>;}
export function Spinner({label}:{label:string}){return <span className="ds-spinner" role="status" aria-label={label}/>;}
