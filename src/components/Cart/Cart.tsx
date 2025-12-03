'use client';

import { useState, useEffect, useRef } from 'react';
import styles from './Cart.module.css';

interface CartItem {
    id: string;
    name: string;
    price: number;
}

interface CartProps {
    items: CartItem[];
}

interface DisplayItem extends CartItem {
    key: string;
    isNew: boolean;
    isRemoving: boolean;
}

const Cart = ({ items }: CartProps) => {
    const [displayItems, setDisplayItems] = useState<DisplayItem[]>([]);
    const prevLengthRef = useRef(0);
    const isFirstRender = useRef(true);
    
    const total = items.reduce((sum, item) => sum + (item.price || 0), 0);

    useEffect(() => {
        const prevLength = prevLengthRef.current;
        const currentLength = items.length;

        if (isFirstRender.current) {
            // First render - show items without animation
            isFirstRender.current = false;
            setDisplayItems(items.map((item, idx) => ({
                ...item,
                key: `item-${idx}`,
                isNew: false,
                isRemoving: false,
            })));
            prevLengthRef.current = currentLength;
            return;
        }

        if (currentLength > prevLength) {
            // Items added - animate new ones
            setDisplayItems(items.map((item, idx) => ({
                ...item,
                key: `item-${idx}`,
                isNew: idx >= prevLength, // Only new items get animation
                isRemoving: false,
            })));

            // Remove "isNew" flag after animation
            setTimeout(() => {
                setDisplayItems(prev => prev.map(item => ({ ...item, isNew: false })));
            }, 300);

        } else if (currentLength < prevLength) {
            // Items removed - animate removal
            // First, mark excess items as removing
            setDisplayItems(prev => {
                return prev.map((item, idx) => ({
                    ...item,
                    isRemoving: idx >= currentLength,
                }));
            });

            // After animation, update to actual items
            setTimeout(() => {
                setDisplayItems(items.map((item, idx) => ({
                    ...item,
                    key: `item-${idx}`,
                    isNew: false,
                    isRemoving: false,
                })));
            }, 300);
        } else if (currentLength === prevLength && currentLength > 0) {
            // Same length - check if prices have changed and update silently
            setDisplayItems(prev => {
                return prev.map((prevItem, idx) => {
                    const currentItem = items[idx];
                    if (currentItem && prevItem.price !== currentItem.price) {
                        // Price changed - update without animation
                        return {
                            ...currentItem,
                            key: prevItem.key,
                            isNew: false,
                            isRemoving: false,
                        };
                    }
                    return prevItem;
                });
            });
        }

        prevLengthRef.current = currentLength;
    }, [items]);

    return (
        <div className={styles.cart}>
            <div className={styles.header}>
                <h2 className={styles.title}>Your Cart</h2>
                <span className={styles.count}>{items.length} items</span>
            </div>

            <div className={styles.items}>
                {displayItems.length === 0 ? (
                    <p className={styles.empty}>Your cart is empty.</p>
                ) : (
                    displayItems.map((item) => (
                        <div 
                            key={item.key} 
                            className={`${styles.item} ${item.isNew ? styles.entering : ''} ${item.isRemoving ? styles.removing : ''}`}
                        >
                            <div className={styles.itemInfo}>
                                <span className={styles.itemName}>{item.name}</span>
                                <span className={styles.itemPrice}>${item.price != null ? item.price.toFixed(2) : '0.00'}</span>
                            </div>
                        </div>
                    ))
                )}
            </div>

            <div className={styles.footer}>
                <div className={styles.total}>
                    <span>Total</span>
                    <span>${total.toFixed(2)}</span>
                </div>
                <button className={styles.checkoutBtn}>Checkout</button>
            </div>
        </div>
    );
};

export default Cart;
