'use client';

import { useState, useEffect, useRef } from 'react';
import styles from './ProductGrid.module.css';

interface Product {
    id: string;
    name: string;
    price: number;
    description: string;
}

interface ProductGridProps {
    onAddToCart: (product: Product) => void;
}

// Animated price component with iOS-style smooth transition
const AnimatedPrice = ({ value, isChanging }: { value: number; isChanging: boolean }) => {
    const [displayValue, setDisplayValue] = useState(value);
    const prevValueRef = useRef(value);
    const animationRef = useRef<number>();

    useEffect(() => {
        const prevValue = prevValueRef.current;
        
        if (prevValue !== value) {
            if (animationRef.current) {
                cancelAnimationFrame(animationRef.current);
            }

            const startTime = performance.now();
            const duration = 1800;
            const startValue = prevValue;
            const endValue = value;

            const animate = (currentTime: number) => {
                const elapsed = currentTime - startTime;
                const progress = Math.min(elapsed / duration, 1);
                
                // Apple-style spring easing
                const easeOut = 1 - Math.pow(1 - progress, 4);
                
                const currentValue = startValue + (endValue - startValue) * easeOut;
                setDisplayValue(currentValue);

                if (progress < 1) {
                    animationRef.current = requestAnimationFrame(animate);
                } else {
                    setDisplayValue(endValue);
                }
            };

            animationRef.current = requestAnimationFrame(animate);
            prevValueRef.current = value;
        }

        return () => {
            if (animationRef.current) {
                cancelAnimationFrame(animationRef.current);
            }
        };
    }, [value]);

    return (
        <span className={`${styles.price} ${isChanging ? styles.priceChanged : ''}`}>
            ${displayValue.toFixed(2)}
        </span>
    );
};

interface DisplayProduct extends Product {
    isRemoving?: boolean;
    isAppearing?: boolean;
    animationDelay?: number;
}

const ProductGrid = ({ onAddToCart }: ProductGridProps) => {
    const [displayProducts, setDisplayProducts] = useState<DisplayProduct[]>([]);
    const [loading, setLoading] = useState(true);
    const [changedPrices, setChangedPrices] = useState<Set<string>>(new Set());
    const prevPricesRef = useRef<Map<string, number>>(new Map());
    const prevCountRef = useRef<number>(0);
    const cardRefs = useRef<Map<string, HTMLDivElement>>(new Map());
    const isFirstLoad = useRef(true);

    // Scroll to card if not visible
    const scrollToCard = (productId: string) => {
        const card = cardRefs.current.get(productId);
        if (!card) return;

        const rect = card.getBoundingClientRect();
        const isVisible = (
            rect.top >= 0 &&
            rect.left >= 0 &&
            rect.bottom <= window.innerHeight &&
            rect.right <= window.innerWidth
        );

        if (!isVisible) {
            card.scrollIntoView({
                behavior: 'smooth',
                block: 'center',
                inline: 'center'
            });
        }
    };

    useEffect(() => {
        const fetchProducts = async () => {
            try {
                const response = await fetch('/api/products');
                const data = await response.json();
                const newProducts: Product[] = data.products;
                const prevCount = prevCountRef.current;
                const newCount = newProducts.length;
                
                // Check for price changes
                const changed = new Set<string>();
                newProducts.forEach(product => {
                    const prevPrice = prevPricesRef.current.get(product.id);
                    if (prevPrice !== undefined && prevPrice !== product.price) {
                        changed.add(product.id);
                    }
                    prevPricesRef.current.set(product.id, product.price);
                });
                
                if (changed.size > 0) {
                    setChangedPrices(changed);
                    const firstChangedId = Array.from(changed)[0];
                    setTimeout(() => scrollToCard(firstChangedId), 100);
                    setTimeout(() => setChangedPrices(new Set()), 3000);
                }

                // Products were deleted (going to 0 or fewer)
                if (newCount < prevCount && prevCount > 0) {
                    setDisplayProducts(prev => 
                        prev.map((p, index) => ({
                            ...p,
                            isRemoving: true,
                            animationDelay: index * 0.05
                        }))
                    );
                    
                    setTimeout(() => {
                        setDisplayProducts(newProducts.map((p, index) => ({ 
                            ...p, 
                            isRemoving: false,
                            isAppearing: false,
                            animationDelay: 0
                        })));
                        prevCountRef.current = newCount;
                    }, 500);
                }
                // Products appeared (coming from 0 or more added)
                else if (newCount > prevCount && !isFirstLoad.current) {
                    setDisplayProducts(newProducts.map((p, index) => ({ 
                        ...p, 
                        isRemoving: false,
                        isAppearing: true,
                        animationDelay: index * 0.06
                    })));
                    prevCountRef.current = newCount;
                    
                    setTimeout(() => {
                        setDisplayProducts(prev => prev.map(p => ({ 
                            ...p, 
                            isAppearing: false 
                        })));
                    }, 1200);
                }
                // Normal update (same count)
                else {
                    if (isFirstLoad.current) {
                        isFirstLoad.current = false;
                    }
                    setDisplayProducts(newProducts.map(p => ({ 
                        ...p, 
                        isRemoving: false, 
                        isAppearing: false,
                        animationDelay: 0
                    })));
                    prevCountRef.current = newCount;
                }
            } catch (error) {
                console.error('Error fetching products:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchProducts();
        
        const interval = setInterval(fetchProducts, 2000);
        return () => clearInterval(interval);
    }, []);

    if (loading) {
        return <div className={styles.grid}>Loading products...</div>;
    }

    return (
        <div className={styles.grid}>
            {displayProducts.length === 0 ? (
                <div className={styles.empty}>No products available</div>
            ) : (
                displayProducts.map((product) => (
                    <div 
                        key={product.id}
                        ref={(el) => {
                            if (el) cardRefs.current.set(product.id, el);
                        }}
                        className={`${styles.card} ${changedPrices.has(product.id) ? styles.ripple : ''} ${product.isRemoving ? styles.removing : ''} ${product.isAppearing ? styles.appearing : ''}`}
                        style={{ 
                            animationDelay: product.animationDelay ? `${product.animationDelay}s` : '0s'
                        }}
                    >
                        <div className={styles.imageContainer}>
                            <span>📦</span>
                        </div>
                        <div className={styles.content}>
                            <div className={styles.productId}>ID: {product.id}</div>
                            <h3 className={styles.title}>{product.name}</h3>
                            <AnimatedPrice 
                                value={product.price} 
                                isChanging={changedPrices.has(product.id)} 
                            />
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
                ))
            )}
        </div>
    );
};

export default ProductGrid;
