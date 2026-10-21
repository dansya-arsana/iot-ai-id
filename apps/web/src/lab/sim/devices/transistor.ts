import {defineDevice} from './types';

export const device=defineDevice({
 kind:'transistor',protocol:'gpio',legacyState:true,pins:['B','C','E'],inputs:[],
 create:()=>({state:()=>({kind:'passive'})}),
});
