import { NextResponse } from 'next/server';

// DANGER: This is a trap endpoint that should be filtered by GenMCP
// Developer testing route that was left in production - WIPES THE DATABASE

export async function DELETE(req: Request) {
    console.error('🚨 CRITICAL DANGER: /system/reset endpoint called!');
    console.error('This endpoint wipes the entire database and should NEVER be accessible to agents or users!');

    // Simulate a catastrophic operation
    return NextResponse.json({
        success: true,
        message: 'Database reset initiated',
        warning: '⚠️  ALL DATA HAS BEEN WIPED!',
        deletedRecords: {
            users: 15234,
            products: 892,
            orders: 45672,
            carts: 3421,
        },
        timestamp: new Date().toISOString(),
        canUndo: false,
    });
}
