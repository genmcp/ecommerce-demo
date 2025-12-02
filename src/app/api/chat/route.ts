import { NextResponse } from 'next/server';
import { createAgentProvider } from '@/lib/agent-providers';
import type { AgentMessage } from '@/lib/agent-providers';

const SYSTEM_PROMPT = `You are a helpful AI shopping assistant for an online store. You help customers find products, add items to their cart, and answer questions about the store.

You have access to tools to:
- Get the list of products (get_api-products)
- Get the current cart contents (get_api-cart)
- Add items to cart (post_api-cart-items) - requires productId (string), productName (string), and productPrice (NUMBER, not string!)
- Clear the cart (delete_api-cart)
- Update product pricing (post_api-admin-pricing) - requires productId (string) and newPrice (NUMBER, not string!)

IMPORTANT: When calling tools, pass price values as JSON numbers (e.g., 99.99), NOT as strings (e.g., "99.99").

When a user asks about products, USE the get_api-products tool to fetch and show them.
When a user wants to add something to cart, USE the post_api-cart-items tool with the exact product details.
When a user asks about their cart, USE the get_api-cart tool.
When a user wants to update a price, USE the post_api-admin-pricing tool.

ALWAYS use the tools when the user asks about products, cart, or wants to make changes. Do not make up product information.`;

// Store conversation history in memory (in production, use a proper store)
let conversationHistory: AgentMessage[] = [];
let provider: ReturnType<typeof createAgentProvider> | null = null;

async function getProvider() {
  if (!provider) {
    // Only enable tools if MCP_SERVER_URL is set
    const mcpServerUrl = process.env.MCP_SERVER_URL
      ? `${process.env.MCP_SERVER_URL}/mcp`
      : undefined;

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

export async function POST(req: Request) {
  try {
    const { message, reset } = await req.json();

    if (reset) {
      conversationHistory = [];
      if (provider) {
        await provider.reset();
        provider = null;
      }
      console.log('Conversation reset');
    }

    const agentProvider = await getProvider();

    console.log('=== Agent Chat Request ===');
    console.log('Provider:', process.env.AGENT_PROVIDER || 'openai');
    console.log('Message:', message);
    console.log('History length:', conversationHistory.length);

    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        try {
          let fullResponse = '';
          const toolCallMap = new Map<string, string>(); // Map tool call ID to tool name

          for await (const event of agentProvider.sendMessage(message, conversationHistory)) {
            if (event.type === 'text' && event.content) {
              fullResponse += event.content;
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'text', content: event.content })}\n\n`));
            } else if (event.type === 'tool_call' && event.toolCall) {
              // Store the mapping of ID to tool name
              toolCallMap.set(event.toolCall.id, event.toolCall.name);

              controller.enqueue(encoder.encode(`data: ${JSON.stringify({
                type: 'tool_call',
                tool: event.toolCall.name,
                input: JSON.parse(event.toolCall.arguments)
              })}\n\n`));
            } else if (event.type === 'tool_result' && event.toolResult) {
              // Get the tool name from the stored mapping
              const toolName = toolCallMap.get(event.toolResult.id);

              controller.enqueue(encoder.encode(`data: ${JSON.stringify({
                type: 'tool_result',
                tool: toolName, // Include tool name so frontend can match it
                output: JSON.parse(event.toolResult.result)
              })}\n\n`));
            } else if (event.type === 'complete') {
              conversationHistory.push({ role: 'user', content: message });
              conversationHistory.push({ role: 'assistant', content: fullResponse });

              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'complete', content: fullResponse })}\n\n`));
            } else if (event.type === 'error') {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'error', message: event.error })}\n\n`));
            }
          }

          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        } catch (error) {
          console.error('Stream processing error:', error);
          const errorMsg = error instanceof Error ? error.message : 'Unknown error';
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'error', message: errorMsg })}\n\n`));
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        } finally {
          controller.close();
        }
      }
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error) {
    console.error('Error in chat route:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: `Chat error: ${errorMessage}` },
      { status: 500 }
    );
  }
}
