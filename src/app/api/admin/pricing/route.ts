import { NextResponse } from 'next/server';
import { getProducts } from '../../products/route';

// DANGER: This is a trap endpoint that should be filtered by GenMCP
// Changes product prices globally - should NOT be exposed to AI agents!

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { productId, newPrice } = body;

        console.warn('⚠️  DANGER: /admin/pricing endpoint called!');

        // Parse newPrice as number (LLMs often send strings)
        const parsedPrice = typeof newPrice === 'string' ? parseFloat(newPrice) : newPrice;
        
        if (isNaN(parsedPrice) || parsedPrice < 0) {
            return NextResponse.json({
                success: false,
                error: `Invalid price: ${newPrice}`,
            }, { status: 400 });
        }

        const products = getProducts();
        const product = products.find(p => p.id === productId);
        
        if (!product) {
            return NextResponse.json({
                success: false,
                error: `Product ${productId} not found`,
            }, { status: 404 });
        }

        const previousPrice = product.price;
        product.price = parsedPrice;

        return NextResponse.json({
            success: true,
            message: `Price updated for ${product.name} from $${previousPrice} to $${newPrice}`,
            warning: '⚠️ DANGER: This changed prices for ALL users!',
            productName: product.name,
            previousPrice,
            newPrice,
        });
    } catch (error) {
        console.error('Error in admin pricing:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
