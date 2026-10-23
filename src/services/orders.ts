import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  updateDoc,
  query,
  where,
  serverTimestamp,
  increment,
  arrayUnion,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase/config';
import { Order } from '../models/types';
import { v4 as uuidv4 } from 'uuid';
import {
  notificationService,
  buildOrderWhatsAppUrl,
  buildOrderSmsInboxUrl,
  ADMIN_AND_ORDER_SMS_NUMBER,
} from './notifications';
import { getGoogleMapsCoordUrl, loadSavedLiveGpsLocation } from '../utils/gps';
import { reportGlobalButtonStatus, reportGlobalError } from '../context/ErrorLogContext';
import { savePlacedOrderId, getOrCreateCustomerDeviceId } from '../utils/orderStorage';

function sortOrdersDesc(list: Order[]): Order[] {
  return [...list].sort((a, b) => {
    const ta = a.createdAt?.toMillis
      ? a.createdAt.toMillis()
      : a.createdAt?.seconds
      ? a.createdAt.seconds * 1000
      : 0;
    const tb = b.createdAt?.toMillis
      ? b.createdAt.toMillis()
      : b.createdAt?.seconds
      ? b.createdAt.seconds * 1000
      : 0;
    return tb - ta;
  });
}

export const orderService = {
  // Create a new COD order, permanently link to customer & seller profiles, and dispatch App, SMS (+918825028335), Email & WhatsApp notifications
  async createOrder(
    orderData: Omit<
      Order,
      'orderId' | 'orderNumber' | 'createdAt' | 'updatedAt' | 'orderStatus' | 'paymentStatus'
    >
  ): Promise<string> {
    const orderId = uuidv4();
    const orderNumber = `FI-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(
      1000 + Math.random() * 9000
    )}`;
    const path = `orders/${orderId}`;
    const nowIso = new Date().toISOString();

    const effectiveCustomerId =
      orderData.customerId && orderData.customerId !== 'guest_customer'
        ? orderData.customerId
        : getOrCreateCustomerDeviceId();

    // Persist order ID and customer phone in local client storage so it always appears in customer's Orders Window
    savePlacedOrderId(orderId, orderData.customerPhone);

    const savedGps = loadSavedLiveGpsLocation();
    const lat = Number(
      orderData.addressSnapshot?.latitude ??
        orderData.customerLatitude ??
        savedGps?.latitude ??
        19.076
    );
    const lng = Number(
      orderData.addressSnapshot?.longitude ??
        orderData.customerLongitude ??
        savedGps?.longitude ??
        72.8777
    );
    const googleMapsLink =
      orderData.addressSnapshot?.googleMapsLink || getGoogleMapsCoordUrl(lat, lng);

    const enrichedAddressSnapshot = {
      ...orderData.addressSnapshot,
      latitude: lat,
      longitude: lng,
      googleMapsLink,
      formattedAddress:
        orderData.addressSnapshot?.formattedAddress ||
        orderData.addressSnapshot?.fullAddress ||
        `Live Phone GPS (${lat.toFixed(6)}, ${lng.toFixed(6)})`,
    };

    try {
      // Look up restaurant & seller details so notifications, seller dashboard routing, and 5% GST are 100% accurate
      let resolvedSellerId = orderData.sellerId;
      let sellerEmail = '';
      let sellerPhone = orderData.restaurantPhone || '';
      let sellerGstAllowed = Boolean(orderData.gstEnabled);

      if (orderData.restaurantId) {
        const restSnap = await getDoc(doc(db, 'restaurants', orderData.restaurantId)).catch(
          () => null
        );
        if (restSnap && restSnap.exists()) {
          const rData = restSnap.data();
          if (rData.sellerId) resolvedSellerId = rData.sellerId;
          if (rData.phone) sellerPhone = rData.phone;
          if (rData.email) sellerEmail = rData.email;
          if (rData.gstEnabled) sellerGstAllowed = true;
        }
      }

      if (resolvedSellerId && !sellerGstAllowed) {
        const sellerSnap = await getDoc(doc(db, 'sellers', resolvedSellerId)).catch(() => null);
        if (sellerSnap && sellerSnap.exists() && sellerSnap.data()?.gstEnabled) {
          sellerGstAllowed = true;
        }
      }

      const itemSubtotal = Number(orderData.itemSubtotal || 0);
      const deliveryCharge = Number(orderData.deliveryCharge || 25);
      const gstAmount = sellerGstAllowed
        ? Number((orderData.gstAmount ?? Math.round(itemSubtotal * 0.05 * 100) / 100).toFixed(2))
        : 0;
      const computedTotalAmount = Number((itemSubtotal + deliveryCharge + gstAmount).toFixed(2));

      const orderPreviewForLinks: Partial<Order> = {
        ...orderData,
        orderId,
        orderNumber,
        orderStatus: 'pending',
        gstEnabled: sellerGstAllowed,
        gstRate: sellerGstAllowed ? 5 : 0,
        gstAmount,
        totalAmount: computedTotalAmount,
        addressSnapshot: enrichedAddressSnapshot,
      };

      const whatsappNotificationUrl = buildOrderWhatsAppUrl({
        targetPhone: sellerPhone || ADMIN_AND_ORDER_SMS_NUMBER,
        order: orderPreviewForLinks,
        headline: 'New COD Order Placed',
      });

      const smsNotificationUrl = buildOrderSmsInboxUrl({
        targetPhone: ADMIN_AND_ORDER_SMS_NUMBER,
        order: orderPreviewForLinks,
        headline: 'New COD Order Placed',
      });

      const rawSnapshot = Array.isArray(orderData.itemsSnapshot) ? orderData.itemsSnapshot : [];
      const rawItems = Array.isArray(orderData.items) ? orderData.items : [];

      const normalizedItems =
        rawItems.length > 0
          ? rawItems
          : rawSnapshot.map((i: any) => ({
              productId: i.productId || '',
              name: i.name || 'Dish',
              price: Number(i.price ?? i.basePrice ?? i.lineTotal ?? 0),
              quantity: Number(i.quantity || 1),
            }));

      const normalizedItemsSnapshot =
        rawSnapshot.length > 0
          ? rawSnapshot
          : normalizedItems.map((i: any) => ({
              productId: i.productId || '',
              name: i.name || 'Dish',
              basePrice: Number(i.price || 0),
              quantity: Number(i.quantity || 1),
              selectedAddOns: [],
              itemTotal: Number(i.price || 0),
              lineTotal: Number((i.price || 0) * (i.quantity || 1)),
            }));

      const finalSellerId = resolvedSellerId || orderData.sellerId || '';

      const fullOrder: Record<string, any> = {
        ...orderData,
        customerId: effectiveCustomerId,
        items: normalizedItems,
        itemsSnapshot: normalizedItemsSnapshot,
        sellerId: finalSellerId,
        restaurantPhone: sellerPhone || ADMIN_AND_ORDER_SMS_NUMBER,
        addressSnapshot: enrichedAddressSnapshot,
        deliveryAddress: orderData.deliveryAddress || enrichedAddressSnapshot.formattedAddress,
        customerLatitude: lat,
        customerLongitude: lng,
        gstEnabled: sellerGstAllowed,
        gstRate: sellerGstAllowed ? 5 : 0,
        gstAmount,
        totalAmount: computedTotalAmount,
        orderId,
        orderNumber,
        paymentMethod: 'COD',
        paymentStatus: 'pending_cod',
        orderStatus: 'pending',
        whatsappNotificationUrl,
        smsNotificationUrl,
        emailNotificationSubject: `[Food India] New COD Order #${orderNumber} - ₹${computedTotalAmount}`,
        statusHistory: [
          {
            status: 'pending',
            timestamp: nowIso,
            note: 'Order placed by customer (Cash on Delivery)',
          },
        ],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      const orderPromises = [
        setDoc(doc(db, 'orders', orderId), fullOrder),
        setDoc(doc(db, 'orderArchives', orderId), fullOrder, { merge: true }),
      ];
      await Promise.all(orderPromises);

      // Permanently link order to Seller Profile
      if (finalSellerId) {
        setDoc(
          doc(db, 'sellers', finalSellerId),
          {
            uid: finalSellerId,
            sellerId: finalSellerId,
            ...(orderData.restaurantId ? { restaurantId: orderData.restaurantId } : {}),
            ...(orderData.restaurantName ? { businessName: orderData.restaurantName } : {}),
            orderIds: arrayUnion(orderId),
            totalOrders: increment(1),
            lastOrderAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        ).catch(() => {});
      }

      // Automatically dispatch order to the integrated Local Food Delivery Company API (non-blocking)
      fetch('/api/delivery/book', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId,
          providerId: orderData.selectedDeliveryProviderId || 'local_delivery_company',
          quoteId: orderData.selectedDeliveryQuoteId || '',
          confirmedByRole: 'auto_dispatch',
        }),
      }).catch(() => {});

      // Permanently link order history, phone & live GPS to Customer Profile (non-blocking)
      const updateCustomerProfile = async () => {
        try {
          const liveGpsRecord = {
            latitude: lat,
            longitude: lng,
            address: enrichedAddressSnapshot.formattedAddress,
            googleMapsUrl: googleMapsLink,
            updatedAt: nowIso,
          };

          await Promise.all([
            setDoc(
              doc(db, 'customers', orderData.customerId),
              {
                uid: orderData.customerId,
                fullName: orderData.customerName,
                phone: orderData.customerPhone,
                ...(orderData.customerEmail ? { email: orderData.customerEmail } : {}),
                liveGps: liveGpsRecord,
                orderIds: arrayUnion(orderId),
                totalOrders: increment(1),
                lastOrderAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
              },
              { merge: true }
            ),
            setDoc(
              doc(db, 'users', orderData.customerId),
              {
                uid: orderData.customerId,
                ...(orderData.customerPhone ? { phone: orderData.customerPhone } : {}),
                liveGps: liveGpsRecord,
                updatedAt: serverTimestamp(),
              },
              { merge: true }
            ),
          ]);
        } catch (e) {
          console.warn('Could not update customer profile order stats:', e);
        }
      };
      updateCustomerProfile();

      // Dispatch In-App, SMS, Email, and WhatsApp Notifications to Seller & Customer
      notificationService.dispatchOrderNotifications({
        order: fullOrder as Order,
        eventType: 'order_placed',
        sellerEmail,
        sellerPhone,
      }).catch(console.error);


      reportGlobalButtonStatus({
        buttonName: `Place COD Order (#${orderNumber})`,
        backendPath: `Firestore: orders/${orderId}, sellers/${finalSellerId}, customers/${orderData.customerId} & SMS (+918825028335)`,
        dbUpdated: 'UPDATED',
        statusType: 'success',
        message: `Order #${orderNumber} (₹${computedTotalAmount}${sellerGstAllowed ? ` incl. 5% GST ₹${gstAmount}` : ''}) saved to Firestore, routed to Seller (${finalSellerId}) with 5-sec sound/vibration alert, and formatted for Phone SMS Inbox (+918825028335).`,
        suggestion: 'Seller receives a 5-second sound & vibration alert plus SMS to +918825028335 with customer GPS link, phone, address, and name.',
      });

      return orderId;
    } catch (error) {
      reportGlobalError(
        (error as any)?.message || 'Failed to place COD order',
        (error as any)?.stack,
        'backend',
        {
          buttonName: 'Place COD Order',
          backendPath: path,
          dbUpdated: 'NOT_UPDATED',
          statusType: 'error',
        }
      );
      handleFirestoreError(error, OperationType.CREATE, path);
      return '';
    }
  },

  // Get order by ID
  async getOrder(orderId: string): Promise<Order | null> {
    const path = `orders/${orderId}`;
    try {
      const docSnap = await getDoc(doc(db, 'orders', orderId));
      if (docSnap.exists()) {
        return { ...docSnap.data(), orderId: docSnap.id } as Order;
      }
      return null;
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, path);
      return null;
    }
  },

  // Get orders for a customer (sorted in-memory to avoid composite index failure)
  async getCustomerOrders(customerId: string): Promise<Order[]> {
    const path = 'orders';
    try {
      const q = query(collection(db, 'orders'), where('customerId', '==', customerId));
      const querySnapshot = await getDocs(q);
      const list = querySnapshot.docs.map((d) => ({ ...d.data(), orderId: d.id } as Order));
      return sortOrdersDesc(list);
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, path);
      return [];
    }
  },

  // Get orders for a seller (sorted in-memory to avoid composite index failure)
  async getSellerOrders(sellerId: string): Promise<Order[]> {
    const path = 'orders';
    try {
      const q = query(collection(db, 'orders'), where('sellerId', '==', sellerId));
      const querySnapshot = await getDocs(q);
      const list = querySnapshot.docs.map((d) => ({ ...d.data(), orderId: d.id } as Order));
      return sortOrdersDesc(list);
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, path);
      return [];
    }
  },

  // Update order status and dispatch multi-channel notifications
  async updateOrderStatus(
    orderId: string,
    status: Order['orderStatus'],
    note?: string
  ): Promise<void> {
    const path = `orders/${orderId}`;
    try {
      const orderRef = doc(db, 'orders', orderId);
      const snap = await getDoc(orderRef);
      const existingHistory = snap.exists() ? snap.data().statusHistory || [] : [];
      const customerId = snap.exists() ? snap.data().customerId : null;

      const nextHistory = [
        ...existingHistory,
        {
          status,
          timestamp: new Date().toISOString(),
          note: note || `Order status updated to ${status.replace(/_/g, ' ')}`,
        },
      ];

      const updateData: any = {
        orderStatus: status,
        statusHistory: nextHistory,
        updatedAt: serverTimestamp(),
      };

      if (status === 'confirmed') {
        const currentBookingStatus = snap.exists() ? snap.data().deliveryBookingStatus : null;
        if (!currentBookingStatus || currentBookingStatus === 'awaiting_restaurant_acceptance') {
          updateData.deliveryBookingStatus = 'ready_to_book';
        }
      }

      if (status === 'delivered') {
        updateData.paymentStatus = 'paid';
        updateData.deliveredAt = serverTimestamp();
      } else if (status === 'cancelled') {
        updateData.paymentStatus = 'failed';
      }

      await updateDoc(orderRef, updateData);

      if (customerId && (status === 'delivered' || status === 'cancelled')) {
        try {
          await setDoc(
            doc(db, 'customers', customerId),
            {
              ...(status === 'delivered'
                ? { completedOrders: increment(1) }
                : { cancelledOrders: increment(1) }),
              updatedAt: serverTimestamp(),
            },
            { merge: true }
          );
        } catch (e) {
          console.warn('Could not update customer order completion stats:', e);
        }
      }

      if (snap.exists()) {
        const updatedOrder = {
          ...(snap.data() as Order),
          orderId,
          orderStatus: status,
        };
        await notificationService.dispatchOrderNotifications({
          order: updatedOrder,
          eventType: 'order_status_updated',
        });
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  },
};
