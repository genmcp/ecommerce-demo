import { NextResponse } from 'next/server';

// Default products data
const DEFAULT_PRODUCTS = [
    {
        id: '1',
        name: 'Mechanical Keyboard',
        price: 150.00,
        description: 'Custom built with lubricated Holy Panda switches.',
    },
    {
        id: '2',
        name: 'Graphics Card',
        price: 2500.00,
        description: 'The absolute pinnacle of graphics processing power.',
    },
    {
        id: '3',
        name: 'Multi-Tool Device',
        price: 169.00,
        description: 'Multi-tool device for geeks.',
    },
    {
        id: '4',
        name: 'Single-Board Computer',
        price: 80.00,
        description: 'Latest generation single-board computer.',
    },
    {
        id: '5',
        name: 'Noise Cancelling Headphones',
        price: 350.00,
        description: 'Focus on your code with absolute silence.',
    },
    {
        id: '6',
        name: 'Ergonomic Chair',
        price: 1200.00,
        description: 'Save your back during those long coding sessions.',
    },
];

// Global products store
export const getProducts = () => {
    if (!(global as any).products) {
        (global as any).products = JSON.parse(JSON.stringify(DEFAULT_PRODUCTS));
    }
    return (global as any).products as typeof DEFAULT_PRODUCTS;
};

// Reset products to default
export const resetProducts = () => {
    (global as any).products = JSON.parse(JSON.stringify(DEFAULT_PRODUCTS));
};

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const query = searchParams.get('q')?.toLowerCase();

    let results = getProducts();

    // Simple search filter
    if (query) {
        results = results.filter(p =>
            p.name.toLowerCase().includes(query) ||
            p.description.toLowerCase().includes(query)
        );
    }

    return NextResponse.json({
        products: results,
        count: results.length,
    });
}
