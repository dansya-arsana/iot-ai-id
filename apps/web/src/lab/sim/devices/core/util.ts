import type {BoardPin,UnoPin} from '../../../contract';
import {UNO_PINS} from '../../../contract';
import type {Frame} from '../types';

const UNO=new Set<string>(UNO_PINS);
export const uno=(p:BoardPin|undefined):UnoPin|null=>p&&UNO.has(p)?p as UnoPin:null;
/** Output duty of a board net. Rails are constant; input pins are not driven. */
export function duty(net:BoardPin|undefined,f:Frame):number{
 if(net==='5V'||net==='VIN')return 1;
 const p=uno(net);
 if(!p)return 0;
 const s=f.samples[p];
 return s.mode==='output'?s.duty:0;
}
export const freq=(net:BoardPin|undefined,f:Frame):number=>{const p=uno(net);return p?f.samples[p].freqHz:0;};
