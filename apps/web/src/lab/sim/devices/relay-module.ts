/**
 * RELAY-MODULE (1-channel 5 V, SRD-05VDC-SL-C class, protocol gpio): an opto-isolated driver and a 10 A SPDT relay.
 * IN is ACTIVE-LOW on the common blue module (the LED+coil conduct when IN is pulled to ground); a jumper selects active-high on some boards.
 * The armature moves with the coil: operate time <= 10 ms, release time <= 5 ms (datasheet). De-energised, COM touches NC; energised, COM touches NO.
 * The coil draws about 70 mA from VCC (SRD-05VDC: 71.4 mA); a floating or input-mode IN counts as "not driven".
 * Pair: scene/parts/relay-module.ts. Guide: docs/lab-extending.md
 */
import {defineDevice} from './types';
import {duty} from './core/util';

export const RELAY_OPERATE_MS=10;
export const RELAY_RELEASE_MS=5;
export const RELAY_COIL_MA=71;

export type RelayState={
 /** the coil is carrying current (after the operate/release delay) */energized:boolean;
 /** the input is requesting the coil right now (before the mechanical delay) */commanded:boolean;
 /** which terminal COM is connected to */comTo:string;
 /** status LED lit */ledOn:boolean;coilMa:number;
 /** how many times the contact changed (a click each) */clicks:number;powered:boolean;activeLow:boolean;
};

export const device=defineDevice<RelayState>({
 kind:'relay-module',protocol:'gpio',
 pins:['VCC','GND','IN','COM','NO','NC'],// COM/NO/NC are the screw terminals of the switched side (wires only); no breadboard holes: the board is too big, so it stands beside the breadboard on jumper wires (scene/layout.ts offBoard)
 
 copy:{
  name:{en:'Relay module (1 channel, 5 V)',id:'Modul relay (1 kanal, 5 V)'},
  desc:{en:'A small electromagnet closes a switch that can carry mains-class loads. Pull IN low and the relay clicks: COM joins NO and the red LED lights.',id:'Elektromagnet kecil menutup saklar yang kuat menahan beban besar. Tarik IN ke low maka relay berbunyi klik: COM tersambung ke NO dan LED menyala.'},
  note:{en:'Active-low: LOW switches it on. Never wire mains in a classroom; use a low-voltage load.',id:'Aktif-low: LOW menyalakannya. Jangan pernah memasang listrik PLN di kelas; pakai beban tegangan rendah.'},
 },
 power:{rail:['VCC','GND'],min:4,max:6,ma:71},
 inputs:[{type:'choice',key:'trigger',label:{en:'Trigger level',id:'Level pemicu'},options:[{value:'low',label:{en:'Active low (typical)',id:'Aktif low (umum)'}},{value:'high',label:{en:'Active high',id:'Aktif high'}}],default:'low'}],
 defaults:{trigger:'low'},
 create(ctx){
  let energized=false,commanded=false,pendingMs=0,clicks=0,coilMa=0;
  let st:RelayState={energized:false,commanded:false,comTo:'NC',ledOn:false,coilMa:0,clicks:0,powered:false,activeLow:true};
  return {
   state:()=>st,
   // the contact: COM joins NO while the coil is energised, NC while it is not (the net solver merges the nets of a closed contact)
   switches:()=>[{a:'COM',b:'NO',closed:st.energized},{a:'COM',b:'NC',closed:!st.energized}],
   update(f){
    const activeLow=ctx.props.trigger!=='high';
    const powered=ctx.net('VCC')==='5V';
    const inNet=ctx.net('IN');
    // the sketch must drive IN as an output (or tie it to a rail); a floating pin does not switch the coil
    const driven=inNet==='5V'||inNet==='GND'||(typeof inNet==='string'&&f.samples[inNet as keyof typeof f.samples]?.mode==='output');
    const d=driven?duty(inNet,f):0;
    const want=powered&&driven&&(activeLow?d<0.5:d>=0.5);
    if(want!==commanded){commanded=want;pendingMs=0;}
    if(want!==energized){
     pendingMs+=f.dtSec*1000;
     if(pendingMs>=(want?RELAY_OPERATE_MS:RELAY_RELEASE_MS)){energized=want;pendingMs=0;clicks++;}
    }
    coilMa=energized&&powered?RELAY_COIL_MA:0;
    st={energized,commanded,comTo:energized?'NO':'NC',ledOn:energized,coilMa,clicks,powered,activeLow};
   },
  };
 },
});
