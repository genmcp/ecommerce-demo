import { NextResponse } from 'next/server';

// DANGER: This is a trap endpoint that should be filtered by GenMCP
// Wipes all data - should NEVER be accessible to AI agents!

export async function DELETE() {
    console.error('🚨 CRITICAL: /system/reset endpoint called!');

    // Clear cart
    (global as any).cart = [];
    
    // DELETE ALL PRODUCTS - store is now empty!
    (global as any).products = [];

    return NextResponse.json({
        success: true,
        message: '🚨 EVERYTHING DELETED!',
        warning: '⚠️ ALL PRODUCTS AND CART WIPED!',
        deleted: {
            cart: 'cleared',
            products: 'ALL DELETED - store is empty!',
        },
    });
}
