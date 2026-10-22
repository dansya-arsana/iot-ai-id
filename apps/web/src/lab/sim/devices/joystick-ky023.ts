/**
 * JOYSTICK-KY023 (protocol adc): the common thumb joystick module: two 10 kohm potentiometers at right angles (VRx, VRy) and a
 * push switch under the stick (SW). Each axis is a plain voltage divider between +5V and GND, so the wiper voltage is
 * supply x position, centred near half supply; the sketch reads it with analogRead (10-bit, 0..1023 at 5 V). SW is a contact to
 * GND: it reads LOW while the stick is pushed down and the module pulls it up when released (the sketch may also enable INPUT_PULLUP).
 * Written from the public behaviour of this module family. The stick is tilted by dragging it in 3D or from the popover (X, Y) and pressed by clicking it for SW.
 * Pair: scene/parts/joystick-ky023.ts (3D). Guide: docs/lab-extending.md
 */
import {ADC_CHANNEL} from '../../contract';
import {defineDevice,clamp,num} from './types';
import {uno} from './core/util';

export type JoystickKy023State={x:number;y:number;vx:number;vy:number;pressed:boolean;sw:boolean};
/** Raw ADC span of the 10-bit converter. */
export const AXIS_MAX=1023;
export const AXIS_CENTER=512;

export const device=defineDevice<JoystickKy023State>({
 kind:'joystick-ky023',protocol:'adc',
 // silkscreen order of the 5-pin header
 pins:['GND','+5V','VRx','VRy','SW'],holes:[0,1,2,3,4],bodyX:[-8,18.2],
 copy:{
  name:{en:'Joystick module (KY-023)',id:'Modul joystick (KY-023)'},
  desc:{en:'A thumb stick with two potentiometers, one per axis, and a push switch. VRx and VRy give a voltage that follows the stick, SW goes LOW when you press the stick down.',id:'Joystick jempol dengan dua potensiometer, satu per sumbu, dan saklar tekan. VRx dan VRy memberi tegangan yang mengikuti stick, SW menjadi LOW saat stick ditekan.'},
  note:{en:'Click the stick to press it, or drag it to tilt (it springs back). The panel sets X and Y too.',id:'Klik stick untuk menekannya, atau seret untuk memiringkannya (kembali ke tengah). Panel juga mengatur X dan Y.'},
 },
 power:{rail:['+5V','GND'],min:3,max:5.5,ma:1},
 inputs:[
  {type:'range',key:'x',label:{en:'X axis (ADC counts, 512 = centre)',id:'Sumbu X (hitungan ADC, 512 = tengah)'},min:0,max:AXIS_MAX,step:1,default:AXIS_CENTER},
  {type:'range',key:'y',label:{en:'Y axis (ADC counts, 512 = centre)',id:'Sumbu Y (hitungan ADC, 512 = tengah)'},min:0,max:AXIS_MAX,step:1,default:AXIS_CENTER},
  {type:'toggle',key:'pressed',label:{en:'Stick pressed (SW)',id:'Stick ditekan (SW)'},default:false},
 ],
 defaults:{x:AXIS_CENTER,y:AXIS_CENTER,pressed:false},
 create(ctx){
  const sw=uno(ctx.net('SW'));
  const ax=ctx.analogPin('VRx'),ay=ctx.analogPin('VRy');
  let lastSw:boolean|null=null,held=false;
  const axis=(k:'x'|'y'):number=>clamp(Math.round(num(ctx.props[k],AXIS_CENTER)),0,AXIS_MAX);
  /** Supply across the module; an unwired supply is taken as the 5 V rail the module is meant for. */
  const vcc=():number=>ctx.supply()??5;
  const volts=(k:'x'|'y'):number=>axis(k)/AXIS_MAX*vcc();
  /** Push the second axis (the adapter polls only one adc() pin) and the SW contact whenever they changed. */
  const sync=():boolean=>{
   const down=held||ctx.props.pressed===true;
   if(sw&&down!==lastSw){ctx.env.setPin(sw,!down);lastSw=down;}  // contact to GND: pressed = LOW, module pull-up = HIGH
   if(ay){const ch=ADC_CHANNEL[ay];if(ch!==undefined)ctx.env.setAdc(ch,volts('y'));}
   return down;
  };
  sync();
  return {
   state:()=>{const down=sync();return {x:axis('x'),y:axis('y'),vx:Math.round(volts('x')*1000)/1000,vy:Math.round(volts('y')*1000)/1000,pressed:down,sw:!down};},
   // a click on the 3D stick arrives as a button input; it is momentary, the popover toggle is sticky
   setInput(i){if(i.kind==='button'){held=i.pressed;sync();}},
   tick(){sync();},
   adc:()=>ax?{pin:ax,volts:volts('x')}:null,
  };
 },
});
