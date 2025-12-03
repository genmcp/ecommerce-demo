import { NextResponse } from 'next/server';
import {
  getProvider,
  resetProvider,
  getConversationHistory,
  addToConversationHistory,
  clearConversationHistory
} from '@/lib/agent-providers/provider-instance';

export async function POST(req: Request) {
  try {
    const { message, reset } = await req.json();

    if (reset) {
      await resetProvider();
      console.log('Conversation reset');
    }

    const agentProvider = await getProvider();
    const conversationHistory = getConversationHistory();

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
              addToConversationHistory({ role: 'user', content: message });
              addToConversationHistory({ role: 'assistant', content: fullResponse });

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
