import {defineDevice} from './types';

export const device=defineDevice({
 kind:'resistor',protocol:'gpio',legacyState:true,pins:['1','2'],inputs:[],
 create:()=>({state:()=>({kind:'passive'})}),
});
