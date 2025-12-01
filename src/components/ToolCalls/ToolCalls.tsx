'use client';

import { useState, useEffect } from 'react';
import styles from './ToolCalls.module.css';

export interface ToolCall {
    id: string;
    timestamp: string;
    tool: string;
    status: 'calling' | 'completed' | 'error';
}

interface ToolCallsProps {
    toolCalls: ToolCall[];
}

const ToolCalls = ({ toolCalls }: ToolCallsProps) => {
    const [displayCalls, setDisplayCalls] = useState<ToolCall[]>([]);

    useEffect(() => {
        setDisplayCalls(toolCalls);
    }, [toolCalls]);

    return (
        <div className={styles.toolCalls}>
            <div className={styles.header}>
                <h2 className={styles.title}>Tool Calls</h2>
                <span className={styles.count}>{toolCalls.length}</span>
            </div>

            <div className={styles.callsList}>
                {displayCalls.length === 0 ? (
                    <p className={styles.empty}>No active tool calls.</p>
                ) : (
                    [...displayCalls].reverse().map((call) => (
                        <div 
                            key={call.id} 
                            className={`${styles.callItem} ${styles[call.status]}`}
                        >
                            <div className={styles.callInfo}>
                                <div className={styles.callHeader}>
                                    <span className={styles.toolName}>{call.tool}</span>
                                    <span className={styles.statusBadge}>{call.status}</span>
                                </div>
                                <span className={styles.timestamp}>[{call.timestamp}]</span>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

export default ToolCalls;

