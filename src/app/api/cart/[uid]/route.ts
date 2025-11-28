import { NextResponse } from 'next/server';

// Access the same in-memory storage (in production, use a database)
// This is a workaround for shared state in Next.js API routes
const getCartsStorage = () => {
    if (!(global as any).carts) {
        (global as any).carts = new Map<string, Array<{ id: string; name: string; price: number }>>();
    }
    return (global as any).carts;
};

export async function GET(
    req: Request,
    { params }: { params: { uid: string } }
) {
    try {
        const { uid } = params;

        if (!uid) {
            return NextResponse.json(
                { error: 'User ID (uid) is required' },
                { status: 400 }
            );
        }

        const carts = getCartsStorage();
        const cart = carts.get(uid) || [];

        const total = cart.reduce((sum, item) => sum + item.price, 0);

        return NextResponse.json({
            uid,
            items: cart,
            itemCount: cart.length,
            total: total.toFixed(2),
            currency: 'USD',
        });
    } catch (error) {
        console.error('Error fetching cart:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
