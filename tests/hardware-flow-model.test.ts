import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createGoldenContract} from '../packages/component-catalog/index';
import {canonicalBoardPin,graphParts,normalizeConnection,replaceWire,wireId,wiringIssues,wiringSignature} from '../apps/web/src/hardware-flow-model';
test('asset labels normalize to trusted canonical ESP32 pins',()=>{for(const [asset,pin] of Object.entries({D21:'21',RX2:'16',TX2:'17',RX0:'3',TX0:'1',VP:'36',VN:'39',VIN:'5V','GND.1':'GND','GND.2':'GND'}))assert.equal(canonicalBoardPin(asset),pin);});
test('connections normalize either direction and refuse internal nets or part-to-part',()=>{const forward={source:'esp32-devkit',sourceHandle:'21',target:'bme280',targetHandle:'SDA'};assert.deepEqual(normalizeConnection(forward,'esp32-devkit'),{componentId:'bme280',pin:'SDA',boardPin:'21'});assert.deepEqual(normalizeConnection({source:forward.target,target:forward.source,sourceHandle:forward.targetHandle,targetHandle:forward.sourceHandle},'esp32-devkit'),normalizeConnection(forward,'esp32-devkit'));assert.equal(normalizeConnection({...forward,target:'button::R1'},'esp32-devkit'),null);assert.equal(normalizeConnection({...forward,source:'ssd1306'},'esp32-devkit'),null);});
test('golden graph retains eight wires; reconnect replaces exactly one terminal',()=>{const contract=createGoldenContract();assert.equal(contract.connections.length,8);assert.equal(new Set(contract.connections.map(wireId)).size,8);const changed=replaceWire(contract.connections,{componentId:'bme280',pin:'SDA',boardPin:'18'});assert.equal(changed.length,8);assert.equal(changed.filter(w=>w.boardPin==='18').length,1);assert.notEqual(wiringSignature(changed),wiringSignature(contract.connections));assert.equal(wiringSignature([...contract.connections].reverse()),wiringSignature(contract.connections));assert.deepEqual(wiringIssues(contract,contract.connections),[]);assert.ok(wiringIssues(contract,contract.connections.slice(1)).length);});
test('planning selected parts exclude archived components and expose catalog manifests',()=>{const contract=createGoldenContract();const manifests=graphParts(contract,['ssd1306','led'],[{id:'led',name:'LED'}]);assert.deepEqual(manifests.map(m=>m.id),['ssd1306','led']);});

test('preview uses full electrical and recipe validation before Apply',async()=>{
 const {previewWiring}=await import('../apps/web/src/hardware-flow-model');
 const contract=createGoldenContract();assert.equal(previewWiring(contract,contract.connections).valid,true);
 for(const [pin,boardPin,code] of [['VCC','5V','voltage_current_power'],['SDA','6','reserved_pin'],['SDA','34','pin_capability'],['SDA','19','bus_conflict']]){
  const wires=contract.connections.map(w=>w.componentId==='bme280'&&w.pin===pin?{...w,boardPin}:w);const result=previewWiring(contract,wires);assert.equal(result.valid,false);assert.ok(result.errors.some(e=>e.code===code),code);
 }
 const unknown=previewWiring(contract,[...contract.connections,{componentId:'unknown',pin:'X',boardPin:'21'}]);assert.ok(unknown.errors.some(e=>e.code==='unknown_component'));
 const candidate=structuredClone(contract);candidate.firmware.libraries=[];assert.ok(previewWiring(candidate,candidate.connections).errors.some(e=>e.code==='library'));
});
