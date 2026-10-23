/** Integrator hook: `registerChecklistTab()` adds the Checklist tab to the dock (badge = percent done, from the spec checklist and tick rows). */
import {createElement} from 'react';
import {registerDockTab} from '../api/spec-store';
import {ChecklistPanel} from './ChecklistPanel';

export {ChecklistPanel};
export const registerChecklistTab=()=>registerDockTab({id:'checklist',label:'Checklist',order:30,render:()=>createElement(ChecklistPanel)});
