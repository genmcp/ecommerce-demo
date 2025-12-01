/**
 * MCP SSE Proxy
 * 
 * This proxy bridges the gap between:
 * - Llama Stack MCP Client (expects SSE via GET)
 * - genmcp Server (uses Streamable HTTP via POST)
 * 
 * It accepts SSE connections and forwards requests to genmcp.
 */

const GENMCP_URL = process.env.GENMCP_URL || 'http://localhost:8080/mcp';

// Store active sessions
const sessions = new Map<string, { initialized: boolean }>();

export async function GET(req: Request) {
    const url = new URL(req.url);
    const sessionId = req.headers.get('mcp-session-id') || url.searchParams.get('session_id');

    console.log('[MCP Proxy] GET request, session:', sessionId);

    // Return SSE stream for session
    const encoder = new TextEncoder();

    const stream = new ReadableStream({
        start(controller) {
            // Send initial connection event
            controller.enqueue(encoder.encode(': connected\n\n'));

            // Keep connection alive with periodic pings
            const pingInterval = setInterval(() => {
                try {
                    controller.enqueue(encoder.encode(': ping\n\n'));
                } catch {
                    clearInterval(pingInterval);
                }
            }, 15000);

            // Clean up on close
            req.signal.addEventListener('abort', () => {
                clearInterval(pingInterval);
                if (sessionId) sessions.delete(sessionId);
                controller.close();
            });
        }
    });

    return new Response(stream, {
        headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
        },
    });
}

export async function POST(req: Request) {
    try {
        const body = await req.json();
        console.log('[MCP Proxy] POST request:', JSON.stringify(body).slice(0, 200));

        // Forward to genmcp
        const response = await fetch(GENMCP_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(body),
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('[MCP Proxy] genmcp error:', errorText);
            return new Response(
                JSON.stringify({ error: errorText }),
                { status: response.status, headers: { 'Content-Type': 'application/json' } }
            );
        }

        // Get session ID from genmcp response
        const mcpSessionId = response.headers.get('mcp-session-id');

        // Read the SSE response from genmcp and forward it
        const responseText = await response.text();
        console.log('[MCP Proxy] genmcp response:', responseText.slice(0, 500));

        // Parse the SSE data
        const lines = responseText.split('\n');
        let jsonData = null;

        for (const line of lines) {
            if (line.startsWith('data: ')) {
                const dataStr = line.slice(6).trim();
                if (dataStr) {
                    try {
                        jsonData = JSON.parse(dataStr);
                    } catch {
                        // Ignore parse errors
                    }
                }
            }
        }

        // Return as SSE format for compatibility
        const encoder = new TextEncoder();
        const sseResponse = jsonData
            ? `event: message\ndata: ${JSON.stringify(jsonData)}\n\n`
            : responseText;

        const headers: HeadersInit = {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
        };

        if (mcpSessionId) {
            headers['Mcp-Session-Id'] = mcpSessionId;
        }

        return new Response(encoder.encode(sseResponse), { headers });
    } catch (error) {
        console.error('[MCP Proxy] Error:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return new Response(
            JSON.stringify({ error: errorMessage }),
            { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
    }
}

