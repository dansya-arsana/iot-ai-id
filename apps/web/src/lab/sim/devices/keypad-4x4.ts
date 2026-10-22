/**
 * KEYPAD-4X4 (protocol switch): 16-key membrane keypad, 4 row lines and 4 column lines on an 8-pin header (R1-R4, C1-C4).
 * A pressed key is a plain contact between its row line and its column line; nothing else is on the pad (no pull-ups, no diodes).
 * The sketch scans: it drives one line LOW as an output and reads the other group with INPUT_PULLUP (either direction works),
 * exactly what the Arduino Keypad-style libraries do. This model solves the real nets: the pressed keys join row and column lines
 * into groups; a line that is not driven by the sketch takes the level of a driven line in its group, otherwise it floats HIGH
 * (the sketch's pull-up). With three keys pressed in an L shape a fourth contact is also joined: the classic ghost key, shown in state.
 * Layout: row 1 = 1 2 3 A, row 2 = 4 5 6 B, row 3 = 7 8 9 C, row 4 = * 0 # D.
 * Pair: scene/parts/keypad-4x4.ts (3D). Guide: docs/lab-extending.md
 */
import {defineDevice} from './types';
import {uno} from './core/util';

export type Keypad4x4State={pressed:string;count:number;ghost:string;lowMask:number};
export const KEY_ROWS:readonly (readonly string[])[]=[['1','2','3','A'],['4','5','6','B'],['7','8','9','C'],['*','0','#','D']];
export const KEYS:readonly string[]=KEY_ROWS.flat();
/** Shortest tap the model keeps down, in simulated ms (a finger on a membrane key is down for far longer; the sketch scans every few ms). */
export const MIN_TAP_MS=80;
export const LINES:readonly string[]=['R1','R2','R3','R4','C1','C2','C3','C4'];
export const keyPos=(k:string):{r:number;c:number}|null=>{const i=KEYS.indexOf(k);return i<0?null:{r:Math.floor(i/4),c:i%4};};

/** Which lines are electrically joined by a set of pressed keys, as groups of line indexes (0-3 rows, 4-7 columns). */
export function groups(keys:readonly string[]):number[][]{
 const parent=[0,1,2,3,4,5,6,7];
 const find=(x:number):number=>parent[x]===x?x:(parent[x]=find(parent[x]!));
 for(const k of keys){const p=keyPos(k);if(p)parent[find(p.r)]=find(4+p.c);}
 const by=new Map<number,number[]>();
 for(let i=0;i<8;i++){const r=find(i);(by.get(r)??by.set(r,[]).get(r)!).push(i);}
 return [...by.values()];
}
/** Keys whose contact is not pressed but whose row and column are joined anyway (ghosting). */
export function ghosts(keys:readonly string[]):string[]{
 const g=groups(keys);
 const same=(a:number,b:number):boolean=>g.some(x=>x.includes(a)&&x.includes(b));
 return KEYS.filter(k=>{const p=keyPos(k)!;return !keys.includes(k)&&same(p.r,4+p.c);});
}

// laid out as the keypad itself (1 2 3 A / 4 5 6 B / 7 8 9 C / * 0 # D), with (none) in a last row
const keyOptions=[...KEYS.map(k=>({value:k,label:{en:k,id:k}})),{value:'none',label:{en:'(none)',id:'(tidak ada)'}}];

export const device=defineDevice<Keypad4x4State>({
 kind:'keypad-4x4',protocol:'switch',
 // header order of the ribbon: four row lines, then four column lines
 pins:[...LINES],
 copy:{
  name:{en:'4x4 membrane keypad',id:'Keypad membran 4x4'},
  desc:{en:'Sixteen keys on eight wires. Each key joins one row line to one column line. Drive a row LOW, read the columns with pull-ups, and the key that pulls a column LOW is the one pressed.',id:'Enam belas tombol di delapan kabel. Setiap tombol menghubungkan satu baris ke satu kolom. Buat satu baris LOW, baca kolom dengan pull-up, dan tombol yang menarik kolom ke LOW adalah yang ditekan.'},
  note:{en:'Tap a key in the panel to press it for a moment. Open "Hold several keys" to keep two more down and see ghosting.',id:'Ketuk tombol di panel untuk menekannya sesaat. Buka "Tahan beberapa tombol" untuk menahan dua tombol lagi dan melihat ghosting.'},
 },
 inputs:[
  {type:'choice',key:'key',label:{en:'Press a key',id:'Tekan tombol'},options:keyOptions,default:'none',grid:4,momentaryMs:150},
  {type:'choice',key:'key2',label:{en:'Held key 1',id:'Tombol tahan 1'},options:keyOptions,default:'none',grid:4,fold:{en:'Hold several keys (ghosting)',id:'Tahan beberapa tombol (ghosting)'}},
  {type:'choice',key:'key3',label:{en:'Held key 2',id:'Tombol tahan 2'},options:keyOptions,default:'none',grid:4,fold:{en:'Hold several keys (ghosting)',id:'Tahan beberapa tombol (ghosting)'}},
 ],
 defaults:{key:'none',key2:'none',key3:'none'},
 create(ctx){
  const pins=LINES.map(n=>uno(ctx.net(n)));
  const last:(boolean|null)[]=LINES.map(()=>null);
  /** A tap (the momentary `key` control, a click on a 3D key) is down for at least MIN_TAP_MS of SIMULATED time, however long the page took to put it back:
   *  a browser frame can stall for a while and the simulation advances only a slice per frame, so a wall-clock tap could end before the sketch ever scanned it. */
  const tapUntil=new Map<string,number>();
  const pressedKeys=():string[]=>{
   const out:string[]=[];
   const now=ctx.env.now();
   const tap=ctx.props.key;
   if(typeof tap==='string'&&keyPos(tap)&&!tapUntil.has(tap))tapUntil.set(tap,now+MIN_TAP_MS*16000);
   for(const [k,until] of tapUntil)if(now>=until&&ctx.props.key!==k)tapUntil.delete(k);
   for(const k of ['key','key2','key3']){const v=ctx.props[k];if(typeof v==='string'&&keyPos(v)&&!out.includes(v))out.push(v);}
   for(const k of tapUntil.keys())if(!out.includes(k))out.push(k);
   return out;
  };
  let lowMask=0;
  /** Solve the nets and drive every line the sketch is not driving. */
  const solve=():string[]=>{
   const keys=pressedKeys();
   lowMask=0;
   for(const grp of groups(keys)){
    const driven=grp.filter(i=>pins[i]&&ctx.hostDrives(pins[i]!));
    const lows=driven.some(i=>ctx.pinLevel(pins[i]!)===0);
    // a driven line wins; two drivers fight and LOW wins; no driver = the sketch's pull-up
    const level=driven.length?!lows:true;
    for(const i of grp){
     const pin=pins[i];
     if(!pin)continue;
     if(driven.includes(i))last[i]=null;   // the sketch owns this line now; re-assert our level when it lets go
     else if(last[i]!==level){last[i]=level;ctx.env.setPin(pin,level);}
     const eff=driven.includes(i)?ctx.pinLevel(pin)===1:level;
     if(!eff)lowMask|=1<<i;
    }
   }
   return keys;
  };
  solve();
  return {
   state:()=>{const keys=solve();return {pressed:keys.join(','),count:keys.length,ghost:ghosts(keys).join(','),lowMask};},
   onPinChange(){solve();},
   tick(){solve();},
  };
 },
});
