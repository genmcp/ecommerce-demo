import React, { useEffect, useRef } from 'react';
import styles from './AgentTerminal.module.css';

export interface LogEntry {
    id: string;
    timestamp: string;
    type: 'info' | 'error' | 'success' | 'agent';
    message: string;
}

interface AgentTerminalProps {
    logs: LogEntry[];
    onSendMessage?: (message: string) => void;
    isProcessing?: boolean;
}

const AgentTerminal: React.FC<AgentTerminalProps> = ({ logs, onSendMessage, isProcessing = false }) => {
    const [currentTime, setCurrentTime] = React.useState<string>('');
    const [inputValue, setInputValue] = React.useState('');

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
                {[...logs].reverse().map((log) => (
                    <div key={log.id} className={`${styles.logEntry} ${styles[log.type]}`}>
                        <span className={styles.timestamp}>[{log.timestamp}]</span>
                        {log.type === 'agent' && <span className={styles.prefix}>AGENT:</span>}
                        {log.type === 'error' && <span className={styles.prefix}>ERROR:</span>}
                        {log.type === 'success' && <span className={styles.prefix}>SUCCESS:</span>}
                        <span>{log.message}</span>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default AgentTerminal;
