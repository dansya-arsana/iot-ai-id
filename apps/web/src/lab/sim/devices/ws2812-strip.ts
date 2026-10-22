/**
 * WS2812-STRIP device (protocol 'ws2812'): WS2812B style RGB LEDs on ONE data wire. Three layouts share the model:
 * an 8 LED stick, a 16 LED ring and an 8x8 matrix (64 LEDs). Each LED holds a 24 bit shift register: the first LED
 * eats the first 24 bits of a frame and passes the rest on, so a chain keeps the first N pixels of a longer stream.
 *
 * Signal (WS2812B datasheet, written from the public timing table): NZR at 800 kHz (1.25 us per bit, +-600 ns),
 * T0H 0.4 us, T1H 0.8 us (each +-150 ns); colour order G,R,B with the MSB first; a low of 50 us or more latches the
 * frame (the newer V5 parts want 280 us). The decoder in core/bitbang.ts measures the high pulse of every bit from
 * cycle-stamped edges, so a sketch with a wrong timing shows up in `timingErrors`.
 * Pair: scene/parts/ws2812-strip.ts (3D). Guide: docs/lab-extending.md
 */
import {defineDevice} from './types';
import {Ws2812Decoder} from './core/bitbang';

export type Ws2812Shape='strip'|'ring'|'matrix';
export const WS2812_COUNT:Record<Ws2812Shape,number>={strip:8,ring:16,matrix:64};
/** Typical current of one LED lit white at full level (3 x ~20 mA, datasheet). */
export const WS2812_MA_FULL=60;

export type Ws2812StripState={
 shape:Ws2812Shape;count:number;
 /** every kept LED as rrggbb, in chain order */
 leds:string;
 frames:number;timingErrors:number;
 /** estimated supply current of the lit LEDs in mA (channel level / 255 x 20 mA) */
 ma:number;
};

const shapeOf=(v:unknown):Ws2812Shape=>v==='ring'||v==='matrix'?v:'strip';

export const device=defineDevice<Ws2812StripState>({
 kind:'ws2812-strip',protocol:'ws2812',
 // desk prop: the real parts come with a 3 wire pigtail, so every pin is a wire-only terminal
 pins:['VCC','DIN','GND'],
 power:{rail:['VCC','GND'],min:3.5,max:5.3,ma:60},
 copy:{
  name:{en:'WS2812 LEDs (stick, ring, matrix)',id:'LED WS2812 (stick, ring, matriks)'},
  desc:{en:'Addressable RGB LEDs on a single data wire. The sketch sends 24 bits per LED at 800 kHz (green, red, blue) and the first LED passes the rest on.',id:'LED RGB yang bisa dialamati lewat satu kabel data. Sketch mengirim 24 bit per LED pada 800 kHz (hijau, merah, biru) dan LED pertama meneruskan sisanya.'},
  note:{en:'Pick the layout in the popover: stick of 8, ring of 16 or 8x8 matrix.',id:'Pilih bentuk di popover: stick 8, ring 16 atau matriks 8x8.'},
 },
 inputs:[{type:'choice',key:'shape',label:{en:'Layout',id:'Bentuk'},options:[
  {value:'strip',label:{en:'Stick, 8 LEDs',id:'Stick, 8 LED'}},
  {value:'ring',label:{en:'Ring, 16 LEDs',id:'Ring, 16 LED'}},
  {value:'matrix',label:{en:'Matrix, 8x8',id:'Matriks, 8x8'}},
 ],default:'strip'}],
 defaults:{shape:'strip'},
 create(ctx){
  let leds='',frames=0,timingErrors=0,ma=0;
  const shape=():Ws2812Shape=>shapeOf(ctx.props.shape);
  const count=():number=>WS2812_COUNT[shape()];
  const din=ctx.pin('DIN');
  const dec=new Ws2812Decoder({
   schedule:(c,cb)=>ctx.schedule(c,cb),
   // read lazily: a popover change of the layout applies to the next frame
   get count(){return count();},
   onFrame(fr){
    leds=fr.pixels.map(p=>p.map(v=>v.toString(16).padStart(2,'0')).join('')).join('');
    frames++;timingErrors+=fr.timingErrors;
    ma=Math.round(fr.pixels.reduce((s,p)=>s+(p[0]+p[1]+p[2])/255*20,0));
   },
  });
  return {
   state:()=>({shape:shape(),count:count(),leds,frames,timingErrors,ma}),
   onPinChange:(pin,level,cycle)=>{if(pin===din)dec.edge(level,cycle);},
  };
 },
});
