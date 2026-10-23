import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import type {SystemSpec} from '../packages/pro-contract/system-spec.js';
import {getProState,proActions,nodeKey,partKey,registerDockTab} from '../apps/web/src/pro/api/spec-store.js';

const spec=JSON.parse(readFileSync(new URL('../packages/pro-contract/fixtures/farm-4-fields/spec.r1.json',import.meta.url),'utf8')) as SystemSpec;

test('setSpec keeps selection, hidden and isolate only while they still exist',()=>{
 proActions.setSpec('p',1,spec);
 const part=spec.nodes[0]!.parts[0]!;
 proActions.select({kind:'part',id:part.id,nodeId:spec.nodes[0]!.id});
 proActions.toggleHidden(nodeKey('node-melon'));proActions.toggleHidden(partKey('node-melon',part.id));proActions.isolate(nodeKey('node-melon'));
 assert.equal(getProState().hidden.length,2);
 const next={...spec,nodes:spec.nodes.filter(n=>n.id!=='node-melon'),fields:spec.fields.filter(f=>f.id!=='melon')} as SystemSpec;
 proActions.setSpec('p',2,next);
 assert.equal(getProState().selection,null);assert.deepEqual(getProState().hidden,[]);assert.equal(getProState().isolated,null);
 proActions.showAll();
});
test('toggleHidden flips and showAll clears isolate',()=>{
 proActions.setSpec('p',1,spec);
 proActions.toggleHidden('links');assert.deepEqual(getProState().hidden,['links']);
 proActions.toggleHidden('links');assert.deepEqual(getProState().hidden,[]);
 proActions.isolate(nodeKey('gateway'));proActions.showAll();assert.equal(getProState().isolated,null);
});
test('registerDockTab returns an unregister',()=>{
 const off=registerDockTab({id:'t',label:'T',render:()=>null});off();
});
