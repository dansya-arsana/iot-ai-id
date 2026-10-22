/**
 * IRF520-MOSFET-MODULE (the common IRF520 low-side switch board, protocol 'pwm'): an N-channel power MOSFET with a gate pull-down,
 * a drive LED and screw terminals. SIG (header) drives the gate, VIN+/VIN- take the load supply, V+ is VIN+ passed straight through and
 * V- is the switched drain: wire the load between V+ and V-.
 * IRF520 datasheet (Vishay): VGS(th) 2.0-4.0 V, RDS(on) 0.27 ohm at VGS = 10 V, 100 V, 9.2 A, RthJA 62 degC/W (TO-220 in free air).
 * It is NOT a logic-level part: at the 5 V an Arduino pin gives it conducts with roughly 0.6 ohm (typical curve, not guaranteed), and at 3.3 V
 * hardly at all. The table below interpolates that curve; PWM on SIG gives the load the average voltage = duty x (VIN - drop across RDS(on)).
 * The drop depends on the load, so the popover has the load resistance (a mini pump is about 25 ohm).
 * Pair: scene/parts/irf520-mosfet-module.ts. Guide: docs/lab-extending.md
 */
import {defineDevice,num} from './types';
import type {PinDrive} from './types';
import {duty} from './core/util';

/** [VGS volts, RDS(on) ohms]: typical curve through the datasheet points (off below threshold, 0.27 ohm at 10 V). */
export const RDS_CURVE:readonly (readonly [number,number])[]=[[2,1e6],[2.5,1e4],[3,60],[3.3,8],[4,1.2],[5,0.6],[6,0.45],[8,0.33],[10,0.27]];
export const RTH_JA=62;
export const IRF520_MAX_A=9.2;

/** Drain-source resistance for a gate voltage (log interpolation of the curve). */
export function rdsOn(vgs:number):number{
 const c=RDS_CURVE;
 if(vgs<=c[0]![0])return c[0]![1];
 if(vgs>=c[c.length-1]![0])return c[c.length-1]![1];
 for(let i=1;i<c.length;i++){
  const [x1,y1]=c[i]!,[x0,y0]=c[i-1]!;
  if(vgs<=x1){const t=(vgs-x0)/(x1-x0);return Math.exp(Math.log(y0)+(Math.log(y1)-Math.log(y0))*t);}
 }
 return c[c.length-1]![1];
}

export type Irf520State={
 gateV:number;/** fraction of the time the gate is high */duty:number;rdsOhms:number;
 /** average voltage across the load */loadV:number;loadMa:number;/** power wasted in the MOSFET */watts:number;tempC:number;
 /** the switch is conducting */on:boolean;ledOn:boolean;/** the module supply is wired */supplied:boolean;
};

export const device=defineDevice<Irf520State>({
 kind:'irf520-mosfet-module',protocol:'pwm',
 // SIG VCC GND plug into the breadboard; the four screw terminals take wires only
 pins:['SIG','VCC','GND','VIN+','VIN-','V+','V-'],holes:[0,1,2],bodyX:[-6,30],
 power:{rail:['VIN+','VIN-'],min:3,max:24,ma:1000,external:true},
 copy:{
  name:{en:'IRF520 MOSFET switch module',id:'Modul saklar MOSFET IRF520'},
  desc:{en:'A transistor switch for loads that are too big for a pin: a pump, a motor, a strip. A high on SIG closes the path between V- and the supply ground, and PWM on SIG sets the average power.',id:'Saklar transistor untuk beban yang terlalu besar bagi sebuah pin: pompa, motor, lampu strip. High pada SIG menutup jalur antara V- dan ground catu, dan PWM pada SIG mengatur daya rata-rata.'},
  note:{en:'The IRF520 wants about 10 V on the gate to be fully on. At 5 V it works for small loads but gets warm; at 3.3 V it barely switches.',id:'IRF520 butuh sekitar 10 V di gate agar menyala penuh. Pada 5 V ia cukup untuk beban kecil tapi menghangat; pada 3,3 V nyaris tidak menyala.'},
 },
 inputs:[{type:'range',key:'loadOhms',label:{en:'Load resistance',id:'Hambatan beban'},min:2,max:200,step:1,unit:'ohm',default:25}],
 defaults:{loadOhms:25},
 create(ctx){
  let st:Irf520State={gateV:0,duty:0,rdsOhms:1e6,loadV:0,loadMa:0,watts:0,tempC:25,on:false,ledOn:false,supplied:false};
  // voltage of V- as a load sees it: the supply ground lifted by what the switch does not conduct
  let vOut:number|null=null,vPass:number|null=null;
  return {
   state:()=>st,
   output(pin):PinDrive|null{
    if(pin==='V+')return vPass===null?null:{volts:vPass,ohms:0.05};
    if(pin==='V-')return vOut===null?null:{volts:vOut,ohms:Math.max(0.05,st.rdsOhms)};
    return null;
   },
   update(f){
    const net=ctx.net('SIG');
    const gateHigh=net==='3V3'?3.3:5;
    const d=net==='5V'||net==='3V3'?1:duty(net,f);
    const vp=ctx.volts('VIN+'),vm=ctx.volts('VIN-');
    const supplied=vp!==null&&vm!==null;
    const rds=rdsOn(gateHigh);
    const rl=Math.max(0.5,num(ctx.props.loadOhms,25));
    const vin=supplied?Math.max(0,vp!-vm!):0;
    // while the gate is high the load and RDS(on) form a divider; PWM averages it over the period
    const iOn=vin/(rl+rds);
    const loadV=d*iOn*rl;
    const frac=vin>0?loadV/vin:0;
    const amps=d*iOn;
    const watts=d*iOn*iOn*rds;
    vPass=supplied?vp:null;
    vOut=supplied&&frac>0.005?vp!-loadV:null;
    st={
     gateV:d>0?gateHigh:0,duty:Math.round(d*100)/100,rdsOhms:d>0?Math.round(rds*100)/100:1e6,loadV:Math.round(loadV*100)/100,
     loadMa:Math.round(amps*1000),watts:Math.round(watts*1000)/1000,tempC:Math.round((25+watts*RTH_JA)*10)/10,
     on:frac>0.005,ledOn:d>0,supplied,
    };
   },
  };
 },
});
