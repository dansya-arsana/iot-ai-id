import {test} from 'node:test';
import assert from 'node:assert/strict';
import {layoutBoard,MOD_W,zipBlobParts} from './board-view';

const node=(parts:string[],wires:any[])=>({parts:parts.map(id=>({id,kind:id.split('-')[0]})),wires}) as any;
test('grid places modules without overlap and inside the board',()=>{
 const v=layoutBoard(node(['a-1','b-1','c-1','d-1'],[]));
 assert.equal(v.modules.length,4);
 for(const m of v.modules){assert.ok(m.x+m.w<=v.w&&m.y+m.h<=v.h);}
 assert.equal(v.modules[3].x,v.modules[0].x);assert.ok(v.modules[3].y>v.modules[0].y);
 assert.equal(v.modules[1].x-v.modules[0].x>=MOD_W,true);
});
test('nets join board pads to modules; unknown ends become issues',()=>{
 const w=(id:string,p:string)=>({id,func:'signal',from:{part:'board',pin:'GPIO4'},to:{part:p,pin:'DQ'}});
 const v=layoutBoard(node(['a-1'],[w('W1','a-1'),w('W2','zz-9')]));
 assert.equal(v.pads.length,1);assert.equal(v.nets.length,1);assert.equal(v.issues.length,1);
});
test('empty node reports an issue; base64 decodes',()=>{
 assert.equal(layoutBoard(node([],[])).issues.length,1);
 assert.deepEqual([...zipBlobParts('UEs=')],[80,75]);
});
