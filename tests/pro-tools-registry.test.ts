import test from 'node:test';
import assert from 'node:assert/strict';
import {z} from 'zod';
import {PRO_TOOLS,PRO_TOOL_NAMES,getTool,anthropicTools,mcpTools,inputJsonSchema} from '../packages/pro-tools/registry.js';

const EXPECTED=['catalog_search','catalog_get_part','check_compatibility','allocate_pins','validate_netlist','solve_power','estimate_link','site_climate','compile_code','price_bom','save_revision','get_revision','render','load_skill','catalog_propose','device_detect','device_flash','serial_read','telemetry_read','evidence_status'];
test('registry has the 20 tools in fixed order with unique snake_case names',()=>{
 assert.deepEqual([...PRO_TOOL_NAMES],EXPECTED);
 assert.equal(new Set(PRO_TOOL_NAMES).size,20);
 for(const n of PRO_TOOL_NAMES)assert.match(n,/^[a-z][a-z0-9_]*$/);
});
test('every input converts to a JSON Schema object without transforms; every output is a zod type',()=>{
 for(const t of PRO_TOOLS){
  const js=inputJsonSchema(t);
  assert.equal(js.type,'object',t.name);assert.equal(js.$schema,undefined);
  assert.ok(t.description.length>20,t.name);
  assert.doesNotThrow(()=>z.toJSONSchema(t.output,{io:'output',unrepresentable:'throw'}),t.name);
  assert.ok(JSON.stringify(js).length<20_000,t.name+' schema size');
 }
});
test('device_flash needs native consent, is physical, client only and never MCP',()=>{
 const t=getTool('device_flash')!;
 assert.equal(t.consent,'native');assert.equal(t.mcp,false);assert.equal(t.effect,'physical');assert.equal(t.runsAt,'client');
 assert.ok(!mcpTools({local:true}).some(x=>x.name==='device_flash'));
 assert.ok(!mcpTools({local:false}).some(x=>x.name==='device_flash'));
 assert.equal(PRO_TOOLS.filter(x=>x.consent==='native').length,1);
 assert.equal(PRO_TOOLS.filter(x=>x.effect==='physical').length,1);
});
test('client and local tools are gated; MCP local tools only on the local bridge',()=>{
 for(const t of PRO_TOOLS.filter(x=>x.runsAt==='client'))assert.equal(t.access,'member-local',t.name);
 const names=(o:{clientTools?:string[]})=>anthropicTools(o).map(t=>t.name);
 assert.equal(names({}).length,16);
 assert.ok(!names({}).includes('device_flash'));
 assert.ok(names({clientTools:['device_flash']}).includes('device_flash'));
 assert.deepEqual(mcpTools({local:false}).map(t=>t.name).filter(n=>['device_detect','serial_read','telemetry_read'].includes(n)),[]);
 assert.equal(mcpTools({local:true}).length,19);
});
test('flags match the plan table',()=>{
 const g=(n:string)=>getTool(n)!;
 assert.equal(g('save_revision').effect,'write');assert.equal(g('save_revision').deterministic,false);
 assert.equal(g('compile_code').effect,'compute');assert.equal(g('render').effect,'ui');
 assert.equal(g('serial_read').consent,'port-trust');
 assert.equal(g('catalog_propose').effect,'write');
 for(const n of ['catalog_search','catalog_get_part','check_compatibility','allocate_pins','validate_netlist','solve_power','estimate_link','site_climate','price_bom','load_skill'])assert.equal(g(n).runsAt,'pure',n);
});
test('input limits hold',()=>{
 const p=(n:string,v:unknown)=>getTool(n)!.input.safeParse(v).success;
 assert.equal(p('catalog_search',{q:'x',limit:21}),false);assert.equal(p('catalog_search',{q:'x'}),true);
 assert.equal(p('compile_code',{target:'esp32',file:{name:'main.ino',content:'x'.repeat(40_001)}}),false);
 assert.equal(p('compile_code',{target:'esp32',file:{name:'main.ino',content:'void setup(){}'}}),true);
 assert.equal(p('save_revision',{projectId:'p',baseRevision:0,ops:[{op:'add',path:'/summary',value:1}],reason:'x'.repeat(201)}),false);
 assert.equal(p('save_revision',{projectId:'p',baseRevision:0,ops:Array.from({length:201},()=>({op:'remove',path:'/a'})),reason:'r'}),false);
 assert.equal(p('serial_read',{port:'/dev/x',maxLines:201}),false);
 assert.equal(p('telemetry_read',{projectId:'p',sinceMs:1,max:501}),false);
 assert.equal(p('site_climate',{}),false);assert.equal(p('site_climate',{regionId:'jatim'}),true);
 assert.equal(p('device_flash',{port:'p',projectId:'p',revision:1,nodeId:'n',fileSha:'zz'}),false);
 assert.equal(p('catalog_search',{q:'x',extra:1}),false,'strict inputs');
});
test('outputs: untrusted text is wrapped; flash result union',()=>{
 const s=getTool('serial_read')!.output;
 assert.equal(s.safeParse({lines:[{n:1,t:1,text:'hi'}],open:true}).success,false);
 assert.equal(s.safeParse({lines:[{n:1,t:1,text:{untrusted:'hi'}}],open:true}).success,true);
 const f=getTool('device_flash')!.output;
 assert.equal(f.safeParse({ok:false,error:'consent_required'}).success,true);
 assert.equal(f.safeParse({ok:true,bytes:1,ms:2}).success,true);
});
