/**
 * RAIN-SENSOR device (protocol 'adc'): rain plate with its control board (LM393). Written from public behaviour.
 *  - The plate is bare nickel-plated comb traces. Dry, the two combs are open; water bridges them and conducts a little.
 *    Plate resistance Rp falls as the covered share grows: conductance is linear in coverage, 2 kohm when fully wet.
 *  - The board puts a 10 kohm pull-up on AO: AO = VCC * Rp / (Rp + 10 k). Dry reads about VCC, soaked about 0.8 V.
 *  - DO is the LM393 comparator: LOW while AO is below the trimmer level (indicator LED on, "rain"), HIGH when dry.
 *  - The plate dries and wets with a lag (first-order, about 0.4 s) since a film of water does not appear or leave at once.
 * Pair: scene/parts/rain-sensor.ts (3D). Guide: docs/lab-extending.md
 */
import {defineDevice,clamp,num} from './types';
import {uno} from './core/util';
import {SIM_CLOCK_HZ} from '../../contract';

export type RainSensorState={wetness:number;value:number;volts:number;doLow:boolean;plateKohm:number;thresholdVolts:number;powered:boolean};

export const PULLUP_KOHM=10,WET_KOHM=2,TAU_S=0.4;
/** Plate resistance in kohm for a coverage in percent (Infinity when dry). */
export const plateKohm=(cov:number):number=>cov<=0?Infinity:WET_KOHM*100/clamp(cov,0,100);
export const aoVolts=(vcc:number,cov:number):number=>{const r=plateKohm(cov);return r===Infinity?vcc:vcc*r/(r+PULLUP_KOHM);};

export const device=defineDevice<RainSensorState>({
 kind:'rain-sensor',protocol:'adc',
 // physical order on the control board header: VCC, GND, DO, AO
 pins:['VCC','GND','DO','AO'],holes:[0,1,2,3],bodyX:[-6,15],
 copy:{
  name:{en:'Rain sensor',id:'Sensor hujan'},
  desc:{en:'A plate with bare comb traces. Water bridges them, so AO falls from about the supply voltage as rain covers the plate; DO goes LOW past the trimmer level.',id:'Pelat dengan jalur sisir telanjang. Air menjembatani jalur, jadi AO turun dari sekitar tegangan suplai saat hujan menutupi pelat; DO menjadi LOW melewati level trimmer.'},
  note:{en:'Set how much of the plate is wet. Dry reads high, soaked reads low.',id:'Atur seberapa basah pelatnya. Kering terbaca tinggi, basah kuyup terbaca rendah.'},
 },
 power:{rail:['VCC','GND'],min:3.3,max:5.5,ma:8},
 inputs:[
  {type:'range',key:'wetness',label:{en:'Plate wetness',id:'Kebasahan pelat'},min:0,max:100,step:1,unit:'%',default:0},
  {type:'range',key:'threshold',label:{en:'DO level (trimmer)',id:'Level DO (trimmer)'},min:0,max:1023,step:1,default:500},
 ],
 defaults:{wetness:0,threshold:500},
 create(ctx){
  const ao=ctx.analogPin('AO'),dout=uno(ctx.net('DO'));
  let cov=clamp(num(ctx.props.wetness,0),0,100),low:boolean|null=null;
  const vcc=():number=>ctx.supply()??5;
  const powered=():boolean=>vcc()>=2.7;
  const thr=():number=>clamp(num(ctx.props.threshold,500),0,1023)/1023*vcc();
  const volts=():number=>powered()?aoVolts(vcc(),cov):0;
  const sync=():boolean=>{
   const l=powered()&&volts()<thr();
   if(dout&&l!==low)ctx.env.setPin(dout,!l);
   low=l;return l;
  };
  sync();
  return {
   state:()=>{const v=volts(),r=plateKohm(cov);return {wetness:Math.round(cov),value:Math.round(v/5*1023),volts:Math.round(v*100)/100,doLow:sync(),plateKohm:r===Infinity?-1:Math.round(r*10)/10,thresholdVolts:Math.round(thr()*100)/100,powered:powered()};},
   tick(cycles){
    const target=clamp(num(ctx.props.wetness,0),0,100);
    cov+=(target-cov)*(1-Math.exp(-(cycles/SIM_CLOCK_HZ)/TAU_S));
    if(Math.abs(target-cov)<0.05)cov=target;
    sync();
   },
   adc:()=>ao?{pin:ao,volts:volts()}:null,
  };
 },
});
