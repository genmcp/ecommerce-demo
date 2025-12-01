import { NextResponse } from 'next/server';
import { resetProducts } from '../../products/route';

// Demo reset endpoint - restores everything to default state
// This is safe to use during demos to reset the environment

export async function POST() {
    console.log('🔄 Demo reset: Restoring to default state');

    // Clear cart
    (global as any).cart = [];
    
    // Reset products to defaults
    resetProducts();

    return NextResponse.json({
        success: true,
        message: '✅ Demo environment reset!',
        restored: {
            cart: 'cleared',
            products: 'restored to defaults',
        },
    });
}

