import {createElement} from 'react';
import {registerDockTab,getProState} from '../api/spec-store';
import {BomTab} from './BomTab';
import {PowerTab} from '../power/PowerTab';
import {ChecksTab} from '../checks/ChecksTab';

/** Registers the BOM, Power and Checks dock tabs. Returns an unregister function. Integrator calls this once. */
export function registerBomPowerChecksTabs():()=>void{
 const off=[
  registerDockTab({id:'bom',label:'BOM',order:40,badge:()=>{const s=getProState().spec;return s?String(s.bom.lines.length):undefined;},render:()=>createElement(BomTab)}),
  registerDockTab({id:'power',label:'Power',order:50,render:()=>createElement(PowerTab)}),
  registerDockTab({id:'checks',label:'Checks',order:60,badge:()=>{const s=getProState().spec;return s&&s.checks.length?String(s.checks.length):undefined;},render:()=>createElement(ChecksTab)}),
 ];
 return()=>off.forEach(f=>f());
}
