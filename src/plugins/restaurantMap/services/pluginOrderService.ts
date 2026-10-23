import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  query,
  where,
  onSnapshot,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../../../firebase/config';
import { PluginOrder, PluginCartItem, PluginOrderStatus } from '../models/types';
import { v4 as uuidv4 } from 'uuid';

const ORDERS_COL = collection(db, 'plugin_map_orders');
const MENUS_COL = collection(db, 'plugin_map_menus');

export const pluginOrderService = {
  // Create Plugin Order with price validation
  async createOrder(params: {
    customerId: string;
    customerName: string;
    customerPhone: string;
    deliveryAddress: string;
    deliveryNote?: string;
    customerLat?: number;
    customerLng?: number;
    restaurantId: string;
    restaurantName: string;
    restaurantPhone?: string;
    sellerId: string;
    items: PluginCartItem[];
    deliveryFee: number;
    deliveryType?: 'restaurant_delivery' | 'map_partner_delivery';
    deliveryPartnerId?: string;
    deliveryPartnerName?: string;
    deliveryPartnerPhone?: string;
    roundTripDistanceKm?: number;
  }): Promise<PluginOrder> {
    const orderId = uuidv4();
    const orderNumber = `MAP-${Math.floor(100000 + Math.random() * 900000)}`;

    // Validate item prices and availability from Firestore menu
    const validatedItems: PluginCartItem[] = [];
    let itemSubtotal = 0;

    for (const item of params.items) {
      const menuDoc = await getDoc(doc(MENUS_COL, item.itemId));
      if (menuDoc.exists()) {
        const menuData = menuDoc.data();
        const validPrice = Number(menuData.price || item.price);
        const qty = Math.max(1, Number(item.quantity || 1));
        validatedItems.push({
          itemId: item.itemId,
          name: menuData.name || item.name,
          price: validPrice,
          quantity: qty,
          foodType: menuData.foodType || item.foodType || 'veg',
          imageUrl: menuData.imageUrl || item.imageUrl || '',
        });
        itemSubtotal += validPrice * qty;
      } else {
        // Fallback to client item if doc missing
        const qty = Math.max(1, Number(item.quantity || 1));
        validatedItems.push({ ...item, quantity: qty });
        itemSubtotal += Number(item.price) * qty;
      }
    }

    const totalAmount = Math.round((itemSubtotal + params.deliveryFee) * 100) / 100;
    const nowIso = new Date().toISOString();

    const rawOrderPayload: Record<string, any> = {
      orderId,
      orderNumber,
      customerId: params.customerId,
      customerName: params.customerName || 'Customer',
      customerPhone: params.customerPhone || '',
      deliveryAddress: params.deliveryAddress || 'Address not provided',
      deliveryNote: params.deliveryNote || '',
      ...(params.customerLat !== undefined ? { customerLat: params.customerLat } : {}),
      ...(params.customerLng !== undefined ? { customerLng: params.customerLng } : {}),
      restaurantId: params.restaurantId,
      restaurantName: params.restaurantName,
      restaurantPhone: params.restaurantPhone || '',
      sellerId: params.sellerId || '',
      items: validatedItems,
      itemSubtotal,
      deliveryFee: params.deliveryFee,
      totalAmount,
      paymentMethod: 'COD',
      orderStatus: 'pending',
      deliveryType: params.deliveryType || 'restaurant_delivery',
      ...(params.deliveryPartnerId ? { deliveryPartnerId: params.deliveryPartnerId } : {}),
      ...(params.deliveryPartnerName ? { deliveryPartnerName: params.deliveryPartnerName } : {}),
      ...(params.deliveryPartnerPhone ? { deliveryPartnerPhone: params.deliveryPartnerPhone } : {}),
      ...(params.roundTripDistanceKm !== undefined ? { roundTripDistanceKm: params.roundTripDistanceKm } : {}),
      statusHistory: [
        {
          status: 'pending',
          timestamp: nowIso,
          note: 'Order placed via Food India Restaurant Map',
        },
      ],
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    // Strip any remaining undefined keys
    const sanitizedOrder: any = {};
    Object.keys(rawOrderPayload).forEach((k) => {
      if (rawOrderPayload[k] !== undefined) {
        sanitizedOrder[k] = rawOrderPayload[k];
      }
    });

    await setDoc(doc(ORDERS_COL, orderId), sanitizedOrder);
    return { ...sanitizedOrder, orderId } as PluginOrder;
  },

  // Subscribe to live orders for a specific seller or all orders for delivery partner
  subscribeSellerOrders(sellerId: string, restaurantId: string = '', callback: (orders: PluginOrder[]) => void = () => {}) {
    return onSnapshot(
      ORDERS_COL,
      (snap) => {
        const all = snap.docs.map((d) => ({ ...d.data(), orderId: d.id } as PluginOrder));
        const filtered =
          sellerId === 'all' || restaurantId === 'all'
            ? all
            : all.filter((o) => o.sellerId === sellerId || o.restaurantId === restaurantId);

        filtered.sort((a, b) => {
          const ta = a.createdAt?.seconds ? a.createdAt.seconds * 1000 : 0;
          const tb = b.createdAt?.seconds ? b.createdAt.seconds * 1000 : 0;
          return tb - ta;
        });
        callback(filtered);
      },
      (err) => {
        console.warn('Error subscribing to plugin_map_orders for seller:', err);
        callback([]);
      }
    );
  },

  // Subscribe to live order status for a customer
  subscribeCustomerOrder(orderId: string, callback: (order: PluginOrder | null) => void) {
    return onSnapshot(
      doc(ORDERS_COL, orderId),
      (snap) => {
        if (snap.exists()) {
          callback({ ...snap.data(), orderId: snap.id } as PluginOrder);
        } else {
          callback(null);
        }
      },
      (err) => {
        console.warn('Error subscribing to plugin_map_orders for customer:', err);
        callback(null);
      }
    );
  },

  // Subscribe to all customer orders
  subscribeCustomerOrders(customerId: string, callback: (orders: PluginOrder[]) => void) {
    const q = query(ORDERS_COL, where('customerId', '==', customerId));
    return onSnapshot(
      q,
      (snap) => {
        const list = snap.docs.map((d) => ({ ...d.data(), orderId: d.id } as PluginOrder));
        list.sort((a, b) => {
          const ta = a.createdAt?.seconds ? a.createdAt.seconds * 1000 : 0;
          const tb = b.createdAt?.seconds ? b.createdAt.seconds * 1000 : 0;
          return tb - ta;
        });
        callback(list);
      },
      (err) => {
        console.warn('Error subscribing to customer orders:', err);
        callback([]);
      }
    );
  },

  // Update order status (Seller Accept / Reject / Preparing / Delivering / Delivered)
  async updateOrderStatus(
    orderId: string,
    status: PluginOrderStatus,
    rejectionReason?: string
  ): Promise<void> {
    const orderDoc = await getDoc(doc(ORDERS_COL, orderId));
    if (!orderDoc.exists()) return;

    const currentData = orderDoc.data() as PluginOrder;
    const history = currentData.statusHistory || [];
    history.push({
      status,
      timestamp: new Date().toISOString(),
      note: rejectionReason ? `Rejection reason: ${rejectionReason}` : `Status updated to ${status}`,
    });

    await updateDoc(doc(ORDERS_COL, orderId), {
      orderStatus: status,
      ...(rejectionReason ? { rejectionReason } : {}),
      statusHistory: history,
      updatedAt: serverTimestamp(),
    });
  },
};
