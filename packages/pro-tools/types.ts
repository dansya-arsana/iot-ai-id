/** Tool definition shape (ADR 012 §2). Schemas only in M2.0; implementations live in impl/ (pure) and services/ops (service). */
import type {z} from 'zod';

export type ToolEffect='none'|'compute'|'write'|'ui'|'physical';
export type ToolConsent='none'|'port-trust'|'native';
/** pure: in-process in ops and MCP. ops: service tool via ops. ops-browser: ops plus a UI pane. client: desktop app only. */
export type ToolRunsAt='pure'|'ops'|'ops-browser'|'client';
/** member: signed-in member with the pro grant. member-local: member, only from the desktop local host. */
export type ToolAccess='member'|'member-local';
/** false: never exposed. true: exposed. 'local': exposed only on the local stdio bridge. */
export type ToolMcp=boolean|'local';

export interface ToolDef<I extends z.ZodType=z.ZodType,O extends z.ZodType=z.ZodType>{
 name:string;description:string;input:I;output:O;
 deterministic:boolean;effect:ToolEffect;consent:ToolConsent;runsAt:ToolRunsAt;access:ToolAccess;mcp:ToolMcp;
}
export const defineTool=<I extends z.ZodType,O extends z.ZodType>(def:ToolDef<I,O>):ToolDef<I,O>=>Object.freeze(def);

/** Anthropic `tools` entry. */
export interface AnthropicTool{name:string;description:string;input_schema:Record<string,unknown>}
