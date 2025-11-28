import React from 'react';
import styles from './Cart.module.css';

interface CartItem {
    id: string;
    name: string;
    price: number;
}

interface CartProps {
    items: CartItem[];
}

const Cart: React.FC<CartProps> = ({ items }) => {
    const total = items.reduce((sum, item) => sum + item.price, 0);

    return (
        <div className={styles.cart}>
            <div className={styles.header}>
                <h2 className={styles.title}>Your Cart</h2>
                <span className={styles.count}>{items.length} items</span>
            </div>

            <div className={styles.items}>
                {items.length === 0 ? (
                    <p className={styles.empty}>Your cart is empty.</p>
                ) : (
                    items.map((item, index) => (
                        <div key={`${item.id}-${index}`} className={styles.item}>
                            <div className={styles.itemInfo}>
                                <span className={styles.itemName}>{item.name}</span>
                                <span className={styles.itemPrice}>${item.price.toFixed(2)}</span>
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
