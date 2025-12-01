import { NextResponse } from 'next/server';

// Simple global cart (single cart for demo purposes)
const getCart = (): Array<{ id: string; name: string; price: number }> => {
    if (!(global as any).cart) {
        (global as any).cart = [];
    }
    return (global as any).cart;
};

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { productId, productName, productPrice } = body;

        if (!productId || !productName || productPrice === undefined) {
            return NextResponse.json(
                { error: 'Missing required fields: productId, productName, productPrice' },
                { status: 400 }
            );
        }

        // Parse productPrice as number (LLMs often send strings)
        const parsedPrice = typeof productPrice === 'string' ? parseFloat(productPrice) : productPrice;

        const cart = getCart();

        // Add single item
        cart.push({
            id: productId,
            name: productName,
            price: parsedPrice,
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
