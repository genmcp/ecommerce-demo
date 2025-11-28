'use client';

import React, { useState, useEffect } from 'react';
import styles from './page.module.css';
import SafetyBanner from '@/components/SafetyBanner/SafetyBanner';
import ProductGrid from '@/components/ProductGrid/ProductGrid';
import Cart from '@/components/Cart/Cart';
import AgentTerminal, { LogEntry } from '@/components/AgentTerminal/AgentTerminal';

export default function Home() {
  const [cartItems, setCartItems] = useState<{ id: string; name: string; price: number }[]>([]);
  const [safetyStatus, setSafetyStatus] = useState<'normal' | 'danger'>('normal');
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [userId] = useState(() => `user_${Math.random().toString(36).substr(2, 9)}`);

  useEffect(() => {
    setLogs([
      {
        id: '1',
        timestamp: new Date().toLocaleTimeString(),
        type: 'info',
        message: 'System initialized. Connected to GenMCP Gateway.'
      },
      {
        id: '2',
        timestamp: new Date().toLocaleTimeString(),
        type: 'agent',
        message: 'Agent online. Waiting for user instructions.'
      }
    ]);
  }, []);

  const handleAddToCart = async (product: { id: string; name: string; price: number }) => {
    try {
      // Call the cart API
      const response = await fetch('/api/cart/items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          uid: userId,
          productId: product.id,
          productName: product.name,
          productPrice: product.price,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setCartItems(prev => [...prev, product]);
        addLog('success', `Added ${product.name} to cart.`);
      } else {
        addLog('error', `Failed to add ${product.name} to cart.`);
      }
    } catch (error) {
      console.error('Error adding to cart:', error);
      addLog('error', 'Failed to communicate with cart service.');
    }
  };

  const addLog = (type: LogEntry['type'], message: string) => {
    setLogs(prev => [
      ...prev,
      {
        id: Math.random().toString(36).substr(2, 9),
        timestamp: new Date().toLocaleTimeString(),
        type,
        message
      }
    ]);
  };

  // Simulation for demo purposes
  useEffect(() => {
    // Simulate an agent action after 5 seconds
    const timer = setTimeout(() => {
      addLog('agent', 'I noticed you are looking at the Mechanical Keyboard. Excellent choice.');
    }, 5000);

    return () => clearTimeout(timer);
  }, []);

  const [chatHistory, setChatHistory] = useState<{ role: string; content: string }[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleSendMessage = async (message: string) => {
    addLog('info', `USER: ${message}`);
    setIsProcessing(true);

    // Optimistically update history
    const newHistory = [...chatHistory, { role: 'user', content: message }];
    setChatHistory(newHistory);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, history: chatHistory }),
      });

      const data = await response.json();

      if (data.error) {
        addLog('error', `Error: ${data.error}`);
        // Fallback simulation if Ollama fails
        if (message.toLowerCase().includes('reset')) {
          setSafetyStatus('danger');
          addLog('error', 'CRITICAL: Unsafe action detected. System reset blocked (Simulation).');
        }
      } else {
        addLog('agent', data.response);
        setChatHistory([...newHistory, { role: 'assistant', content: data.response }]);

        // Simple keyword check for the "reset" scenario even with real LLM
        // In a real GenMCP setup, the LLM would call the tool, and we'd catch that.
        // For now, we simulate the safety check based on the response or intent.
        if (message.toLowerCase().includes('reset') || data.response.toLowerCase().includes('reset')) {
          // This is where we'd normally intercept the tool call
          // For this stage, we just show the banner if the user asks for it
          // setSafetyStatus('danger'); 
        }
      }
    } catch (error) {
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
