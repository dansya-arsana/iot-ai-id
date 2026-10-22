import {SIM_CLOCK_HZ} from '../../contract';
import {defineDevice,num} from './types';

export const device=defineDevice({
 kind:'hcsr04',protocol:'pulse',legacyState:true,pins:['VCC','TRIG','ECHO','GND'],inputs:[],
 power:{rail:['VCC','GND'],min:4.5,max:5.5,ma:15},
 create(ctx){
  const trig=ctx.pin('TRIG'),echo=ctx.pin('ECHO');
  let rise=0,busy=false,lastTrig=-Infinity,nowCycles=0;
  const target=()=>ctx.siblings().find(m=>m.spec.kind==='obstacle'&&m.props.target===ctx.id);
  const dist=():number|null=>{const t=target();return t?num(t.props.distanceCm,0):null;};
  return {
   state:()=>{const d=dist();return {kind:'hcsr04',pinging:nowCycles-lastTrig<SIM_CLOCK_HZ*0.1,echoCm:d!==null&&d<=400?d:null};},
   update(f){nowCycles=f.cycles;},
   onPinChange(pin,level,cycle){
    if(pin!==trig||!echo)return;
    if(level===1){rise=cycle;return;}
    if(cycle-rise<160||busy)return;
    busy=true;lastTrig=cycle;
    ctx.schedule(4000,()=>{
     const d=dist();
     const width=d!==null&&d<=400?(Math.round(d*58)+29)*16:Math.round(SIM_CLOCK_HZ*0.038);
     ctx.drive(echo,[{level:1,holdCycles:width},{level:0,holdCycles:0}],{onDone:()=>{busy=false;}});
    });
   },
  };
 },
});
