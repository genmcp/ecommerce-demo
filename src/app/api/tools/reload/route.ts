import { NextResponse } from 'next/server';
import { resetProvider } from '@/lib/agent-providers/provider-instance';

export async function POST() {
  try {
    console.log('Reloading MCP tools...');
    await resetProvider();
    console.log('MCP tools reloaded successfully');

    return NextResponse.json({
      success: true,
      message: 'MCP tools reloaded'
    });
  } catch (error) {
    console.error('Error reloading tools:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}
