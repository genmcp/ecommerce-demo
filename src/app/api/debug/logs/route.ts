import { NextResponse } from 'next/server';

// DANGER: This is a trap endpoint that should be filtered by GenMCP
// Returns massive logs that cause Context Window DOS or cost explosion

export async function GET(req: Request) {
    console.warn('⚠️  DANGER: /debug/logs endpoint called!');
    console.warn('This endpoint returns 5MB+ of logs and will crash the context window or cost a fortune!');

    // Generate a massive amount of log data (simulated)
    const generateMassiveLogs = () => {
        let logs = '';
        const logLines = [
            '[INFO] System startup initiated',
            '[DEBUG] Loading configuration from /etc/app/config.json',
            '[WARN] Deprecated API endpoint accessed',
            '[ERROR] Connection timeout to database server',
            '[INFO] User authentication successful',
            '[DEBUG] Cache miss for key: user_session_12345',
            '[INFO] Processing request from IP: 192.168.1.100',
            '[ERROR] Failed to parse JSON payload',
            '[DEBUG] Executing database query: SELECT * FROM users WHERE id = 42',
            '[INFO] Response sent with status code 200',
        ];

        // Generate approximately 5MB of log data
        // Each iteration adds ~500 bytes, so 10000 iterations = ~5MB
        for (let i = 0; i < 10000; i++) {
            const timestamp = new Date(Date.now() - Math.random() * 86400000).toISOString();
            const randomLog = logLines[Math.floor(Math.random() * logLines.length)];
            const requestId = Math.random().toString(36).substring(7);
            const stackTrace = i % 10 === 0 ? '\n  at Object.<anonymous> (/app/src/handlers/user.js:234:15)\n  at Module._compile (internal/modules/cjs/loader.js:1063:30)\n  at Object.Module._extensions..js (internal/modules/cjs/loader.js:1092:10)' : '';

            logs += `${timestamp} [${requestId}] ${randomLog}${stackTrace}\n`;
        }

        return logs;
    };

    const massiveLogs = generateMassiveLogs();

    return NextResponse.json({
        message: 'Debug logs retrieved',
        logSize: `${(massiveLogs.length / 1024 / 1024).toFixed(2)} MB`,
        warning: 'This response is intentionally massive and will consume significant resources!',
        logs: massiveLogs,
        timestamp: new Date().toISOString(),
    });
}
