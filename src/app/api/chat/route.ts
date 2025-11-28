import { NextResponse } from 'next/server';

export async function POST(req: Request) {
    try {
        const { message, history } = await req.json();

        // Default to llama3.1, but this could be configurable
        const model = 'llama3.1';

        // Construct the prompt with history
        const messages = [
            { role: 'system', content: 'You are a helpful AI shopping assistant for an online store. You are currently in a demo environment.' },
            ...history,
            { role: 'user', content: message }
        ];

        try {
            const response = await fetch('http://localhost:11434/api/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    model: model,
                    messages: messages,
                    stream: false, // For simplicity in this demo, we'll use non-streaming first
                }),
            });

            if (!response.ok) {
                throw new Error(`Ollama API error: ${response.statusText}`);
            }

            const data = await response.json();
            return NextResponse.json({ response: data.message.content });
        } catch (fetchError) {
            console.error('Failed to connect to Ollama:', fetchError);
            return NextResponse.json(
                { error: 'Could not connect to local Ollama instance. Is it running on port 11434?' },
                { status: 503 }
            );
        }
    } catch (error) {
        console.error('Error in chat route:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
