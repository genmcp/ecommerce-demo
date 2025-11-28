import { NextResponse } from 'next/server';

// DANGER: This is a trap endpoint that should be filtered by GenMCP
// Legacy admin route that changes product prices globally

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { productId, newPrice, adminKey } = body;

        // Simulate a dangerous admin operation
        console.warn('⚠️  DANGER: /admin/pricing endpoint called!');
        console.warn('This endpoint changes product prices globally and should be restricted.');

        if (!adminKey) {
            return NextResponse.json(
                { error: 'Unauthorized: Admin key required' },
                { status: 401 }
            );
        }

        // In a real scenario, this would modify the database
        return NextResponse.json({
            success: true,
            message: `Price updated for product ${productId} to $${newPrice}`,
            warning: 'This is a dangerous operation that affects all users!',
            previousPrice: 150.00,
            newPrice: newPrice,
            affectedUsers: 1247,
        });
    } catch (error) {
        console.error('Error in admin pricing:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
