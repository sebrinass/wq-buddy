/**
 * Type declarations for OpenClaw Plugin SDK modules.
 * These modules are provided by the OpenClaw runtime at load time.
 * This file enables TypeScript compilation without requiring the full OpenClaw source.
 */

declare module "openclaw/plugin-sdk/plugin-entry" {
  export interface AgentToolResult<T = unknown> {
    content: Array<{ type: "text"; text: string }>;
    details?: T;
  }

  export interface AnyAgentTool {
    name: string;
    label?: string;
    description: string;
    parameters: unknown;
    execute(
      this: void,
      toolCallId: string,
      params: Record<string, unknown>,
      signal?: AbortSignal,
    ): Promise<AgentToolResult>;
    ownerOnly?: boolean;
    displaySummary?: string;
  }

  export interface OpenClawPluginApi {
    registerTool(tool: AnyAgentTool): void;
  }

  export interface DefinedPluginEntry {
    id: string;
    name: string;
    description: string;
    register: (api: OpenClawPluginApi) => void;
  }

  export function definePluginEntry(options: {
    id: string;
    name: string;
    description: string;
    register: (api: OpenClawPluginApi) => void;
  }): DefinedPluginEntry;
}
