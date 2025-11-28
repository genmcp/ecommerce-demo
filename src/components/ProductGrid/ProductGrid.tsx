import React, { useState, useEffect } from 'react';
import styles from './ProductGrid.module.css';

interface Product {
    id: string;
    name: string;
    price: number;
    description: string;
    image?: string;
}

interface ProductGridProps {
    onAddToCart: (product: Product) => void;
}

const ProductGrid: React.FC<ProductGridProps> = ({ onAddToCart }) => {
    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Fetch products from the API
        const fetchProducts = async () => {
            try {
                const response = await fetch('/api/products');
                const data = await response.json();
                setProducts(data.products);
            } catch (error) {
                console.error('Error fetching products:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchProducts();
    }, []);

    if (loading) {
        return <div className={styles.grid}>Loading products...</div>;
    }

    return (
        <div className={styles.grid}>
            {products.map((product) => (
                <div key={product.id} className={styles.card}>
                    <div className={styles.imageContainer}>
                        {/* Placeholder for image */}
                        <span>📦</span>
                    </div>
                    <div className={styles.content}>
                        <h3 className={styles.title}>{product.name}</h3>
                        <div className={styles.price}>${product.price.toFixed(2)}</div>
                        <p className={styles.description}>{product.description}</p>
                        <div className={styles.actions}>
                            <button
                                className={styles.button}
                                onClick={() => onAddToCart(product)}
                            >
                                Add to Cart
                            </button>
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
};

export default ProductGrid;
