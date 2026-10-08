import type {CheckName,HardwareContract} from '../hardware-contract/index.js';

/** Trusted execution metadata. Planning-only catalog entries are not executable recipes. */
export interface Recipe {
 readonly id:string;
 readonly version:number;
 readonly boardId:string;
 readonly componentIds:readonly string[];
 readonly generator:string;
 readonly fqbn:string;
 readonly libraries:readonly string[];
 readonly checks:readonly CheckName[];
 readonly valueRanges:Readonly<Record<string,readonly [number,number]>>;
 readonly serialMarkers:readonly string[];
}
export const goldenRecipe:Recipe=Object.freeze({
 id:'esp32-room-monitor',version:1,boardId:'esp32-devkit',
 componentIds:Object.freeze(['bme280','ssd1306']),generator:'golden-v1',fqbn:'esp32:esp32:esp32',
 libraries:Object.freeze(['Adafruit BME280 Library','Adafruit SSD1306','Adafruit GFX Library','Adafruit Unified Sensor','Adafruit BusIO']),
 checks:Object.freeze<CheckName[]>(['board_detected','compiled','flashed','device_addresses','sensor_readings','oled_initialized']),
 valueRanges:Object.freeze({temperature:Object.freeze([-40,85] as const),humidity:Object.freeze([0,100] as const)}),
 serialMarkers:Object.freeze(['iot_observation'])
});
export const buttonLedRecipe:Recipe=Object.freeze({
 id:'esp32-button-led',version:1,boardId:'esp32-devkit',
 componentIds:Object.freeze(['button-pullup-10k','led-series-330']),generator:'button-led-v1',fqbn:'esp32:esp32:esp32',
 libraries:Object.freeze([]),
 checks:Object.freeze<CheckName[]>(['board_detected','compiled','flashed','button_input','output_commanded','behavior_sequence']),
 valueRanges:Object.freeze({}),
 serialMarkers:Object.freeze(['iot_observation'])
});
export const recipes:readonly Recipe[]=Object.freeze([goldenRecipe,buttonLedRecipe]);
/** Recipe-specific required checks; a provider or user cannot remove them. */
export const requiredChecks=(recipe:Recipe):readonly CheckName[]=>recipe.checks;
/** Checks the firmware emits as serial telemetry; board/compile/flash are synthesized by runtimes. */
export const telemetryChecks=(recipe:Recipe):readonly CheckName[]=>recipe.checks.filter(check=>!['board_detected','compiled','flashed'].includes(check));
/** Absence resolves legacy golden metadata without injecting fields into historical contracts. */
export function resolveRecipe(contract:Pick<HardwareContract,'recipe'>):Recipe|undefined {
 const ref=contract.recipe;
 return ref===undefined?goldenRecipe:recipes.find(recipe=>recipe.id===ref.id&&recipe.version===ref.version);
}
function sameMembers(actual:readonly string[],expected:readonly string[]){return actual.length===expected.length&&new Set(actual).size===actual.length&&expected.every(value=>actual.includes(value));}
/** Run before generation or evidence verification; caller-authored metadata cannot weaken gates. */
export function recipeContractErrors(contract:HardwareContract):string[]{
 const recipe=resolveRecipe(contract);if(!recipe)return ['Unknown or unsupported recipe reference.'];
 const errors:string[]=[];
 if(contract.board.id!==recipe.boardId||!sameMembers(contract.components.map(component=>component.manifest.id),recipe.componentIds))errors.push('Recipe requires its exact board and component set.');
 if(contract.firmware.generator!==recipe.generator||contract.firmware.fqbn!==recipe.fqbn||contract.firmware.framework!=='arduino')errors.push('Firmware generator or target differs from trusted recipe.');
 if(!sameMembers(contract.firmware.libraries,recipe.libraries))errors.push('Firmware libraries differ from trusted recipe.');
 if(!sameMembers(contract.verification.checks,recipe.checks))errors.push('Verification checks differ from trusted recipe.');
 if(!sameMembers(contract.expected.serialMarkers,recipe.serialMarkers)||!sameMembers(Object.keys(contract.expected.valueRanges),Object.keys(recipe.valueRanges))||Object.entries(recipe.valueRanges).some(([key,range])=>contract.expected.valueRanges[key]?.[0]!==range[0]||contract.expected.valueRanges[key]?.[1]!==range[1]))errors.push('Observation expectations differ from trusted recipe.');
 const devices=contract.expected.devices;
 const addressing=contract.components.filter(component=>component.manifest.addresses.length>0);
 const silent=contract.components.filter(component=>component.manifest.addresses.length===0);
 if(new Set(devices.map(device=>device.componentId)).size!==devices.length||addressing.some(component=>!devices.some(device=>device.componentId===component.instanceId&&device.address===component.address))||silent.some(component=>devices.some(device=>device.componentId===component.instanceId)))errors.push('Expected devices differ from recipe components.');
 const i2cComponents=contract.components.filter(component=>component.manifest.protocol==='i2c');
 if(i2cComponents.length){const buses=i2cComponents.map(component=>({id:component.instanceId,sda:contract.connections.find(wire=>wire.componentId===component.instanceId&&wire.role==='sda')?.boardPin,scl:contract.connections.find(wire=>wire.componentId===component.instanceId&&wire.role==='scl')?.boardPin}));
  if(buses.some(bus=>!bus.sda||!bus.scl||bus.sda!==buses[0]?.sda||bus.scl!==buses[0]?.scl))errors.push('Recipe requires one shared I2C bus.');}
 const valueComponents=contract.components.filter(component=>component.manifest.protocol==='digital'&&component.manifest.pins.some(pin=>['input','output'].includes(pin.role)));
 for(const component of valueComponents){const wire=contract.connections.find(w=>w.componentId===component.instanceId&&['input','output'].includes(w.role));
  const pin=component.manifest.pins.find(p=>p.name===wire?.pin);const boardPin=wire?.boardPin?Number(wire.boardPin):NaN;
  if(!pin||!Number.isInteger(boardPin)||boardPin<0||boardPin>39)errors.push(`Recipe requires a valid GPIO for ${component.instanceId} ${pin?.name??wire?.pin??''}.`);}
 return errors;
}
