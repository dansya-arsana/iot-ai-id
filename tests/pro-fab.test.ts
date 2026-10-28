import test from 'node:test';
import assert from 'node:assert/strict';
import {jlcBom,jlcCpl,type Placement} from '../packages/pro-tools/impl/fab.js';
import {partnerPrefill} from '../apps/web/src/pro/print/partner-prefill.js';
const ps:Placement[]=[{ref:'R2',value:'10k',footprint:'R_0603',x:5,y:2.5,rot:-90,lcsc:'C25804'},{ref:'R1',value:'10k',footprint:'R_0603',x:1,y:2,lcsc:'C25804'},{ref:'U1',value:'=ESP',footprint:'SOIC',x:0,y:0,side:'bottom'}];
test('BOM groups and sorts',()=>{const b=jlcBom(ps).split('\n');assert.equal(b[0],'Comment,Designator,Footprint,LCSC Part #');assert.equal(b[1],'"10k","R1,R2","R_0603","C25804"');assert.match(b[2]!,/^"'=ESP"/);});
test('CPL rotation and layer',()=>{const c=jlcCpl(ps).split('\n');assert.equal(c[1],'"R1",1.000mm,2.000mm,Top,0');assert.equal(c[2],'"R2",5.000mm,2.500mm,Top,270');assert.match(c[3]!,/Bottom,0$/);});
test('partner prefill',()=>{const p=partnerPrefill({projectId:'p1',revision:3,buildSheetUrl:'https://x/y',bom:[{key:'esp32',qty:2}]});const u=new URL(p.href,'https://a');assert.equal(u.pathname,'/partner');assert.equal(u.searchParams.get('rev'),'3');assert.match(p.message,/esp32 x2/);});
