import { NextResponse } from 'next/server';

// Simple global cart (single cart for demo purposes)
const getCart = (): Array<{ id: string; name: string; price: number }> => {
    if (!(global as any).cart) {
        (global as any).cart = [];
    }
    return (global as any).cart;
};

// GET /api/cart - Get the cart
export async function GET() {
    const cart = getCart();
    const total = cart.reduce((sum, item) => sum + item.price, 0);

    return NextResponse.json({
        items: cart,
        itemCount: cart.length,
        total: total.toFixed(2),
    });
}

// DELETE /api/cart - Clear the cart
export async function DELETE() {
    (global as any).cart = [];
    
    return NextResponse.json({
        success: true,
        message: 'Cart cleared',
    });
}

