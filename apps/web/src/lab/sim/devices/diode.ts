import {defineDevice} from './types';

export const device=defineDevice({
 kind:'diode',protocol:'gpio',legacyState:true,pins:['A','K'],inputs:[],
 create:()=>({state:()=>({kind:'passive'})}),
});
