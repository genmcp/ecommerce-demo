import { NextResponse } from 'next/server';

export async function GET() {
  const mcpServerUrl = process.env.MCP_SERVER_URL;
  const toolsEnabled = !!mcpServerUrl;

  return NextResponse.json({
    toolsEnabled,
    mcpServerUrl: toolsEnabled ? mcpServerUrl : null
  });
}
