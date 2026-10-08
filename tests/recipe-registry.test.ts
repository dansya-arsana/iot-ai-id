import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createGoldenContract,getComponent} from '../packages/component-catalog/index.js';
import {HardwareContractSchema,CHECKS} from '../packages/hardware-contract/index.js';
import {generateFirmware} from '../packages/hardware-contract/firmware.js';
import {goldenRecipe,recipes,resolveRecipe} from '../packages/recipe-registry/index.js';
import {validateContract} from '../packages/validator/index.js';
import {contractHash,hashText,verifyEvidence} from '../packages/evidence/index.js';

test('legacy contract identity and source remain byte equivalent',()=>{
 const contract=createGoldenContract('recipe-regression',3);
 assert.equal(Object.hasOwn(HardwareContractSchema.parse(contract),'recipe'),false);
 assert.equal(contractHash(contract),'b5d3ecfaef42df0ecbd69de012263a916094de63ddf16e8bcabb0538c63785a1');
 const artifact=generateFirmware(contract,{experimentId:'recipe-run',nonce:'recipe-nonce'});
 assert.equal(artifact.source,readFileSync(new URL('./fixtures/golden-legacy.ino',import.meta.url),'utf8'));
 assert.equal(artifact.sourceHash,'4edddf097f8bd15b2ec6b7748831a7ffdafaa4105f1d249a57611f79b14ace2b');
});
test('explicit recipe supported and trusted metadata immutable',()=>{
 const contract=createGoldenContract();contract.recipe={id:goldenRecipe.id,version:goldenRecipe.version};
 assert.equal(validateContract(contract).valid,true);
 assert.equal(resolveRecipe(contract),goldenRecipe);
 assert.equal(recipes.length,2);
 assert.throws(()=>{(goldenRecipe.checks as string[]).pop();},TypeError);
 assert.throws(()=>{(goldenRecipe.valueRanges.temperature as unknown as number[])[0]=0;},TypeError);
 generateFirmware(contract,{experimentId:'explicit',nonce:'n'});
});
test('recipe and execution metadata tampering fails generation and evidence',()=>{
 const mutations=[
  (c:ReturnType<typeof createGoldenContract>)=>{c.recipe={id:'distance-monitor',version:1};},
  (c:ReturnType<typeof createGoldenContract>)=>{c.recipe={id:goldenRecipe.id,version:2};},
  (c:ReturnType<typeof createGoldenContract>)=>{c.verification.checks.pop();},
  (c:ReturnType<typeof createGoldenContract>)=>{c.firmware.generator='provider-generator';},
  (c:ReturnType<typeof createGoldenContract>)=>{c.firmware.libraries=c.firmware.libraries.filter(library=>library!=='Adafruit BusIO');},
  (c:ReturnType<typeof createGoldenContract>)=>{c.components.push(structuredClone(c.components[0]));},
  (c:ReturnType<typeof createGoldenContract>)=>{c.expected.valueRanges={};},
  (c:ReturnType<typeof createGoldenContract>)=>{c.expected.devices=[];}
 ];
 for(const mutate of mutations){
  const contract=createGoldenContract();mutate(contract);
  assert.equal(validateContract(contract).valid,false);
  assert.throws(()=>generateFirmware(contract,{experimentId:'tamper',nonce:'n'}));
  const identity={experimentId:'tamper',nonce:'n',contractHash:contractHash(contract),firmwareHash:hashText('firmware')};
  const data:Record<string,Record<string,unknown>>={board_detected:{boardId:'esp32-devkit'},compiled:{success:true},flashed:{success:true},device_addresses:{addresses:[0x76,0x3c]},sensor_readings:{temperature:25,humidity:60},oled_initialized:{initialized:true,addressAck:true}};
  const rows=CHECKS.map(check=>({...identity,id:check,source:'physical',timestamp:new Date().toISOString(),check,passed:true,artifactHash:hashText(check),artifactId:check,data:data[check]}));
  assert.equal(verifyEvidence(contract,identity,rows).passed,false);
 }
 const contract=createGoldenContract();contract.verification.checks=[];
 const identity={experimentId:'tamper',nonce:'n',contractHash:contractHash(contract),firmwareHash:hashText('firmware')};
 assert.equal(Object.keys(verifyEvidence(contract,identity,[]).checks).length,goldenRecipe.checks.length);
});

test('planning-only catalog drafts retain electrical validation but cannot execute',()=>{
 const contract=createGoldenContract();
 const sensor=contract.components[0];sensor.manifest=structuredClone(getComponent('bmp280')!);
 contract.firmware.libraries.push('Adafruit BMP280 Library');
 assert.equal(validateContract(contract).valid,true);
 assert.equal(validateContract(contract,{execution:true}).valid,false);
 assert.throws(()=>generateFirmware(contract,{experimentId:'planning',nonce:'n'}));
});
