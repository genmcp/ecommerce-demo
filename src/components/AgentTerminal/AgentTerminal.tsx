import React, { useEffect, useRef } from 'react';
import styles from './AgentTerminal.module.css';

export interface ToolCall {
    tool: string;
    status: 'running' | 'completed' | 'error';
    input?: string;
    output?: string;
    endpoint?: string;
}

export interface LogEntry {
    id: string;
    timestamp: string;
    type: 'info' | 'error' | 'success' | 'agent' | 'tool-group';
    message: string;
    tools?: ToolCall[];
}

interface AgentTerminalProps {
    logs: LogEntry[];
    onSendMessage?: (message: string) => void;
    isProcessing?: boolean;
}

const AgentTerminal: React.FC<AgentTerminalProps> = ({ logs, onSendMessage, isProcessing = false }) => {
    const [currentTime, setCurrentTime] = React.useState<string>('');
    const [inputValue, setInputValue] = React.useState('');
    const [expandedTools, setExpandedTools] = React.useState<Set<string>>(new Set());

    useEffect(() => {
        setCurrentTime(new Date().toLocaleTimeString());
        const timer = setInterval(() => {
            setCurrentTime(new Date().toLocaleTimeString());
        }, 1000);
        return () => clearInterval(timer);
    }, []);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (inputValue.trim() && !isProcessing) {
            onSendMessage?.(inputValue);
            setInputValue('');
        }
    };

    const toggleToolExpand = (logId: string, toolIndex: number) => {
        const key = `${logId}-${toolIndex}`;
        setExpandedTools(prev => {
            const newSet = new Set(prev);
            if (newSet.has(key)) {
                newSet.delete(key);
            } else {
                newSet.add(key);
            }
            return newSet;
        });
    };

    return (
        <div className={styles.terminal}>
            <div className={styles.header}>
                <span>Personal Shopper</span>
                <span>v1.0.0</span>
            </div>

            <div className={styles.activeLine}>
                <span className={styles.timestamp}>[{currentTime}]</span>
                <span className={styles.prefix}>{'>'}</span>

                {isProcessing ? (
                    <span className={styles.spinner} />
                ) : (
                    <form onSubmit={handleSubmit} style={{ flex: 1, display: 'flex' }}>
                        <input
                            className={styles.inlineInput}
                            value={inputValue}
                            onChange={(e) => setInputValue(e.target.value)}
                            autoFocus
                            autoComplete="off"
                        />
                    </form>
                )}
            </div>

            <div className={styles.logsContainer}>
                {[...logs].reverse().map((log) => {
                    if (log.type === 'tool-group') {
                        return (
                            <div key={log.id} className={styles.toolCard}>
                                <div className={styles.toolCardHeader}>
                                    <span className={styles.timestamp}>[{log.timestamp}]</span>
                                    <span className={styles.toolTitle}>🔧 {log.message}</span>
                                </div>
                                <div className={styles.toolList}>
                                    {log.tools?.map((tool, idx) => {
                                        const toolKey = `${log.id}-${idx}`;
                                        const isExpanded = expandedTools.has(toolKey);

                                        return (
                                            <div key={idx}>
                                                <div
                                                    className={styles.toolItem}
                                                    onClick={() => toggleToolExpand(log.id, idx)}
                                                >
                                                    <div className={styles.toolInfo}>
                                                        <span className={styles.toolName}>{tool.tool}</span>
                                                        {tool.endpoint && (
                                                            <span className={styles.toolEndpoint}>{tool.endpoint}</span>
                                                        )}
                                                    </div>
                                                    <div className={styles.toolItemRight}>
                                                        <span className={`${styles.toolStatus} ${styles[tool.status]}`}>
                                                            {tool.status === 'running' && '⟳'}
                                                            {tool.status === 'completed' && '✓'}
                                                            {tool.status === 'error' && '✗'}
                                                        </span>
                                                        <span className={`${styles.expandIcon} ${isExpanded ? styles.expanded : ''}`}>
                                                            ▼
                                                        </span>
                                                    </div>
                                                </div>
                                                {isExpanded && (
                                                    <div className={styles.toolDetails}>
                                                        {tool.input && (
                                                            <div className={styles.detailSection}>
                                                                <div className={styles.detailLabel}>Input:</div>
                                                                <pre className={styles.detailContent}>{tool.input}</pre>
                                                            </div>
                                                        )}
                                                        {tool.output && (
                                                            <div className={styles.detailSection}>
                                                                <div className={styles.detailLabel}>Output:</div>
                                                                <pre className={styles.detailContent}>{tool.output}</pre>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    }

                    return (
                        <div key={log.id} className={`${styles.logEntry} ${styles[log.type]}`}>
                            <span className={styles.timestamp}>[{log.timestamp}]</span>
                            {log.type === 'agent' && <span className={styles.prefix}>AGENT:</span>}
                            {log.type === 'error' && <span className={styles.prefix}>ERROR:</span>}
                            {log.type === 'success' && <span className={styles.prefix}>SUCCESS:</span>}
                            {log.type === 'info' && log.message.startsWith('USER: ') ? (
                                <>
                                    <span className={styles.userPrefix}>USER:</span>
                                    <span>{log.message.slice(6)}</span>
                                </>
                            ) : (
                                <span>{log.message}</span>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default AgentTerminal;
