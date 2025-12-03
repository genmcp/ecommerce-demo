import { createAgentProvider } from './index';
import type { AgentProvider, AgentMessage } from './types';

const SYSTEM_PROMPT = `You are a helpful AI shopping assistant for an online store. You help customers find products, add items to their cart, and answer questions about the store.

You have access to various tools to help customers. Use the available tools when users ask about products, their cart, or want to make changes. Do not make up product information.`;

// Shared provider instance
let provider: AgentProvider | null = null;
let conversationHistory: AgentMessage[] = [];

function getMcpServerUrl(): string | undefined {
  return process.env.MCP_SERVER_URL
    ? `${process.env.MCP_SERVER_URL}/mcp`
    : undefined;
}

export async function getProvider(): Promise<AgentProvider> {
  if (!provider) {
    const mcpServerUrl = getMcpServerUrl();

    if (mcpServerUrl) {
      console.log('MCP server configured:', mcpServerUrl);
    } else {
      console.log('No MCP server configured - tools disabled');
    }

    provider = createAgentProvider({
      systemPrompt: SYSTEM_PROMPT,
      mcpServerUrl
    });

    await provider.initialize();
  }
  return provider;
}

export async function resetProvider(): Promise<void> {
  if (provider) {
    await provider.reset();
    provider = null;
  }
  conversationHistory = [];
  console.log('Provider and conversation reset');
}

export function getConversationHistory(): AgentMessage[] {
  return conversationHistory;
}

export function addToConversationHistory(message: AgentMessage): void {
  conversationHistory.push(message);
}

export function clearConversationHistory(): void {
  conversationHistory = [];
}
