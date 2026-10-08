import {z} from 'zod';
export const ChatInputSchema=z.object({purpose:z.enum(['design','debug']).default('design'),message:z.string().trim().min(1).max(2000),expectedContractId:z.string().uuid().nullable(),expectedDraftId:z.string().uuid().nullable()}).strict();
export const ComponentChangeSchema=z.object({componentId:z.string().min(1).max(100),operation:z.enum(['add','remove']),expectedContractId:z.string().uuid().nullable(),expectedDraftId:z.string().uuid().nullable()}).strict();
export const DesignIntentSchema=z.object({componentIds:z.array(z.string().max(100)).max(20),desiredBehavior:z.string().max(2000),sizeConstraint:z.string().max(500),unresolved:z.array(z.string().max(500)).max(20)}).strict();
export type ChatInput=z.infer<typeof ChatInputSchema>;
export type ComponentChange=z.infer<typeof ComponentChangeSchema>;

export const WiringChangeSchema=z.object({expectedContractId:z.string().uuid(),expectedDraftId:z.string().uuid().nullable(),connections:z.array(z.object({componentId:z.string().min(1).max(100),pin:z.string().min(1).max(100),boardPin:z.string().min(1).max(100)}).strict()).max(100)}).strict();
export type WiringChange=z.infer<typeof WiringChangeSchema>;
