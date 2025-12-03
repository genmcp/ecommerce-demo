import type { AgentProvider, AgentProviderConfig, AgentMessage, StreamEvent } from './types';

export class LlamaStackProvider implements AgentProvider {
  private config: AgentProviderConfig;
  private llamaStackUrl: string;
  private modelId: string;
  private toolGroupId: string;
  private agentId: string | null = null;
  private sessionId: string | null = null;

  constructor(config: AgentProviderConfig) {
    this.config = config;
    this.llamaStackUrl = process.env.LLAMA_STACK_URL || 'http://localhost:8321';
    this.modelId = process.env.INFERENCE_MODEL || process.env.MODEL_ID || 'openai/gpt-4o';
    this.toolGroupId = process.env.TOOL_GROUP_ID || 'ecommerce-api';
  }

  async initialize(): Promise<void> {
    console.log('========================================');
    console.log('LlamaStackProvider initialized');
    console.log('URL:', this.llamaStackUrl);
    console.log('Model:', this.modelId);
    console.log('Tool Group:', this.toolGroupId);
    console.log('NOTE: Tools are called through Llama Stack, NOT directly to MCP');
    console.log('========================================');
  }

  async *sendMessage(message: string, history: AgentMessage[]): AsyncGenerator<StreamEvent> {
    try {
      if (!this.agentId) {
        this.agentId = await this.createAgent();
      }

      if (!this.sessionId) {
        this.sessionId = await this.createSession(this.agentId);
      }

      console.log('🔵 [Llama Stack] Sending request to:', `${this.llamaStackUrl}/v1/agents/${this.agentId}/session/${this.sessionId}/turn`);
      console.log('🔵 [Llama Stack] Llama Stack will handle tool calls internally via tool group:', this.toolGroupId);

      const llamaResponse = await fetch(
        `${this.llamaStackUrl}/v1/agents/${this.agentId}/session/${this.sessionId}/turn`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: [{ role: 'user', content: message }],
            stream: true,
          }),
        }
      );

      if (!llamaResponse.ok) {
        const errorText = await llamaResponse.text();
        this.agentId = null;
        this.sessionId = null;
        throw new Error(`Failed to create turn: ${llamaResponse.status} ${errorText}`);
      }

      if (!llamaResponse.body) {
        throw new Error('No response body from Llama Stack');
      }

      const reader = llamaResponse.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const jsonStr = line.slice(6).trim();
              if (!jsonStr || jsonStr === '[DONE]') continue;

              try {
                const data = JSON.parse(jsonStr);
                const eventType = data.event?.payload?.event_type;

                if (eventType === 'step_progress') {
                  const delta = data.event.payload.delta;

                  if (delta?.type === 'text' && delta.text) {
                    yield {
                      type: 'text',
                      content: delta.text
                    };
                  } else if (delta?.type === 'tool_call') {
                    const toolName = delta.tool_call?.tool_name;
                    if (toolName) {
                      console.log('🔵 [Llama Stack] Tool call detected:', toolName);
                      console.log('🔵 [Llama Stack] This was routed through Llama Stack tool runtime');
                      yield {
                        type: 'tool_call',
                        toolCall: {
                          id: `${toolName}_${Date.now()}`,
                          name: toolName,
                          arguments: JSON.stringify(delta.tool_call?.arguments || {})
                        }
                      };
                    }
                  }
                } else if (eventType === 'step_complete') {
                  const stepDetail = data.event.payload.step_details;
                  if (stepDetail?.step_type === 'tool_execution') {
                    const toolResponses = stepDetail.tool_responses || [];
                    for (const tr of toolResponses) {
                      console.log('🔵 [Llama Stack] Tool execution completed:', tr.tool_name);
                      console.log('🔵 [Llama Stack] Result received from Llama Stack');
                      yield {
                        type: 'tool_result',
                        toolResult: {
                          id: `${tr.tool_name}_${Date.now()}`,
                          result: JSON.stringify(tr.content)
                        }
                      };
                    }
                  }
                } else if (eventType === 'turn_complete') {
                  yield { type: 'complete' };
                }
              } catch {
                // Ignore parse errors
              }
            }
          }
        }
      } finally {
        reader.releaseLock();
      }
    } catch (error) {
      console.error('LlamaStack stream error:', error);
      this.agentId = null;
      this.sessionId = null;
      yield {
        type: 'error',
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  async reset(): Promise<void> {
    this.agentId = null;
    this.sessionId = null;
    console.log('LlamaStack agent/session reset');
  }

  private async createAgent(): Promise<string> {
    const response = await fetch(`${this.llamaStackUrl}/v1/agents`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        agent_config: {
          model: this.modelId,
          instructions: this.config.systemPrompt,
          toolgroups: [this.toolGroupId],
          enable_session_persistence: false,
        }
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to create agent: ${response.status} ${errorText}`);
    }

    const data = await response.json();
    console.log('Created Llama Stack agent:', data.agent_id);
    return data.agent_id;
  }

  private async createSession(agentIdParam: string): Promise<string> {
    const response = await fetch(`${this.llamaStackUrl}/v1/agents/${agentIdParam}/session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        session_name: `session-${Date.now()}`,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to create session: ${response.status} ${errorText}`);
    }

    const data = await response.json();
    console.log('Created Llama Stack session:', data.session_id);
    return data.session_id;
  }
}
