/**
 * IR-OBSTACLE-FC51 device (protocol 'switch'): infrared reflective obstacle module (IR LED + photodiode + LM393). Public behaviour.
 *  - The IR LED shines continuously (no carrier); the photodiode sees what bounces back. Reflected light falls with the
 *    square of the distance and scales with the surface: white 1.0, wood 0.5, black 0.12 (model values).
 *  - The trimmer sets the reference. The signal equals the reference at `rangeCm` for a white surface, so the detection
 *    distance of a surface is rangeCm * sqrt(reflectivity). Real range is about 2 to 30 cm.
 *  - OUT is LOW while an obstacle is detected (indicator LED on) and HIGH otherwise (the board pulls it up).
 *  - Strong sunlight saturates the photodiode and reads as a permanent obstacle: toggle `sunlight` to see it.
 * Pair: scene/parts/ir-obstacle-fc51.ts (3D). Guide: docs/lab-extending.md
 */
import {defineDevice,clamp,num} from './types';
import {uno} from './core/util';

export type IrObstacleFc51State={detected:boolean;high:boolean;distanceCm:number;signal:number;rangeCm:number;sunlight:boolean;powered:boolean};

export const REFLECTIVITY:Record<string,number>={white:1,wood:0.5,black:0.12};
export const NONE_CM=60;
/** Detection distance (cm) for a surface at the current trimmer range. */
export const reach=(rangeCm:number,surface:string):number=>rangeCm*Math.sqrt(REFLECTIVITY[surface]??1);
/** Reflected signal relative to the trimmer reference: 1 at the reach of that surface. */
export const signalAt=(cm:number,rangeCm:number,surface:string):number=>{const r=reach(rangeCm,surface);return cm>=NONE_CM?0:(r/Math.max(cm,0.1))**2;};

export const device=defineDevice<IrObstacleFc51State>({
 kind:'ir-obstacle-fc51',protocol:'switch',
 // physical order on the module header: OUT, GND, VCC
 pins:['OUT','GND','VCC'],holes:[0,1,2],bodyX:[-4,22],
 copy:{
  name:{en:'IR obstacle sensor (FC-51)',id:'Sensor halangan IR (FC-51)'},
  desc:{en:'An infrared LED and a photodiode side by side. When something reflects enough light back, OUT goes LOW. The trimmer sets how far it sees.',id:'LED inframerah dan fotodioda berdampingan. Saat sesuatu memantulkan cukup cahaya, OUT menjadi LOW. Trimmer mengatur seberapa jauh jangkauannya.'},
  note:{en:'Move the object. A black surface is seen later than a white one, and strong sunlight fools it.',id:'Geser bendanya. Permukaan hitam terlihat lebih dekat daripada putih, dan sinar matahari kuat bisa mengelabuinya.'},
 },
 power:{rail:['VCC','GND'],min:3.3,max:5.5,ma:20},
 inputs:[
  {type:'range',key:'distanceCm',label:{en:'Object distance (60 = none)',id:'Jarak benda (60 = tidak ada)'},min:1,max:60,step:1,unit:'cm',default:60},
  {type:'choice',key:'surface',label:{en:'Surface',id:'Permukaan'},options:[{value:'white',label:{en:'White',id:'Putih'}},{value:'wood',label:{en:'Wood',id:'Kayu'}},{value:'black',label:{en:'Black',id:'Hitam'}}],default:'white'},
  {type:'range',key:'rangeCm',label:{en:'Range (trimmer)',id:'Jangkauan (trimmer)'},min:2,max:30,step:1,unit:'cm',default:12},
  {type:'toggle',key:'sunlight',label:{en:'Strong sunlight',id:'Sinar matahari kuat'},default:false},
 ],
 defaults:{distanceCm:60,surface:'white',rangeCm:12,sunlight:false},
 create(ctx){
  const out=uno(ctx.net('OUT'));
  let last:boolean|null=null;
  const powered=():boolean=>(ctx.supply()??5)>=2.7;
  const read=()=>{
   const cm=clamp(num(ctx.props.distanceCm,60),1,60),range=clamp(num(ctx.props.rangeCm,12),2,30);
   const surface=typeof ctx.props.surface==='string'?ctx.props.surface:'white';
   const sun=ctx.props.sunlight===true,sig=sun?9:signalAt(cm,range,surface);
   return {cm,range,sun,sig,detected:powered()&&sig>=1};
  };
  const sync=():boolean=>{
   const d=read().detected;
   if(out&&d!==last)ctx.env.setPin(out,!d);   // OUT is LOW on detection
   last=d;return d;
  };
  sync();
  return {
   state:()=>{const r=read();sync();return {detected:r.detected,high:!r.detected,distanceCm:r.cm,signal:Math.round(Math.min(r.sig,9)*100)/100,rangeCm:r.range,sunlight:r.sun,powered:powered()};},
   tick(){sync();},
  };
 },
});
