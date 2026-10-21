/** WebAudio square-wave voice for the buzzer. Created on a user gesture, closed on unmount. */
export interface BuzzerAudio{update(running:boolean,enabled:boolean,on:boolean,freqHz:number,volume:number):void;close():void}

export function createBuzzerAudio():BuzzerAudio|null{
 const Ctor=typeof window==='undefined'?undefined:(window.AudioContext??(window as unknown as {webkitAudioContext?:typeof AudioContext}).webkitAudioContext);
 if(!Ctor)return null;
 let ctx:AudioContext;
 try{ctx=new Ctor();}catch{return null;}
 const gain=ctx.createGain();gain.gain.value=0;gain.connect(ctx.destination);
 const osc=ctx.createOscillator();osc.type='square';osc.frequency.value=440;osc.connect(gain);osc.start();
 return {
  update(running,enabled,on,freqHz,volume){
   const audible=running&&enabled&&on&&freqHz>20;
   if(audible&&ctx.state==='suspended')void ctx.resume().catch(()=>undefined);
   if(audible)osc.frequency.setTargetAtTime(freqHz,ctx.currentTime,0.005);
   gain.gain.setTargetAtTime(audible?volume*0.08:0,ctx.currentTime,0.01);
  },
  close(){try{osc.stop();void ctx.close();}catch{/* already closed */}},
 };
}
