/**
 * Utilities to guarantee customer order permanence, persistent tracking across sessions,
 * and real-time syncing between Seller status updates, Customer Orders Window, and Notifications.
 */

const CUSTOMER_ORDER_IDS_KEY = 'food_india_customer_order_ids';
const CUSTOMER_DEVICE_ID_KEY = 'food_india_customer_device_id';
const CUSTOMER_SAVED_PHONE_KEY = 'food_india_customer_phone';

export function getOrCreateCustomerDeviceId(): string {
  try {
    let devId = localStorage.getItem(CUSTOMER_DEVICE_ID_KEY);
    if (!devId) {
      devId = `cust_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
      localStorage.setItem(CUSTOMER_DEVICE_ID_KEY, devId);
    }
    return devId;
  } catch {
    return 'cust_default_client';
  }
}

export function getSavedCustomerOrderIds(): string[] {
  try {
    const raw = localStorage.getItem(CUSTOMER_ORDER_IDS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function savePlacedOrderId(orderId: string, phone?: string): void {
  if (!orderId) return;
  try {
    const existing = getSavedCustomerOrderIds();
    if (!existing.includes(orderId)) {
      const updated = [orderId, ...existing].slice(0, 50);
      localStorage.setItem(CUSTOMER_ORDER_IDS_KEY, JSON.stringify(updated));
    }
    if (phone) {
      localStorage.setItem(CUSTOMER_SAVED_PHONE_KEY, phone.trim());
    }
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('food_india_orders_updated', { detail: { orderId } }));
    }
  } catch {
    // Ignore storage quota errors
  }
}

export function getSavedCustomerPhone(): string {
  try {
    return localStorage.getItem(CUSTOMER_SAVED_PHONE_KEY) || '';
  } catch {
    return '';
  }
}
