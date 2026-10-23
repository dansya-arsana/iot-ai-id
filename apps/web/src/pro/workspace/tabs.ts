/** Registers every dock panel once (wiring, code, checklist, BOM, power, checks) and gives each a count badge from the stored spec. */
import {createElement} from 'react';
import {getProState,registerDockTab} from '../api/spec-store';
import {registerWiringTab} from '../wiring/WiringPanel';
import {registerCodeTab} from '../code/CodeTab';
import {ChecklistPanel} from '../checklist';
import {registerBomPowerChecksTabs} from '../bom/register';

let done=false;
export function registerProTabs():void{
 if(done)return;done=true;
 registerWiringTab();registerCodeTab();
 registerDockTab({id:'checklist',label:'Checklist',order:30,badge:()=>{const n=getProState().spec?.checklist.length;return n?String(n):undefined;},render:()=>createElement(ChecklistPanel)});
 registerBomPowerChecksTabs();
}
