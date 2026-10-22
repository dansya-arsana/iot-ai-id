import {useLang} from '../../i18n';
import type {PowerNote} from '../sim/power';

/** Friendly supply warnings from the power-net solver (a 3.3 V part on 5 V, a motor on a board pin, two sources shorted...). Shows nothing when all is well. */
export function PowerNotice({notes}:{notes:readonly PowerNote[]}){
 const {lang,tr}=useLang();
 if(!notes.length)return null;
 const shown=notes.slice(0,2),more=notes.length-shown.length;
 return (
  <div className="lab-power" role="status" aria-live="polite" data-testid="lab-power-notice">
   {shown.map((n,i)=>(
    <p key={`${n.part}-${n.code}-${i}`} className="lab-power-note" data-severity={n.severity} data-code={n.code}>
     <b>{n.severity==='error'?tr('Danger','Bahaya'):tr('Power check','Cek daya')}</b> {lang==='id'?n.id:n.en}
    </p>
   ))}
   {more>0&&<p className="lab-power-more">{tr(`+${more} more`,`+${more} lagi`)}</p>}
  </div>
 );
}
