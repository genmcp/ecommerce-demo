import { NextResponse } from 'next/server';
import { getProducts } from '../../products/route';

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
        const { product } = body;

        if (!product) {
            return NextResponse.json(
                { error: 'Missing required field: product' },
                { status: 400 }
            );
        }

        // Look up the product by ID
        const products = getProducts();
        const foundProduct = products.find(p => p.id === product);

        if (!foundProduct) {
            return NextResponse.json(
                { error: 'Product not found' },
                { status: 404 }
            );
        }

        const cart = getCart();

        // Add single item
        cart.push({
            id: foundProduct.id,
            name: foundProduct.name,
            price: foundProduct.price,
        });

        return NextResponse.json({
            success: true,
            message: 'Item added to cart',
            cartItemCount: cart.length,
            addedItem: {
                productId: foundProduct.id,
                productName: foundProduct.name,
                productPrice: foundProduct.price,
            },
        });
    } catch (error) {
        console.error('Error adding to cart:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
