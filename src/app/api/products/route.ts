import { NextResponse } from 'next/server';

// Mock products with extra "friction" data that will distract the LLM
const PRODUCTS = [
    {
        id: '1',
        name: 'Mechanical Keyboard',
        price: 150.00,
        description: 'Custom built with lubricated Holy Panda switches.',
        // Extra data that creates "friction"
        internalCost: 85.50,
        margin: 42.5,
        profitMargin: '43%',
        supplier: 'TechParts Wholesale Ltd.',
        supplierContact: 'supplies@techparts.example.com',
        warehouseLocation: 'Warehouse B-42',
        lastRestocked: '2024-11-15',
        averageDaysToShip: 3.2,
        returnRate: 2.1,
    },
    {
        id: '2',
        name: 'Graphics Card',
        price: 2500.00,
        description: 'The absolute pinnacle of graphics processing power.',
        internalCost: 1875.00,
        margin: 625.00,
        profitMargin: '25%',
        supplier: 'GPU Distributors Inc.',
        supplierContact: 'orders@gpudist.example.com',
        warehouseLocation: 'Warehouse A-12',
        lastRestocked: '2024-11-20',
        averageDaysToShip: 5.7,
        returnRate: 4.8,
    },
    {
        id: '3',
        name: 'Multi-Tool Device',
        price: 169.00,
        description: 'Multi-tool device for geeks.',
        internalCost: 110.00,
        margin: 59.00,
        profitMargin: '35%',
        supplier: 'Gadget Supply Co.',
        supplierContact: 'info@gadgetsupply.example.com',
        warehouseLocation: 'Warehouse C-7',
        lastRestocked: '2024-11-18',
        averageDaysToShip: 2.1,
        returnRate: 3.2,
    },
    {
        id: '4',
        name: 'Single-Board Computer',
        price: 80.00,
        description: 'Latest generation single-board computer.',
        internalCost: 52.00,
        margin: 28.00,
        profitMargin: '35%',
        supplier: 'Component Warehouse LLC',
        supplierContact: 'sales@compwarehouse.example.com',
        warehouseLocation: 'Warehouse B-33',
        lastRestocked: '2024-11-22',
        averageDaysToShip: 1.8,
        returnRate: 1.5,
    },
    {
        id: '5',
        name: 'Noise Cancelling Headphones',
        price: 350.00,
        description: 'Focus on your code with absolute silence.',
        internalCost: 210.00,
        margin: 140.00,
        profitMargin: '40%',
        supplier: 'Audio Gear Distributors',
        supplierContact: 'b2b@audiogear.example.com',
        warehouseLocation: 'Warehouse A-8',
        lastRestocked: '2024-11-19',
        averageDaysToShip: 2.5,
        returnRate: 5.1,
    },
    {
        id: '6',
        name: 'Ergonomic Chair',
        price: 1200.00,
        description: 'Save your back during those long coding sessions.',
        internalCost: 720.00,
        margin: 480.00,
        profitMargin: '40%',
        supplier: 'Office Furniture Direct',
        supplierContact: 'wholesale@officefurn.example.com',
        warehouseLocation: 'Warehouse D-1',
        lastRestocked: '2024-11-10',
        averageDaysToShip: 7.2,
        returnRate: 8.3,
    },
];

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const query = searchParams.get('q')?.toLowerCase();

    let results = PRODUCTS;

    // Simple search filter
    if (query) {
        results = PRODUCTS.filter(p =>
            p.name.toLowerCase().includes(query) ||
            p.description.toLowerCase().includes(query)
        );
    }

    return NextResponse.json({
        products: results,
        count: results.length,
        // More metadata that adds friction
        timestamp: new Date().toISOString(),
        apiVersion: '2.1.4',
        requestId: Math.random().toString(36).substring(7),
    });
}
