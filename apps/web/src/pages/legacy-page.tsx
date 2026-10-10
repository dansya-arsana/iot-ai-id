import type {ReactNode} from 'react';
import {PageShell} from '../site-shell';

/** Transitional wrapper: legacy page bodies inside the new shell. Replace with PageShell when a page is reskinned. */
export function Page({kicker,title,subtitle,children}:{kicker:string;title:string;subtitle:string;children:ReactNode}){return <div className="app-shell"><PageShell eyebrow={kicker} title={title} lead={subtitle}><div className="content-page legacy-content">{children}</div></PageShell></div>;}
