import {useLang} from '../../i18n';

export const fmtCycles=(ms:number)=>Math.round(ms*16000).toLocaleString('en-US');
export const fmtTime=(ms:number)=>{
 const t=Math.max(0,ms),m=Math.floor(t/60000),s=Math.floor(t/1000)%60,r=Math.floor(t%1000);
 return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}.${String(r).padStart(3,'0')}`;
};

/** Header pill: the chip that is really executing. All numbers come from the emulator snapshot. */
export function ChipPill({running,speed,simTimeMs,compact}:{running:boolean;speed:number;simTimeMs:number;compact?:boolean}){
 const {tr}=useLang();
 const slow=speed<0.95;
 return (
  <div className="lab-chippill" data-running={running} data-testid="lab-chip-pill" data-cycles={Math.round(simTimeMs*16000)}>
   <i className="lab-chip-dot" aria-hidden="true"/>
   {compact
    ?<span>{running?tr('run','jalan'):tr('idle','diam')}</span>
    :<span>ATmega328P · 16 MHz{running
      ?<> · <b data-slow={slow}>{speed.toFixed(2)}×</b> · <span className="lab-chippill-cyc">{fmtCycles(simTimeMs)} cyc</span></>
      :<> · {tr('idle','diam')}</>}</span>}
  </div>
 );
}
