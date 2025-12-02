import OpenAI from 'openai';
import type { AgentProvider, AgentProviderConfig, AgentMessage, StreamEvent, ToolCall } from './types';

interface MCPTool {
  name: string;
  description?: string;
  inputSchema: {
    type: string;
    properties?: Record<string, unknown>;
    required?: string[];
  };
}

export class OpenAIProvider implements AgentProvider {
  private client: OpenAI;
  private config: AgentProviderConfig;
  private tools: OpenAI.Chat.Completions.ChatCompletionTool[] = [];
  private mcpTools: Map<string, MCPTool> = new Map();

  constructor(config: AgentProviderConfig) {
    this.config = config;
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      throw new Error('OPENAI_API_KEY environment variable is required');
    }

    this.client = new OpenAI({ apiKey });
  }

  async initialize(): Promise<void> {
    if (!this.config.mcpServerUrl) {
      console.log('No MCP server URL provided, running without tools');
      return;
    }

    try {
      console.log('Fetching tools from MCP server:', this.config.mcpServerUrl);
      const data = await this.callMCPMethod('tools/list', {});

      const mcpTools: MCPTool[] = data.result?.tools || [];

      this.tools = mcpTools.map(tool => {
        // Ensure the schema is valid for OpenAI
        const inputSchema = tool.inputSchema || { type: 'object' };

        // OpenAI requires 'properties' to be present for object schemas
        if (inputSchema.type === 'object' && !inputSchema.properties) {
          inputSchema.properties = {};
        }

        return {
          type: 'function' as const,
          function: {
            name: tool.name,
            description: tool.description || `Execute ${tool.name}`,
            parameters: inputSchema
          }
        };
      });

      mcpTools.forEach(tool => {
        this.mcpTools.set(tool.name, tool);
      });

      console.log(`✓ Loaded ${this.tools.length} tools from MCP server:`);
      this.tools.forEach(tool => {
        console.log(`  - ${tool.function.name}: ${tool.function.description}`);
      });
    } catch (error) {
      console.error('Failed to load MCP tools:', error);
      throw error;
    }
  }

  private async callMCPMethod(method: string, params: unknown): Promise<any> {
    if (!this.config.mcpServerUrl) {
      throw new Error('No MCP server URL configured');
    }

    const requestBody = {
      jsonrpc: '2.0',
      id: Date.now(),
      method,
      params
    };

    console.log(`MCP ${method} request:`, JSON.stringify(requestBody, null, 2));

    const response = await fetch(this.config.mcpServerUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`MCP ${method} failed (${response.status}):`, errorText);
      throw new Error(`MCP server returned ${response.status}: ${errorText}`);
    }

    // Check if response is SSE format
    const contentType = response.headers.get('content-type');
    if (contentType?.includes('text/event-stream')) {
      // Parse SSE response - need to get ALL events
      const text = await response.text();
      const lines = text.split('\n');

      let lastResult: any = null;

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const jsonStr = line.slice(6).trim();
          if (jsonStr && jsonStr !== '[DONE]') {
            try {
              const data = JSON.parse(jsonStr);

              // Look for actual result (has 'id' and 'result' fields)
              if (data.id && data.result !== undefined) {
                console.log(`MCP ${method} result:`, JSON.stringify(data, null, 2));
                lastResult = data;
              } else {
                // This is a notification, log but don't return it
                console.log(`MCP ${method} notification:`, data.method || 'unknown');
              }
            } catch (e) {
              console.warn('Failed to parse SSE line:', jsonStr);
            }
          }
        }
      }

      if (lastResult) {
        return lastResult;
      }

      throw new Error('No result found in SSE response');
    } else {
      // Regular JSON response
      const data = await response.json();
      console.log(`MCP ${method} response:`, JSON.stringify(data, null, 2));
      return data;
    }
  }

  async *sendMessage(message: string, history: AgentMessage[]): AsyncGenerator<StreamEvent> {
    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      { role: 'system', content: this.config.systemPrompt },
      ...history.map(msg => ({
        role: msg.role,
        content: msg.content
      })),
      { role: 'user', content: message }
    ];

    console.log('Sending message to OpenAI with', this.tools.length, 'tools available');

    try {
      const stream = await this.client.chat.completions.create({
        model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
        messages,
        tools: this.tools.length > 0 ? this.tools : undefined,
        stream: true,
        stream_options: { include_usage: false }
      });

      console.log('OpenAI stream started');

      let currentToolCalls: Map<number, { id: string; name: string; arguments: string }> = new Map();
      let accumulatedText = '';

      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta;

        if (!delta) continue;

        if (delta.content) {
          accumulatedText += delta.content;
          yield {
            type: 'text',
            content: delta.content
          };
        }

        if (delta.tool_calls) {
          for (const toolCall of delta.tool_calls) {
            const index = toolCall.index;

            if (!currentToolCalls.has(index)) {
              currentToolCalls.set(index, {
                id: toolCall.id || `call_${Date.now()}_${index}`,
                name: toolCall.function?.name || '',
                arguments: toolCall.function?.arguments || ''
              });
            } else {
              const existing = currentToolCalls.get(index)!;
              if (toolCall.function?.arguments) {
                existing.arguments += toolCall.function.arguments;
              }
            }
          }
        }

        if (chunk.choices[0]?.finish_reason === 'tool_calls') {
          console.log('OpenAI requested tool calls:', Array.from(currentToolCalls.values()).map(tc => tc.name));

          // Execute all tool calls and store results
          const toolResults = new Map<string, unknown>();

          for (const toolCall of currentToolCalls.values()) {
            console.log(`Executing tool: ${toolCall.name} with args:`, toolCall.arguments);

            yield {
              type: 'tool_call',
              toolCall: {
                id: toolCall.id,
                name: toolCall.name,
                arguments: toolCall.arguments
              }
            };

            const result = await this.executeToolCall(toolCall.name, toolCall.arguments);
            toolResults.set(toolCall.id, result);

            console.log(`Tool ${toolCall.name} result:`, result);

            yield {
              type: 'tool_result',
              toolResult: {
                id: toolCall.id,
                result: JSON.stringify(result)
              }
            };
          }

          // Build messages with tool results
          const toolMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
            ...messages,
            {
              role: 'assistant',
              content: accumulatedText || null,
              tool_calls: Array.from(currentToolCalls.values()).map(tc => ({
                id: tc.id,
                type: 'function' as const,
                function: {
                  name: tc.name,
                  arguments: tc.arguments
                }
              }))
            },
            ...Array.from(currentToolCalls.values()).map(tc => ({
              role: 'tool' as const,
              tool_call_id: tc.id,
              content: JSON.stringify(toolResults.get(tc.id))
            }))
          ];

          const followUpStream = await this.client.chat.completions.create({
            model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
            messages: toolMessages,
            tools: this.tools.length > 0 ? this.tools : undefined,
            stream: true,
            stream_options: { include_usage: false }
          });

          let newToolCalls: Map<number, { id: string; name: string; arguments: string }> = new Map();
          let hasMoreToolCalls = false;

          for await (const followUpChunk of followUpStream) {
            const followUpDelta = followUpChunk.choices[0]?.delta;

            if (followUpDelta?.content) {
              accumulatedText += followUpDelta.content;
              yield {
                type: 'text',
                content: followUpDelta.content
              };
            }

            // Check if OpenAI wants to make more tool calls
            if (followUpDelta?.tool_calls) {
              hasMoreToolCalls = true;
              for (const toolCall of followUpDelta.tool_calls) {
                const index = toolCall.index;

                if (!newToolCalls.has(index)) {
                  newToolCalls.set(index, {
                    id: toolCall.id || `call_${Date.now()}_${index}`,
                    name: toolCall.function?.name || '',
                    arguments: toolCall.function?.arguments || ''
                  });
                } else {
                  const existing = newToolCalls.get(index)!;
                  if (toolCall.function?.arguments) {
                    existing.arguments += toolCall.function.arguments;
                  }
                }
              }
            }

            if (followUpChunk.choices[0]?.finish_reason === 'tool_calls') {
              console.log('OpenAI requested MORE tool calls:', Array.from(newToolCalls.values()).map(tc => tc.name));

              // Execute the new tool calls
              const newToolResults = new Map<string, unknown>();

              for (const toolCall of newToolCalls.values()) {
                console.log(`Executing tool: ${toolCall.name} with args:`, toolCall.arguments);

                yield {
                  type: 'tool_call',
                  toolCall: {
                    id: toolCall.id,
                    name: toolCall.name,
                    arguments: toolCall.arguments
                  }
                };

                const result = await this.executeToolCall(toolCall.name, toolCall.arguments);
                newToolResults.set(toolCall.id, result);

                console.log(`Tool ${toolCall.name} result:`, result);

                yield {
                  type: 'tool_result',
                  toolResult: {
                    id: toolCall.id,
                    result: JSON.stringify(result)
                  }
                };
              }

              // Recursively continue with new tool results
              const nextMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
                ...toolMessages,
                {
                  role: 'assistant',
                  content: accumulatedText || null,
                  tool_calls: Array.from(newToolCalls.values()).map(tc => ({
                    id: tc.id,
                    type: 'function' as const,
                    function: {
                      name: tc.name,
                      arguments: tc.arguments
                    }
                  }))
                },
                ...Array.from(newToolCalls.values()).map(tc => ({
                  role: 'tool' as const,
                  tool_call_id: tc.id,
                  content: JSON.stringify(newToolResults.get(tc.id))
                }))
              ];

              // Continue streaming with the new results
              const nextStream = await this.client.chat.completions.create({
                model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
                messages: nextMessages,
                tools: this.tools.length > 0 ? this.tools : undefined,
                stream: true,
                stream_options: { include_usage: false }
              });

              for await (const nextChunk of nextStream) {
                const nextDelta = nextChunk.choices[0]?.delta;

                if (nextDelta?.content) {
                  yield {
                    type: 'text',
                    content: nextDelta.content
                  };
                }

                if (nextChunk.choices[0]?.finish_reason === 'stop') {
                  yield { type: 'complete' };
                }
              }

              newToolCalls.clear();
              break;
            }

            if (followUpChunk.choices[0]?.finish_reason === 'stop') {
              yield { type: 'complete' };
            }
          }

          currentToolCalls.clear();
        }

        if (chunk.choices[0]?.finish_reason === 'stop') {
          yield { type: 'complete' };
        }
      }
    } catch (error) {
      console.error('OpenAI stream error:', error);
      yield {
        type: 'error',
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  private async executeToolCall(toolName: string, argsJson: string): Promise<unknown> {
    if (!this.config.mcpServerUrl) {
      console.error('No MCP server configured');
      return { error: 'No MCP server configured' };
    }

    try {
      const args = JSON.parse(argsJson);

      const data = await this.callMCPMethod('tools/call', {
        name: toolName,
        arguments: args
      });

      return data.result || data;
    } catch (error) {
      console.error(`Error executing tool ${toolName}:`, error);
      return { error: error instanceof Error ? error.message : 'Tool execution failed' };
    }
  }

  async reset(): Promise<void> {
    // OpenAI is stateless, no reset needed
  }
}
