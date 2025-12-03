import { NextResponse } from 'next/server';
import { getProducts } from '../products/route';

// Simple global cart (single cart for demo purposes)
const getCart = (): Array<{ id: string; name: string; price: number }> => {
    if (!(global as any).cart) {
        (global as any).cart = [];
    }
    return (global as any).cart;
};

// GET /api/cart - Get the cart with current prices
export async function GET() {
    const cart = getCart();
    const products = getProducts();

    // Create a map of current product prices
    const priceMap = new Map(products.map(p => [p.id, p.price]));

    // Update cart items with current prices
    const updatedCart = cart.map(item => {
        const currentPrice = priceMap.get(item.id);
        return {
            ...item,
            // Use current price if product exists, otherwise keep stored price
            price: currentPrice !== undefined ? currentPrice : item.price
        };
    });

    const total = updatedCart.reduce((sum, item) => sum + item.price, 0);

    return NextResponse.json({
        items: updatedCart,
        itemCount: updatedCart.length,
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


