/** The ONE place for company legal details and commitments. Each item is a dummy until the founder confirms it: set `placeholder:false` together with the real value to show it to everyone. */
export type Item={value:string;placeholder:boolean};
export const COMPANY={
 legalName:{value:'PT [company name]',placeholder:true},
 nib:{value:'NIB [number]',placeholder:true},
 address:{value:'[registered address]',placeholder:true},
 replyTime:{value:'We reply within [X] business days',placeholder:true},
 priceBand:{value:'Test plans from [price band]',placeholder:true},
} satisfies Record<string,Item>;
export type CompanyKey=keyof typeof COMPANY;
export const PLACEHOLDER_MARK='[placeholder]';
/** Pure rule. A filled-in value shows for everyone. A placeholder shows only when `allowPlaceholders` (localhost, desktop, staff presentation mode), with a visible marker; otherwise it is omitted (null). */
export function visibleValue(item:Item,allowPlaceholders:boolean,mark=PLACEHOLDER_MARK):string|null{
 if(!item.placeholder)return item.value;
 return allowPlaceholders?`${item.value} ${mark}`:null;
}
/** Fail closed: placeholders may show only on a local dev host or the desktop app (localhost, *.localhost, 127.0.0.1, ::1), or on the public host during staff presentation mode (`!locked`). Any other host (staging, raw IP, a future alias) omits them. */
export function placeholdersAllowed(hostname:string,publicHost:boolean,locked:boolean):boolean{
 if(publicHost)return !locked;
 return hostname==='localhost'||hostname.endsWith('.localhost')||hostname==='127.0.0.1'||hostname==='[::1]'||hostname==='::1';
}
