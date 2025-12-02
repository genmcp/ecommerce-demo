export interface AgentMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: string;
}

export interface ToolResult {
  id: string;
  result: string;
}

export interface StreamEvent {
  type: 'text' | 'tool_call' | 'tool_result' | 'complete' | 'error';
  content?: string;
  toolCall?: ToolCall;
  toolResult?: ToolResult;
  error?: string;
}

export interface AgentProvider {
  initialize(): Promise<void>;
  sendMessage(message: string, history: AgentMessage[]): AsyncGenerator<StreamEvent>;
  reset(): Promise<void>;
}

export interface AgentProviderConfig {
  systemPrompt: string;
  mcpServerUrl?: string;
}
