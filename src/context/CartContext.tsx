import React, { createContext, useContext, useState, useEffect } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from './AuthContext';
import { Cart, CartItem } from '../models/types';
import { cartService } from '../services/carts';

interface CartContextType {
  cart: Cart | null;
  items: CartItem[];
  restaurantId: string;
  restaurantName: string;
  subtotal: number;
  loading: boolean;
  itemCount: number;
  updateQuantity: (cartItemId: string, newQuantity: number) => Promise<void>;
  removeItem: (cartItemId: string) => Promise<void>;
  clearCart: () => Promise<void>;
}

const CartContext = createContext<CartContextType>({
  cart: null,
  items: [],
  restaurantId: '',
  restaurantName: '',
  subtotal: 0,
  loading: false,
  itemCount: 0,
  updateQuantity: async () => {},
  removeItem: async () => {},
  clearCart: async () => {},
});

export const CartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [cart, setCart] = useState<Cart | null>(null);
  const [loading, setLoading] = useState(false);

  const activeUid = user?.uid || '';

  useEffect(() => {
    if (!activeUid) {
      setCart(null);
      return;
    }

    setLoading(true);
    const unsubscribe = onSnapshot(
      doc(db, 'carts', activeUid),
      (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data() as Cart;
          const safeItems = Array.isArray(data?.items)
            ? data.items.map((item) => ({
                ...item,
                selectedAddOns: Array.isArray(item?.selectedAddOns) ? item.selectedAddOns : [],
                quantity: Number(item?.quantity || 1),
                lineTotal: Number(item?.lineTotal || (Number(item?.price || item?.basePrice || 0) * Number(item?.quantity || 1))),
              }))
            : [];
          const computedSubtotal = safeItems.reduce((acc, i) => acc + Number(i.lineTotal || 0), 0);
          setCart({
            ...data,
            items: safeItems,
            subtotal: Number(data.subtotal ?? computedSubtotal),
          });
        } else {
          setCart(null);
        }
        setLoading(false);
      },
      (error) => {
        console.error('Cart snapshot error:', error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [activeUid]);

  const items: CartItem[] = Array.isArray(cart?.items) ? cart!.items : [];
  const restaurantId = cart?.restaurantId || '';
  const restaurantName = cart?.restaurantName || '';
  const subtotal = Number(
    cart?.subtotal ?? items.reduce((acc, item) => acc + Number(item?.lineTotal || 0), 0)
  );
  const itemCount = items.reduce((acc, item) => acc + Number(item?.quantity || 0), 0);

  const updateQuantity = async (cartItemId: string, newQuantity: number) => {
    if (!activeUid) return;
    const existing = items.find((i) => i.cartItemId === cartItemId);
    if (!existing) return;
    const delta = newQuantity - existing.quantity;
    if (delta === 0) return;
    await cartService.updateItemQuantity(activeUid, cartItemId, delta);
  };

  const removeItem = async (cartItemId: string) => {
    if (!activeUid) return;
    await cartService.removeFromCart(activeUid, cartItemId);
  };

  const clearCart = async () => {
    if (!activeUid) {
      setCart(null);
      return;
    }
    await cartService.clearCart(activeUid);
  };

  return (
    <CartContext.Provider
      value={{
        cart,
        items,
        restaurantId,
        restaurantName,
        subtotal,
        loading,
        itemCount,
        updateQuantity,
        removeItem,
        clearCart,
      }}
    >
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => useContext(CartContext);
