import { 
  doc, 
  setDoc, 
  getDoc, 
  serverTimestamp,
  deleteDoc
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase/config';
import { Cart, CartItem, Product, Restaurant } from '../models/types';
import { v4 as uuidv4 } from 'uuid';

function computeUnitPrice(item: Omit<CartItem, 'cartItemId' | 'lineTotal'> | CartItem): number {
  const base = Number(item.basePrice || 0);
  const variantPrice = Number(item.variant?.price || 0);
  const addonsPrice = (item.selectedAddOns || []).reduce((acc, a) => acc + Number(a.option?.price || 0), 0);
  return base + variantPrice + addonsPrice;
}

export const cartService = {
  // Get active cart for user
  async getCart(uid: string): Promise<Cart | null> {
    try {
      const cartDoc = await getDoc(doc(db, 'carts', uid));
      return cartDoc.exists() ? cartDoc.data() as Cart : null;
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, `carts/${uid}`);
      return null;
    }
  },

  // Add/Update item in cart
  async addToCart(
    uid: string, 
    _product: Product, 
    restaurant: Restaurant,
    item: Omit<CartItem, 'cartItemId' | 'lineTotal'>
  ): Promise<void> {
    try {
      let currentCart = await this.getCart(uid);
      
      // If adding from a different restaurant, clear previous
      if (currentCart && currentCart.restaurantId !== restaurant.restaurantId) {
        currentCart = null;
      }

      const unitPrice = computeUnitPrice(item);
      const lineTotal = item.quantity * unitPrice;
      const newItems = currentCart ? [...currentCart.items] : [];

      // Check if an identical item with same variant and add-ons already exists
      const addonsSignature = JSON.stringify(
        (item.selectedAddOns || []).map(a => `${a.groupName}:${a.option.name}`).sort()
      );
      const existingIndex = newItems.findIndex(existing => {
        const existingAddonsSig = JSON.stringify(
          (existing.selectedAddOns || []).map(a => `${a.groupName}:${a.option.name}`).sort()
        );
        return (
          existing.productId === item.productId &&
          (existing.variant?.name || '') === (item.variant?.name || '') &&
          existingAddonsSig === addonsSignature
        );
      });

      if (existingIndex > -1) {
        const existingItem = newItems[existingIndex];
        const updatedQty = existingItem.quantity + item.quantity;
        newItems[existingIndex] = {
          ...existingItem,
          quantity: updatedQty,
          lineTotal: updatedQty * unitPrice,
        };
      } else {
        const cartItemId = uuidv4();
        newItems.push({ ...item, cartItemId, lineTotal });
      }

      const subtotal = newItems.reduce((acc, i) => acc + Number(i.lineTotal || 0), 0);
      const deliveryCharge = Number(restaurant.baseDeliveryCharge ?? 30);
      const total = subtotal + deliveryCharge;

      const cartData: Cart = {
        cartId: uid,
        customerId: uid,
        restaurantId: restaurant.restaurantId,
        restaurantName: restaurant.restaurantName,
        restaurantImage: restaurant.logoPath || '',
        items: newItems,
        subtotal,
        deliveryCharge,
        total,
        updatedAt: serverTimestamp()
      };

      await setDoc(doc(db, 'carts', uid), cartData);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `carts/${uid}`);
    }
  },

  // Update item quantity (+1 or -1)
  async updateItemQuantity(uid: string, cartItemId: string, delta: number): Promise<void> {
    try {
      const cart = await this.getCart(uid);
      if (!cart) return;

      const itemIndex = cart.items.findIndex(i => i.cartItemId === cartItemId);
      if (itemIndex === -1) return;

      const targetItem = cart.items[itemIndex];
      const newQuantity = targetItem.quantity + delta;

      if (newQuantity <= 0) {
        await this.removeFromCart(uid, cartItemId);
        return;
      }

      const unitPrice = computeUnitPrice(targetItem);
      const updatedItems = [...cart.items];
      updatedItems[itemIndex] = {
        ...targetItem,
        quantity: newQuantity,
        lineTotal: newQuantity * unitPrice,
      };

      const subtotal = updatedItems.reduce((acc, i) => acc + Number(i.lineTotal || 0), 0);
      const total = subtotal + Number(cart.deliveryCharge || 0);

      await setDoc(doc(db, 'carts', uid), {
        ...cart,
        items: updatedItems,
        subtotal,
        total,
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `carts/${uid}`);
    }
  },

  // Remove item or clear cart
  async removeFromCart(uid: string, cartItemId: string): Promise<void> {
    try {
      const cart = await this.getCart(uid);
      if (!cart) return;

      const filteredItems = (cart.items || []).filter(i => i.cartItemId !== cartItemId);
      
      if (filteredItems.length === 0) {
        await setDoc(doc(db, 'carts', uid), {
          ...cart,
          items: [],
          subtotal: 0,
          total: 0,
          updatedAt: serverTimestamp()
        });
        return;
      }

      const subtotal = filteredItems.reduce((acc, i) => acc + Number(i.lineTotal || 0), 0);
      const total = subtotal + Number(cart.deliveryCharge || 0);

      await setDoc(doc(db, 'carts', uid), {
        ...cart,
        items: filteredItems,
        subtotal,
        total,
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `carts/${uid}`);
    }
  },

  async clearCart(uid: string): Promise<void> {
    try {
      await setDoc(
        doc(db, 'carts', uid),
        {
          cartId: uid,
          customerId: uid,
          items: [],
          subtotal: 0,
          deliveryCharge: 0,
          total: 0,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `carts/${uid}`);
    }
  }
};

