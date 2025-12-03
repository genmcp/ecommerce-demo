import { NextResponse } from 'next/server';

export async function GET() {
  const provider = process.env.AGENT_PROVIDER || 'openai';
  const mcpServerUrl = process.env.MCP_SERVER_URL;
  const llamaStackUrl = process.env.LLAMA_STACK_URL;

  // For OpenAI: tools enabled if MCP_SERVER_URL is set
  // For Llama Stack: tools are configured in llama-stack-config, so check if LLAMA_STACK_URL is set
  const toolsEnabled = provider === 'llamastack'
    ? !!llamaStackUrl
    : !!mcpServerUrl;

  return NextResponse.json({
    provider,
    toolsEnabled,
    mcpServerUrl: mcpServerUrl || null,
    llamaStackUrl: llamaStackUrl || null
  });
}
