import { NextResponse } from 'next/server';

// Llama Stack configuration from environment
const LLAMA_STACK_URL = process.env.LLAMA_STACK_URL || 'http://localhost:8321';
const MODEL_ID = process.env.INFERENCE_MODEL || process.env.MODEL_ID || 'openai/gpt-4o';
const TOOL_GROUP_ID = process.env.TOOL_GROUP_ID || 'ecommerce-api';

// Store agent/session info in memory (in production, use a proper store)
let agentId: string | null = null;
let sessionId: string | null = null;

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

async function createAgent(): Promise<string> {
    const response = await fetch(`${LLAMA_STACK_URL}/v1/agents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            agent_config: {
                model: MODEL_ID,
                instructions: SYSTEM_PROMPT,
                toolgroups: [TOOL_GROUP_ID],
                enable_session_persistence: false,
            }
        }),
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to create agent: ${response.status} ${errorText}`);
    }

    const data = await response.json();
    console.log('Created agent:', data);
    return data.agent_id;
}

async function createSession(agentIdParam: string): Promise<string> {
    const response = await fetch(`${LLAMA_STACK_URL}/v1/agents/${agentIdParam}/session`, {
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
    console.log('Created session:', data);
    return data.session_id;
}

export async function POST(req: Request) {
    try {
        const { message, reset } = await req.json();

        // Allow resetting agent/session
        if (reset) {
            agentId = null;
            sessionId = null;
            console.log('Agent/session reset');
        }

        console.log('=== Llama Stack Agent Request ===');
        console.log('URL:', LLAMA_STACK_URL);
        console.log('Model ID:', MODEL_ID);
        console.log('Tool Group:', TOOL_GROUP_ID);
        console.log('Message:', message);
        console.log('Current agentId:', agentId);
        console.log('Current sessionId:', sessionId);

        // Create agent if not exists
        if (!agentId) {
            console.log('Creating new agent...');
            try {
                agentId = await createAgent();
                console.log('Agent created:', agentId);
            } catch (e) {
                console.error('Failed to create agent:', e);
                throw e;
            }
        }

        // Create session if not exists
        if (!sessionId) {
            console.log('Creating new session...');
            try {
                sessionId = await createSession(agentId);
                console.log('Session created:', sessionId);
            } catch (e) {
                console.error('Failed to create session:', e);
                agentId = null; // Reset agent on session failure
                throw e;
            }
        }

        // Create a streaming turn with the user's message
        console.log('Creating streaming turn...');
        console.log(`Turn URL: ${LLAMA_STACK_URL}/v1/agents/${agentId}/session/${sessionId}/turn`);
        
        const llamaResponse = await fetch(`${LLAMA_STACK_URL}/v1/agents/${agentId}/session/${sessionId}/turn`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                messages: [{ role: 'user', content: message }],
                stream: true,
            }),
        });

        console.log('Llama Stack response status:', llamaResponse.status);

        if (!llamaResponse.ok) {
            const errorText = await llamaResponse.text();
            console.error('Turn error:', errorText);
            // Reset agent/session on error
            agentId = null;
            sessionId = null;
            throw new Error(`Failed to create turn: ${llamaResponse.status} ${errorText}`);
        }

        if (!llamaResponse.body) {
            throw new Error('No response body from Llama Stack');
        }
        
        console.log('Starting to process stream...');

        // Process streaming response and forward to client
        const encoder = new TextEncoder();
        
        const stream = new ReadableStream({
            async start(controller) {
                const reader = llamaResponse.body!.getReader();
                const decoder = new TextDecoder();
                let buffer = '';

                try {
                    while (true) {
                        const { done, value } = await reader.read();
                        if (done) break;

                        buffer += decoder.decode(value, { stream: true });
                        const lines = buffer.split('\n');
                        
                        // Keep the last incomplete line in buffer
                        buffer = lines.pop() || '';

                        for (const line of lines) {
                            if (line.startsWith('data: ')) {
                                const jsonStr = line.slice(6).trim();
                                if (!jsonStr || jsonStr === '[DONE]') continue;

                                try {
                                    const data = JSON.parse(jsonStr);
                                    const eventType = data.event?.payload?.event_type;
                                    console.log('Event type:', eventType);

                                    // Handle step_progress events - stream text to client
                                    if (eventType === 'step_progress') {
                                        const delta = data.event.payload.delta;
                                        if (delta?.type === 'text' && delta.text) {
                                            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'text', content: delta.text })}\n\n`));
                                        } else if (delta?.type === 'tool_call') {
                                            const toolName = delta.tool_call?.tool_name;
                                            if (toolName) {
                                                const toolArgs = delta.tool_call?.arguments || {};
                                                controller.enqueue(encoder.encode(`data: ${JSON.stringify({
                                                    type: 'tool_call',
                                                    tool: toolName,
                                                    input: toolArgs
                                                })}\n\n`));
                                            }
                                        }
                                    }
                                    // Handle step_start for tool execution visibility
                                    else if (eventType === 'step_start' && data.event?.payload?.step_type === 'tool_execution') {
                                        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'tool_start' })}\n\n`));
                                    }
                                    // Handle step complete for tool execution
                                    else if (eventType === 'step_complete') {
                                        const stepDetail = data.event.payload.step_details;
                                        if (stepDetail?.step_type === 'tool_execution') {
                                            const toolResponses = stepDetail.tool_responses || [];
                                            for (const tr of toolResponses) {
                                                controller.enqueue(encoder.encode(`data: ${JSON.stringify({
                                                    type: 'tool_result',
                                                    tool: tr.tool_name,
                                                    output: tr.content
                                                })}\n\n`));
                                            }
                                        }
                                    }
                                    // Handle turn complete
                                    else if (eventType === 'turn_complete') {
                                        const turnData = data.event.payload.turn;
                                        if (turnData?.output_message?.content) {
                                            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'complete', content: turnData.output_message.content })}\n\n`));
                                        }
                                    }
                                } catch {
                                    // Ignore parse errors for incomplete JSON
                                }
                            }
                        }
                    }
                    
                    // Process any remaining buffer
                    if (buffer.startsWith('data: ')) {
                        const jsonStr = buffer.slice(6).trim();
                        if (jsonStr && jsonStr !== '[DONE]') {
                            try {
                                const data = JSON.parse(jsonStr);
                                if (data.event?.payload?.event_type === 'turn_complete') {
                                    const content = data.event.payload.turn?.output_message?.content;
                                    if (content) {
                                        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'complete', content })}\n\n`));
                                    }
                                }
                            } catch {
                                // Ignore
                            }
                        }
                    }
                } catch (error) {
                    console.error('Stream processing error:', error);
                    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'error', message: errorMsg })}\n\n`));
                } finally {
                    reader.releaseLock();
                    controller.enqueue(encoder.encode('data: [DONE]\n\n'));
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
        // Reset agent/session on error
        agentId = null;
        sessionId = null;
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return NextResponse.json(
            { error: `Chat error: ${errorMessage}` },
            { status: 500 }
        );
    }
}
