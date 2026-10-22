import { collection, doc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase/config';
import { Order } from '../models/types';
import { getGoogleMapsCoordUrl } from '../utils/gps';
import { reportGlobalButtonStatus } from '../context/ErrorLogContext';

export const ADMIN_AND_ORDER_SMS_NUMBER = '+918825028335';

export function normalizeIndianWhatsAppNumber(phone?: string): string {
  const digits = (phone || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.length === 10) return `91${digits}`;
  if (digits.length > 10 && digits.startsWith('0')) return `91${digits.slice(1)}`;
  return digits;
}

export function buildOrderSmsInboxUrl(
  paramsOrOrder:
    | {
        targetPhone?: string;
        order: Partial<Order>;
        headline?: string;
      }
    | Partial<Order>,
  targetPhoneArg?: string,
  headlineArg?: string
): string {
  const isWrapped =
    paramsOrOrder &&
    typeof paramsOrOrder === 'object' &&
    'order' in paramsOrOrder &&
    (paramsOrOrder as any).order;

  const order: Partial<Order> = isWrapped
    ? (paramsOrOrder as any).order
    : (paramsOrOrder as Partial<Order>) || {};
  const targetPhone: string = isWrapped
    ? (paramsOrOrder as any).targetPhone || ADMIN_AND_ORDER_SMS_NUMBER
    : targetPhoneArg === 'customer'
    ? order.customerPhone || ADMIN_AND_ORDER_SMS_NUMBER
    : targetPhoneArg === 'seller'
    ? order.restaurantPhone || ADMIN_AND_ORDER_SMS_NUMBER
    : targetPhoneArg || ADMIN_AND_ORDER_SMS_NUMBER;
  const headline: string | undefined = isWrapped
    ? (paramsOrOrder as any).headline
    : headlineArg;

  const lat = order.addressSnapshot?.latitude ?? order.customerLatitude;
  const lng = order.addressSnapshot?.longitude ?? order.customerLongitude;
  const mapsUrl =
    typeof lat === 'number' && typeof lng === 'number'
      ? getGoogleMapsCoordUrl(lat, lng)
      : order.addressSnapshot?.googleMapsLink || '';

  const itemsList = Array.isArray(order.itemsSnapshot)
    ? order.itemsSnapshot
    : Array.isArray(order.items)
    ? order.items
    : [];

  const itemsText = itemsList
    .map((item: any) => `${item.quantity || 1}x ${item.name} (Rs.${item.lineTotal || item.price || 0})`)
    .join(', ');

  const gstLine =
    order.gstEnabled && Number(order.gstAmount || 0) > 0
      ? `GST (5%): Rs.${Number(order.gstAmount).toFixed(2)}`
      : '';

  const smsLines = [
    `[Food India] ${headline || 'New COD Order Placed'}`,
    `Order #: ${order.orderNumber || order.orderId || ''}`,
    `Restaurant: ${order.restaurantName || 'Food India Kitchen'}`,
    `Customer Name: ${order.customerName || 'Customer'}`,
    `Customer Phone: ${order.customerPhone || 'N/A'}`,
    `Address: ${order.addressSnapshot?.formattedAddress || order.deliveryAddress || 'Live GPS'}`,
    mapsUrl ? `Google Maps Link: ${mapsUrl}` : '',
    itemsText ? `Items: ${itemsText}` : '',
    gstLine,
    `Total COD: Rs.${order.totalAmount || 0}`,
  ]
    .filter(Boolean)
    .join('\n');

  const cleanRecipient = targetPhone.startsWith('+')
    ? targetPhone
    : `+${normalizeIndianWhatsAppNumber(targetPhone) || '918825028335'}`;

  return `sms:${cleanRecipient}?body=${encodeURIComponent(smsLines)}`;
}

export function buildOrderWhatsAppUrl(
  paramsOrOrder:
    | {
        targetPhone?: string;
        order: Partial<Order>;
        headline?: string;
      }
    | Partial<Order>,
  roleOrPhone?: 'customer' | 'seller' | string,
  headlineArg?: string
): string {
  const isWrapped =
    paramsOrOrder &&
    typeof paramsOrOrder === 'object' &&
    'order' in paramsOrOrder &&
    (paramsOrOrder as any).order;

  const order: Partial<Order> = isWrapped
    ? (paramsOrOrder as any).order
    : (paramsOrOrder as Partial<Order>) || {};
  const targetPhone: string | undefined = isWrapped
    ? (paramsOrOrder as any).targetPhone
    : roleOrPhone === 'customer'
    ? order.customerPhone
    : roleOrPhone === 'seller'
    ? order.restaurantPhone || ADMIN_AND_ORDER_SMS_NUMBER
    : roleOrPhone;
  const headline: string | undefined = isWrapped
    ? (paramsOrOrder as any).headline
    : headlineArg;

  const cleanPhone = normalizeIndianWhatsAppNumber(targetPhone);
  const lat = order.addressSnapshot?.latitude ?? order.customerLatitude;
  const lng = order.addressSnapshot?.longitude ?? order.customerLongitude;
  const mapsUrl =
    typeof lat === 'number' && typeof lng === 'number'
      ? getGoogleMapsCoordUrl(lat, lng)
      : order.addressSnapshot?.googleMapsLink || '';

  const itemsList = Array.isArray(order.itemsSnapshot)
    ? order.itemsSnapshot
    : Array.isArray(order.items)
    ? order.items
    : [];

  const itemsText = itemsList
    .map((item: any) => {
      const addons =
        item.selectedAddOns && item.selectedAddOns.length > 0
          ? ` [Add-ons: ${item.selectedAddOns.map((a: any) => a.option?.name || '').filter(Boolean).join(', ')}]`
          : '';
      const variant = item.variant ? ` (${item.variant.name})` : '';
      return `• ${item.quantity || 1}x ${item.name}${variant}${addons} - ₹${item.lineTotal ?? item.price ?? 0}`;
    })
    .join('\n');

  const gstLine =
    order.gstEnabled && Number(order.gstAmount || 0) > 0
      ? `GST (5%): *₹${Number(order.gstAmount).toFixed(2)}*`
      : '';

  const lines = [
    `🇮🇳 *Food India - ${headline || 'Order Notification'}*`,
    `Order #: *${order.orderNumber || order.orderId}*`,
    `Restaurant: *${order.restaurantName || 'Food India Kitchen'}*`,
    `Status: *${(order.orderStatus || 'pending').replace(/_/g, ' ').toUpperCase()}*`,
    `Customer: *${order.customerName || 'Customer'}* (${order.customerPhone || 'N/A'})`,
    gstLine,
    `Payment: *COD ₹${order.totalAmount || 0}*`,
    itemsText ? `\n*Items & Add-ons:*\n${itemsText}` : '',
    order.addressSnapshot?.formattedAddress
      ? `\n*Delivery Address:* ${order.addressSnapshot.formattedAddress}`
      : '',
    typeof lat === 'number' && typeof lng === 'number'
      ? `*Live GPS Coords:* ${lat.toFixed(6)}, ${lng.toFixed(6)}`
      : '',
    mapsUrl ? `*Google Maps Live Pin:* ${mapsUrl}` : '',
  ]
    .filter(Boolean)
    .join('\n');

  const encoded = encodeURIComponent(lines);
  return cleanPhone
    ? `https://wa.me/${cleanPhone}?text=${encoded}`
    : `https://wa.me/?text=${encoded}`;
}

export function buildOrderMailtoUrl(
  paramsOrOrder:
    | {
        targetEmail?: string;
        order: Partial<Order>;
        headline?: string;
      }
    | Partial<Order>,
  targetEmailArg?: string,
  headlineArg?: string
): string {
  const isWrapped =
    paramsOrOrder &&
    typeof paramsOrOrder === 'object' &&
    'order' in paramsOrOrder &&
    (paramsOrOrder as any).order;

  const order: Partial<Order> = isWrapped
    ? (paramsOrOrder as any).order
    : (paramsOrOrder as Partial<Order>) || {};
  const targetEmail: string | undefined = isWrapped
    ? (paramsOrOrder as any).targetEmail
    : targetEmailArg === 'customer'
    ? order.customerEmail
    : targetEmailArg;
  const headline: string | undefined = isWrapped
    ? (paramsOrOrder as any).headline
    : headlineArg;

  const lat = order.addressSnapshot?.latitude ?? order.customerLatitude;
  const lng = order.addressSnapshot?.longitude ?? order.customerLongitude;
  const mapsUrl =
    typeof lat === 'number' && typeof lng === 'number'
      ? getGoogleMapsCoordUrl(lat, lng)
      : order.addressSnapshot?.googleMapsLink || '';

  const subject = encodeURIComponent(
    `[Food India] ${headline || 'Order Update'} - #${order.orderNumber || order.orderId}`
  );
  const itemsList = Array.isArray(order.itemsSnapshot)
    ? order.itemsSnapshot
    : Array.isArray(order.items)
    ? order.items
    : [];
  const itemsText = itemsList
    .map((i: any) => `- ${i.quantity || 1}x ${i.name} (INR ${i.lineTotal ?? i.price ?? 0})`)
    .join('\n');

  const gstLine =
    order.gstEnabled && Number(order.gstAmount || 0) > 0
      ? `GST (5%): INR ${Number(order.gstAmount).toFixed(2)}`
      : '';

  const body = encodeURIComponent(
    [
      `Food India - ${headline || 'Order Notification'}`,
      `Order Number: ${order.orderNumber || order.orderId}`,
      `Restaurant: ${order.restaurantName || 'Food India Kitchen'}`,
      `Order Status: ${(order.orderStatus || 'pending').toUpperCase()}`,
      `Customer Name: ${order.customerName || 'Customer'}`,
      `Customer Cell Number: ${order.customerPhone || 'N/A'}`,
      gstLine,
      `Total COD Amount: INR ${order.totalAmount || 0}`,
      '',
      'Items:',
      itemsText,
      '',
      `Delivery Address: ${order.addressSnapshot?.formattedAddress || 'N/A'}`,
      typeof lat === 'number' && typeof lng === 'number'
        ? `Live GPS Coordinates: ${lat.toFixed(6)}, ${lng.toFixed(6)}`
        : '',
      mapsUrl ? `Google Maps Link: ${mapsUrl}` : '',
    ]
      .filter(Boolean)
      .join('\n')
  );

  return `mailto:${encodeURIComponent(targetEmail || '')}?subject=${subject}&body=${body}`;
}

export const notificationService = {
  buildOrderWhatsAppUrl,
  buildOrderSmsInboxUrl,
  buildOrderMailtoUrl,
  async dispatchOrderNotifications(params: {
    order: Order;
    eventType: 'order_placed' | 'order_status_updated';
    sellerEmail?: string;
    sellerPhone?: string;
  }): Promise<{
    sellerWhatsAppUrl: string;
    customerWhatsAppUrl: string;
    sellerMailtoUrl: string;
    customerMailtoUrl: string;
    smsInboxUrl: string;
  }> {
    const { order, eventType, sellerEmail, sellerPhone } = params;
    const isNew = eventType === 'order_placed';
    const headline = isNew
      ? `New COD Order #${order.orderNumber} (₹${order.totalAmount})`
      : `Order #${order.orderNumber} is ${order.orderStatus.replace(/_/g, ' ').toUpperCase()}`;

    const smsInboxUrl = buildOrderSmsInboxUrl({
      targetPhone: ADMIN_AND_ORDER_SMS_NUMBER,
      order,
      headline: isNew ? 'New COD Order Placed' : headline,
    });

    const sellerWhatsAppUrl = buildOrderWhatsAppUrl({
      targetPhone: sellerPhone || order.restaurantPhone || ADMIN_AND_ORDER_SMS_NUMBER,
      order,
      headline: isNew ? 'New Customer Order Received' : headline,
    });

    const customerWhatsAppUrl = buildOrderWhatsAppUrl({
      targetPhone: order.customerPhone,
      order,
      headline,
    });

    const sellerMailtoUrl = buildOrderMailtoUrl({
      targetEmail: sellerEmail || 'seller@foodindia.app',
      order,
      headline: isNew ? 'New Customer Order Received' : headline,
    });

    const customerMailtoUrl = buildOrderMailtoUrl({
      targetEmail: order.customerEmail || '',
      order,
      headline,
    });

    const lat = order.addressSnapshot?.latitude ?? order.customerLatitude;
    const lng = order.addressSnapshot?.longitude ?? order.customerLongitude;

    const bodySummary = `${order.customerName} (${order.customerPhone}) • ${
      order.itemsSnapshot?.length || 1
    } item(s) • COD ₹${order.totalAmount}${
      order.gstEnabled && order.gstAmount ? ` (incl. 5% GST ₹${order.gstAmount})` : ''
    }${
      typeof lat === 'number' && typeof lng === 'number'
        ? ` • GPS: ${lat.toFixed(4)}, ${lng.toFixed(4)}`
        : ''
    }`;

    try {
      // 1. Write Seller In-App + SMS + Email + WhatsApp notification to Firestore
      if (order.sellerId) {
        const sellerNotifRef = doc(collection(db, 'notifications'));
        await setDoc(sellerNotifRef, {
          notificationId: sellerNotifRef.id,
          recipientUid: order.sellerId,
          recipientRole: 'seller',
          recipientEmail: sellerEmail || '',
          recipientPhone: sellerPhone || order.restaurantPhone || ADMIN_AND_ORDER_SMS_NUMBER,
          smsRecipientPhone: ADMIN_AND_ORDER_SMS_NUMBER,
          orderId: order.orderId,
          orderNumber: order.orderNumber,
          title: isNew
            ? `🔔 New Order #${order.orderNumber} from ${order.customerName}`
            : `Order #${order.orderNumber} → ${order.orderStatus.replace(/_/g, ' ').toUpperCase()}`,
          body: bodySummary,
          channels: ['app', 'sms', 'email', 'whatsapp'],
          smsUrl: smsInboxUrl,
          whatsappUrl: customerWhatsAppUrl,
          mailtoUrl: sellerMailtoUrl,
          createdAt: serverTimestamp(),
        });
      }

      // 2. Write Customer In-App + SMS + Email + WhatsApp notification to Firestore
      if (order.customerId) {
        const custNotifRef = doc(collection(db, 'notifications'));
        await setDoc(custNotifRef, {
          notificationId: custNotifRef.id,
          recipientUid: order.customerId,
          recipientRole: 'customer',
          recipientEmail: order.customerEmail || '',
          recipientPhone: order.customerPhone || '',
          smsRecipientPhone: ADMIN_AND_ORDER_SMS_NUMBER,
          orderId: order.orderId,
          orderNumber: order.orderNumber,
          title: isNew
            ? `✅ Order #${order.orderNumber} Confirmed with ${order.restaurantName}`
            : `📦 Order #${order.orderNumber}: ${order.orderStatus.replace(/_/g, ' ').toUpperCase()}`,
          body: `${order.restaurantName} • COD ₹${order.totalAmount} • Cell: ${order.customerPhone}`,
          channels: ['app', 'sms', 'email', 'whatsapp'],
          smsUrl: smsInboxUrl,
          whatsappUrl: sellerWhatsAppUrl,
          mailtoUrl: customerMailtoUrl,
          createdAt: serverTimestamp(),
        });
      }

      // 3. Call backend notification dispatcher (non-blocking)
      fetch('/api/notifications/dispatch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: order.orderId,
          orderNumber: order.orderNumber,
          customerId: order.customerId,
          customerName: order.customerName,
          customerPhone: order.customerPhone,
          customerEmail: order.customerEmail,
          sellerId: order.sellerId,
          restaurantName: order.restaurantName,
          totalAmount: order.totalAmount,
          gstEnabled: order.gstEnabled,
          gstAmount: order.gstAmount,
          orderStatus: order.orderStatus,
          smsRecipient: ADMIN_AND_ORDER_SMS_NUMBER,
          smsInboxUrl,
          channels: ['app', 'sms', 'email', 'whatsapp'],
          sellerWhatsAppUrl,
          customerWhatsAppUrl,
          sellerMailtoUrl,
          customerMailtoUrl,
        }),
      }).catch(() => {});

      reportGlobalButtonStatus({
        buttonName: `Order Alert & SMS Dispatch (${eventType})`,
        backendPath: `Firestore: notifications & SMS Inbox (+918825028335)`,
        dbUpdated: 'UPDATED',
        statusType: 'success',
        message: `Dispatched 3-sec Seller Sound Alert & Phone SMS Inbox payload to ${ADMIN_AND_ORDER_SMS_NUMBER} for Order #${order.orderNumber}.`,
        suggestion: 'Seller receives a 3-second beep & sound alert and SMS inbox message with customer GPS coordinate link, phone, address, and name.',
      });
    } catch {
      // Non-fatal
    }

    return {
      sellerWhatsAppUrl,
      customerWhatsAppUrl,
      sellerMailtoUrl,
      customerMailtoUrl,
      smsInboxUrl,
    };
  },

  async markAsRead(notificationId: string): Promise<void> {
    try {
      await updateDoc(doc(db, 'notifications', notificationId), {
        readAt: serverTimestamp(),
      });
    } catch {
      // ignore
    }
  },
};
