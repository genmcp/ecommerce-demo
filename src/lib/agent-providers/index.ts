import type { AgentProvider, AgentProviderConfig } from './types';
import { OpenAIProvider } from './openai-provider';
import { LlamaStackProvider } from './llamastack-provider';

export type { AgentProvider, AgentProviderConfig, AgentMessage, StreamEvent, ToolCall, ToolResult } from './types';

export function createAgentProvider(config: AgentProviderConfig): AgentProvider {
  const providerType = process.env.AGENT_PROVIDER || 'openai';

  console.log(`Creating agent provider: ${providerType}`);

  switch (providerType.toLowerCase()) {
    case 'openai':
      return new OpenAIProvider(config);
    case 'llamastack':
    case 'llama-stack':
    case 'llama_stack':
      return new LlamaStackProvider(config);
    default:
      throw new Error(`Unknown agent provider: ${providerType}. Use 'openai' or 'llamastack'`);
  }
}
