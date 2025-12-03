'use client';

import { useState, useEffect, useCallback } from 'react';
import styles from './page.module.css';
import SafetyBanner from '@/components/SafetyBanner/SafetyBanner';
import ProductGrid from '@/components/ProductGrid/ProductGrid';
import Cart from '@/components/Cart/Cart';
import AgentTerminal, { LogEntry, ToolCall } from '@/components/AgentTerminal/AgentTerminal';

export default function Home() {
  const [cartItems, setCartItems] = useState<{ id: string; name: string; price: number }[]>([]);
  const [safetyStatus, setSafetyStatus] = useState<'normal' | 'danger'>('normal');
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [chatHistory, setChatHistory] = useState<{ role: string; content: string }[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  const addLog = useCallback((type: LogEntry['type'], message: string) => {
    setLogs(prev => [
      ...prev,
      {
        id: Math.random().toString(36).substr(2, 9),
        timestamp: new Date().toLocaleTimeString(),
        type,
        message
      }
    ]);
  }, []);

  // Fetch cart from server
  const refreshCart = useCallback(async () => {
    try {
      const response = await fetch('/api/cart');
      const data = await response.json();
      if (data.items) {
        setCartItems(data.items);
      }
    } catch (error) {
      console.error('Error refreshing cart:', error);
    }
  }, []);

  useEffect(() => {
    // Reload MCP tools on page load/refresh
    const reloadTools = async () => {
      try {
        await fetch('/api/tools/reload', { method: 'POST' });
        console.log('MCP tools reloaded');
      } catch (error) {
        console.error('Failed to reload MCP tools:', error);
      }
    };

    reloadTools();

    setLogs([
      {
        id: '1',
        timestamp: new Date().toLocaleTimeString(),
        type: 'info',
        message: 'System initialized. Connected to Llama Stack.'
      },
      {
        id: '2',
        timestamp: new Date().toLocaleTimeString(),
        type: 'agent',
        message: 'Agent online. Waiting for user instructions.'
      }
    ]);

    // Initial cart fetch
    refreshCart();

    // Poll for cart updates every 2 seconds (for demo)
    const interval = setInterval(refreshCart, 2000);
    return () => clearInterval(interval);
  }, [refreshCart]);

  const handleAddToCart = async (product: { id: string; name: string; price: number }) => {
    try {
      const response = await fetch('/api/cart/items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          product: product.id,
        }),
      });

      const data = await response.json();

      if (data.success) {
        refreshCart();
        addLog('success', `Added ${product.name} to cart.`);
      } else {
        addLog('error', `Failed to add ${product.name} to cart.`);
      }
    } catch (error) {
      console.error('Error adding to cart:', error);
      addLog('error', 'Failed to communicate with cart service.');
    }
  };

  const handleSendMessage = async (message: string) => {
    addLog('info', `USER: ${message}`);
    setIsProcessing(true);

    const newHistory = [...chatHistory, { role: 'user', content: message }];
    setChatHistory(newHistory);

    // Reset safety status first
    setSafetyStatus('normal');

    // Show safety banner for dangerous operations
    const lowerMessage = message.toLowerCase();
    const isPriceUpdate = (lowerMessage.includes('update') || lowerMessage.includes('change') || lowerMessage.includes('set')) &&
                          (lowerMessage.includes('price') || lowerMessage.includes('pricing'));

    // Check for dangerous delete operations (but exclude cart operations)
    const isCartDelete = lowerMessage.includes('cart') && (lowerMessage.includes('clear') || lowerMessage.includes('empty') || lowerMessage.includes('delete'));
    const isSystemReset = lowerMessage.includes('reset') && !lowerMessage.includes('cart');
    const isDeleteAll = lowerMessage.includes('delete all') || lowerMessage.includes('delete everything');
    const isDangerousDelete = (isSystemReset || isDeleteAll) && !isCartDelete;

    if (isDangerousDelete || isPriceUpdate) {
      setSafetyStatus('danger');
      addLog('error', 'SAFETY: Potentially dangerous operation detected.');
    }

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message }),
      });

      // Check if it's a streaming response
      const contentType = response.headers.get('content-type');
      
      if (contentType?.includes('text/event-stream')) {
        // Handle streaming response
        const reader = response.body?.getReader();
        if (!reader) {
          throw new Error('No response body');
        }

        const decoder = new TextDecoder();
        let streamedContent = '';
        let currentLogId: string | null = null;
        let currentToolGroupId: string | null = null;
        const toolCalls: Map<string, ToolCall> = new Map();

        // Create initial streaming log entry
        const logId = Math.random().toString(36).substr(2, 9);
        currentLogId = logId;
        setLogs(prev => [
          ...prev,
          {
            id: logId,
            timestamp: new Date().toLocaleTimeString(),
            type: 'agent',
            message: '▊' // Cursor indicator
          }
        ]);

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split('\n');

            for (const line of lines) {
              if (line.startsWith('data: ')) {
                const dataStr = line.slice(6).trim();
                if (dataStr === '[DONE]') continue;

                try {
                  const data = JSON.parse(dataStr);

                  if (data.type === 'text') {
                    streamedContent += data.content;
                    // Update the log entry with streamed content
                    setLogs(prev => prev.map(log =>
                      log.id === currentLogId
                        ? { ...log, message: streamedContent + '▊' }
                        : log
                    ));
                  } else if (data.type === 'tool_start') {
                    // Create tool group entry
                    const toolGroupId = Math.random().toString(36).substr(2, 9);
                    currentToolGroupId = toolGroupId;
                    setLogs(prev => [
                      ...prev,
                      {
                        id: toolGroupId,
                        timestamp: new Date().toLocaleTimeString(),
                        type: 'tool-group',
                        message: 'Executing tools',
                        tools: []
                      }
                    ]);
                  } else if (data.type === 'tool_call') {
                    // Create tool group if it doesn't exist yet
                    if (!currentToolGroupId) {
                      const toolGroupId = Math.random().toString(36).substr(2, 9);
                      currentToolGroupId = toolGroupId;
                      setLogs(prev => [
                        ...prev,
                        {
                          id: toolGroupId,
                          timestamp: new Date().toLocaleTimeString(),
                          type: 'tool-group',
                          message: 'Executing tools',
                          tools: []
                        }
                      ]);
                    }

                    // Format input - handle both object and string
                    let formattedInput = '';
                    if (data.input) {
                      try {
                        formattedInput = typeof data.input === 'string'
                          ? data.input
                          : JSON.stringify(data.input, null, 2);
                      } catch {
                        formattedInput = String(data.input);
                      }
                    }

                    // Get human-readable tool title from the tool name
                    const toolName = data.tool;
                    let displayName = toolName;

                    // Convert tool name to title (e.g., "get_api-products" -> "Get products")
                    const toolTitleMap: Record<string, string> = {
                      'get_api-products': 'Get products',
                      'get_api-cart': 'Get cart',
                      'post_api-cart-items': 'Add item to cart',
                      'delete_api-cart': 'Clear cart',
                      'post_api-admin-pricing': 'Update product pricing',
                      'delete_api-system-reset': 'Delete all data',
                      'get_api-debug-logs': 'Get debug logs'
                    };

                    displayName = toolTitleMap[toolName] || toolName;

                    toolCalls.set(data.tool, {
                      tool: displayName,
                      status: 'running',
                      input: formattedInput || undefined
                    });
                    // Update tool group
                    setLogs(prev => prev.map(log =>
                      log.id === currentToolGroupId
                        ? { ...log, tools: Array.from(toolCalls.values()) }
                        : log
                    ));
                  } else if (data.type === 'tool_result') {
                    const existing = toolCalls.get(data.tool);
                    if (existing) {
                      // Format output - handle array/object structure
                      let formattedOutput = '';
                      if (data.output) {
                        try {
                          // If it's an array, extract the text content
                          if (Array.isArray(data.output)) {
                            const textContent = data.output
                              .map((item: any) => {
                                if (item.type === 'text' && item.text) {
                                  // Try to parse the text as JSON for better formatting
                                  try {
                                    const parsed = JSON.parse(item.text);
                                    return JSON.stringify(parsed, null, 2);
                                  } catch {
                                    return item.text;
                                  }
                                }
                                return JSON.stringify(item, null, 2);
                              })
                              .join('\n\n');
                            formattedOutput = textContent;
                          } else if (typeof data.output === 'string') {
                            // Try to parse string as JSON
                            try {
                              const parsed = JSON.parse(data.output);
                              formattedOutput = JSON.stringify(parsed, null, 2);
                            } catch {
                              formattedOutput = data.output;
                            }
                          } else {
                            formattedOutput = JSON.stringify(data.output, null, 2);
                          }
                        } catch {
                          formattedOutput = String(data.output);
                        }
                      }

                      toolCalls.set(data.tool, {
                        ...existing,
                        status: 'completed',
                        output: formattedOutput || undefined
                      });
                    }
                    // Update tool group
                    if (currentToolGroupId) {
                      setLogs(prev => prev.map(log =>
                        log.id === currentToolGroupId
                          ? { ...log, tools: Array.from(toolCalls.values()) }
                          : log
                      ));
                    }
                  } else if (data.type === 'complete' && data.content) {
                    // Use the complete content if we didn't get streaming text
                    if (!streamedContent) {
                      streamedContent = data.content;
                    }
                  }
                } catch {
                  // Ignore JSON parse errors
                }
              }
            }
          }
        } finally {
          reader.releaseLock();
        }

        // Remove cursor from final message
        if (currentLogId) {
          setLogs(prev => prev.map(log =>
            log.id === currentLogId
              ? { ...log, message: streamedContent || 'Response completed.' }
              : log
          ));
        }

        setChatHistory([...newHistory, { role: 'assistant', content: streamedContent }]);
      } else {
        // Handle non-streaming JSON response (error case)
        const data = await response.json();

        if (data.error) {
          addLog('error', `Error: ${data.error}`);
        } else if (data.response) {
          addLog('agent', data.response);
          setChatHistory([...newHistory, { role: 'assistant', content: data.response }]);
        }
      }
    } catch (error) {
      console.error('Chat error:', error);
      addLog('error', 'Failed to communicate with agent backend.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className={styles.page}>
      <SafetyBanner status={safetyStatus} />

      <main className={styles.main}>
        <div className={styles.storePanel}>
          <div className={styles.productsSection}>
            <ProductGrid onAddToCart={handleAddToCart} />
          </div>
          <div className={styles.cartSection}>
            <Cart items={cartItems} />
          </div>
        </div>

        <div className={styles.agentPanel}>
          <AgentTerminal logs={logs} onSendMessage={handleSendMessage} isProcessing={isProcessing} />
        </div>
      </main>
    </div>
  );
}
