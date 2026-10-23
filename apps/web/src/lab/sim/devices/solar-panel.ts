/**
 * SOLAR-PANEL (10 W or 20 W, 12 V class monocrystalline, 36 cells, protocol 'gpio', desk prop): a source for the power-net solver.
 * Reference [U, retail spec sheets differ by a few percent]: 20 W Pmax 20 W, Vmp ~17.5 V, Imp ~1.14 A, Voc ~21.6 V, Isc ~1.23 A, ~345 x 470 x 20 mm (ACOPOWER HY-12M-20W class);
 * 10 W Vmp ~18 V, Imp ~0.56 A, Voc ~21.6 V, Isc ~0.6 A, ~340 x 230 x 20 mm (retail class, no single sheet cited).
 * Simple model: Isc is proportional to irradiance; Voc = Voc_stc + n*Vt*ln(irr/1000) with n*Vt ~ 1.2 V for 36 cells in series (clamped, 0 V in the dark).
 * Pair: scene/parts/solar-panel.ts. Guide: docs/lab-extending.md
 */
import {defineDevice,clamp,num} from './types';

export type SolarPanelWatts=10|20;
export interface PanelSpec{watts:SolarPanelWatts;vmp:number;imp:number;voc:number;isc:number;/** l x w x h in mm */dims:{l:number;w:number;h:number}}
export const PANEL_SPECS:Record<SolarPanelWatts,PanelSpec>={
 10:{watts:10,vmp:18,imp:0.56,voc:21.6,isc:0.6,dims:{l:340,w:230,h:20}},
 20:{watts:20,vmp:17.5,imp:1.14,voc:21.6,isc:1.23,dims:{l:470,w:345,h:20}},
};
/** n * Vt of the 36-cell string in volts (ideality ~1.3, 25.7 mV thermal voltage, 36 cells). */
export const PANEL_NVT=1.2;
export const panelSpec=(p:{watts?:unknown}):PanelSpec=>num(p.watts,20)<=10?PANEL_SPECS[10]:PANEL_SPECS[20];
export const irradiance=(p:{irradiance?:unknown}):number=>clamp(num(p.irradiance,1000),0,1200);
/** Open-circuit volts at irradiance irr (W/m2). 0 below 5 W/m2 (night). */
export function panelVoc(s:PanelSpec,irr:number):number{
 if(irr<5)return 0;
 return Math.max(0,Math.round((s.voc+PANEL_NVT*Math.log(irr/1000))*100)/100);
}
/** Short-circuit amps at irradiance irr. */
export const panelIsc=(s:PanelSpec,irr:number):number=>Math.round(s.isc*irr/1000*1000)/1000;
/** Available power at the maximum power point, linear in irradiance (a simple model). */
export const panelWatts=(s:PanelSpec,irr:number):number=>Math.round(s.watts*irr/1000*10)/10;

export type SolarPanelState={watts:number;irradiance:number;tiltDeg:number;vocV:number;iscA:number;availableW:number;vmpV:number;impA:number};

export const device=defineDevice<SolarPanelState>({
 kind:'solar-panel',protocol:'gpio',
 pins:['PV+','PV-'],
 copy:{
  name:{en:'Solar panel (10 W or 20 W, 12 V class)',id:'Panel surya (10 W atau 20 W, kelas 12 V)'},
  desc:{en:'A 36-cell panel made for charging a 12 V battery. In full sun it gives about 18 V open-circuit and a little over 1 A (20 W model).',id:'Panel 36 sel untuk mengisi baterai 12 V. Di bawah matahari penuh tegangan terbukanya sekitar 18 V lebih dan arusnya sedikit di atas 1 A (model 20 W).'},
  note:{en:'Simple model: current follows sunlight, voltage barely does. Its open-circuit voltage must stay below the controller PV limit. In Indonesia tilt it about 10-15 degrees so rain can wash it.',id:'Model sederhana: arus mengikuti cahaya, tegangan hampir tidak. Tegangan terbukanya harus di bawah batas PV pengontrol. Di Indonesia miringkan sekitar 10-15 derajat agar hujan bisa membersihkannya.'},
 },
 inputs:[
  {type:'choice',key:'watts',label:{en:'Rating',id:'Daya'},options:[{value:'10',label:{en:'10 W',id:'10 W'}},{value:'20',label:{en:'20 W',id:'20 W'}}],default:'20'},
  {type:'range',key:'irradiance',label:{en:'Sunlight',id:'Cahaya matahari'},min:0,max:1200,step:10,unit:'W/m2',default:1000},
  {type:'range',key:'tiltDeg',label:{en:'Tilt',id:'Kemiringan'},min:0,max:60,step:1,unit:'deg',default:12},
 ],
 defaults:{watts:20,irradiance:1000,tiltDeg:12},
 supplies:p=>{const s=panelSpec(p),irr=irradiance(p);return [{pos:'PV+',neg:'PV-',volts:panelVoc(s,irr),maxMa:Math.round(panelIsc(s,irr)*1000)}];},
 create(ctx){
  const st=():SolarPanelState=>{
   const s=panelSpec(ctx.props),irr=irradiance(ctx.props);
   return {watts:s.watts,irradiance:irr,tiltDeg:clamp(num(ctx.props.tiltDeg,12),0,90),vocV:panelVoc(s,irr),iscA:panelIsc(s,irr),availableW:panelWatts(s,irr),vmpV:irr<5?0:s.vmp,impA:Math.round(s.imp*irr/1000*1000)/1000};
  };
  return {state:st};
 },
});
