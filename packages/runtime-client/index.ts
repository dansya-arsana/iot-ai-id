import {z} from 'zod';
import {execute} from '../../services/orchestrator/process.js';
import {resolve} from 'node:path';
export const RuntimeSafetySchema=z.object({board:z.string().max(100).optional(),fqbn:z.literal('esp32:esp32:esp32').optional(),wiring:z.array(z.object({pin:z.string().max(30),direction:z.enum(['input','output','bidirectional']).optional(),signalType:z.enum(['digital','analog','i2c','spi','uart','power','ground','other']).optional(),voltage:z.number().finite().optional(),currentMa:z.number().finite().nonnegative().optional()})).max(100).optional(),power:z.object({supplyVoltage:z.number().finite().optional(),totalCurrentMa:z.number().finite().nonnegative().optional(),supplyThrough:z.enum(['usb','vin','5v_pin','3v3_pin','gpio_pin','unknown']).optional()}).optional()});
export const RuntimeRequestSchema=z.discriminatedUnion('action',[
 z.object({action:z.literal('detect')}),
 z.object({action:z.literal('run'),authorized:z.literal(true),port:z.string().min(1).max(200),experimentId:z.string().regex(/^[\w-]{1,128}$/),nonce:z.string().regex(/^[\w-]{1,128}$/),contractHash:z.string().regex(/^[a-f0-9]{64}$/),firmwareHash:z.string().regex(/^[a-f0-9]{64}$/),source:z.string().max(100000),fqbn:z.literal('esp32:esp32:esp32'),safetyContext:RuntimeSafetySchema.optional()})
]);
export type RuntimeRequest=z.infer<typeof RuntimeRequestSchema>;
export class LocalRuntimeClient {
 async invoke(input:RuntimeRequest):Promise<any>{const request=RuntimeRequestSchema.parse(input);return JSON.parse(await execute(process.execPath,['--import','tsx',resolve('runtime/local-bridge/mcp-executor.ts')],JSON.stringify(request),request.action==='run'?800000:90000));}
 async detect(){try{return await this.invoke({action:'detect'});}catch(error){return{devices:[],toolchain:false,available:false,backend:'arduino-mcp-server',error:error instanceof Error?error.message:'Runtime unavailable'};}}
}
