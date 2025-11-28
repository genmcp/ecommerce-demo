import { NextResponse } from 'next/server';

// Simple in-memory cart storage (in production, use a database)
// Map of uid -> cart items
const getCartsStorage = () => {
    if (!(global as any).carts) {
        (global as any).carts = new Map<string, Array<{ id: string; name: string; price: number }>>();
    }
    return (global as any).carts;
};

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { uid, productId, productName, productPrice } = body;

        if (!uid || !productId || !productName || productPrice === undefined) {
            return NextResponse.json(
                { error: 'Missing required fields: uid, productId, productName, productPrice' },
                { status: 400 }
            );
        }

        // The friction: Only accepts single item, no quantity parameter
        // Agent must call this endpoint multiple times to add multiple quantities

        const carts = getCartsStorage();

        // Get or create cart for this user
        if (!carts.has(uid)) {
            carts.set(uid, []);
        }

        const cart = carts.get(uid)!;

        // Add single item
        cart.push({
            id: productId,
            name: productName,
            price: productPrice,
        });

        return NextResponse.json({
            success: true,
            message: 'Item added to cart',
            cartItemCount: cart.length,
            addedItem: {
                productId,
                productName,
                productPrice,
            },
        });
    } catch (error) {
        console.error('Error adding to cart:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
