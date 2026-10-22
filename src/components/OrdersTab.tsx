import React, { useState, useEffect } from 'react';
import {
  ShoppingBag,
  Clock,
  ChevronRight,
  Package,
  CheckCircle2,
  XCircle,
  Loader2,
  ExternalLink,
  MapPin,
  MessageCircle,
  Mail,
} from 'lucide-react';
import { formatCurrency } from '../utils/helpers';
import { useAuth } from '../context/AuthContext';
import { Order } from '../models/types';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase/config';
import { getGoogleMapsCoordUrl } from '../utils/gps';
import { buildOrderWhatsAppUrl, buildOrderMailtoUrl, normalizeIndianWhatsAppNumber } from '../services/notifications';
import { getSavedCustomerOrderIds, getOrCreateCustomerDeviceId, getSavedCustomerPhone } from '../utils/orderStorage';

const OrdersTab: React.FC = () => {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const devCustId = getOrCreateCustomerDeviceId();
    const savedPhone = getSavedCustomerPhone();
    const targetPhone = profile?.phone || savedPhone || '';
    const cleanPhoneDigits = normalizeIndianWhatsAppNumber(targetPhone);

    const unsub = onSnapshot(
      collection(db, 'orders'),
      (snap) => {
        const savedOrderIds = new Set(getSavedCustomerOrderIds());
        const allList = snap.docs.map((d) => ({ ...d.data(), orderId: d.id } as Order));

        const matched = allList.filter((order) => {
          // 1. Direct match with saved order IDs from this device
          if (savedOrderIds.has(order.orderId)) return true;
          // 2. Match logged-in user UID
          if (user?.uid && order.customerId === user.uid) return true;
          // 3. Match device-generated customer ID
          if (order.customerId === devCustId || (order as any).deviceCustomerId === devCustId) return true;
          // 4. Match customer phone number
          if (cleanPhoneDigits && order.customerPhone) {
            const orderPhoneDigits = normalizeIndianWhatsAppNumber(order.customerPhone);
            if (orderPhoneDigits && (orderPhoneDigits === cleanPhoneDigits || orderPhoneDigits.endsWith(cleanPhoneDigits.slice(-10)))) {
              return true;
            }
          }
          // 5. Match customer email
          if (user?.email && order.customerEmail && order.customerEmail.toLowerCase() === user.email.toLowerCase()) {
            return true;
          }
          return false;
        });

        matched.sort((a, b) => {
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

        setOrders(matched);
        setLoading(false);
      },
      (err) => {
        console.error('Error fetching real-time customer orders:', err);
        setLoading(false);
      }
    );

    const handleOrdersEvent = () => {
      // Re-trigger filtering when local order IDs change
      setLoading(false);
    };
    window.addEventListener('food_india_orders_updated', handleOrdersEvent);

    return () => {
      unsub();
      window.removeEventListener('food_india_orders_updated', handleOrdersEvent);
    };
  }, [user?.uid, user?.email, profile?.phone]);

  const getStatusInfo = (status: Order['orderStatus']) => {
    switch (status) {
      case 'delivered':
        return { color: 'bg-green-50 text-green-600', icon: CheckCircle2 };
      case 'cancelled':
        return { color: 'bg-red-50 text-red-600', icon: XCircle };
      case 'pending':
      case 'confirmed':
      case 'preparing':
      case 'ready_for_pickup':
      case 'out_for_delivery':
        return { color: 'bg-blue-50 text-blue-600 animate-pulse', icon: Clock };
      default:
        return { color: 'bg-slate-50 text-slate-600', icon: Clock };
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between px-1">
        <div>
          <h2 className="text-2xl font-black text-slate-900">Your Permanent Order History</h2>
          <p className="text-xs font-bold text-slate-400">
            All orders permanently linked to your Customer Profile ({orders.length})
          </p>
        </div>
        <div className="w-10 h-10 bg-white rounded-xl shadow-sm flex items-center justify-center text-slate-400">
          <ShoppingBag size={20} />
        </div>
      </div>

      <div className="space-y-4">
        {orders.length === 0 ? (
          <div className="bg-white rounded-[32px] p-12 text-center border border-slate-100">
            <Package size={48} className="mx-auto text-slate-200 mb-4" />
            <p className="text-slate-500 font-bold">No orders found yet</p>
          </div>
        ) : (
          orders.map((order) => {
            const { color, icon: StatusIcon } = getStatusInfo(order.orderStatus);
            const whatsappUrl = buildOrderWhatsAppUrl({
              targetPhone: order.restaurantPhone || order.customerPhone,
              order,
              headline: `Order #${order.orderNumber} Inquiry`,
            });
            const mailtoUrl = buildOrderMailtoUrl({
              targetEmail: order.customerEmail || '',
              order,
              headline: `Order #${order.orderNumber} Summary`,
            });

            return (
              <div
                key={order.orderId}
                onClick={() => navigate(`/track-order/${order.orderId}`)}
                className="bg-white rounded-[32px] p-6 border border-slate-100 shadow-sm group hover:border-orange-200 transition-colors cursor-pointer"
              >
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-600">
                      <Package size={24} />
                    </div>
                    <div>
                      <h4 className="font-black text-slate-900 leading-tight">
                        {order.restaurantName}
                      </h4>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                        {order.orderNumber} •{' '}
                        {order.createdAt?.toDate ? format(order.createdAt.toDate(), 'PPp') : 'Today'}
                      </p>
                    </div>
                  </div>
                  <div
                    className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 ${color}`}
                  >
                    <StatusIcon size={10} />
                    {order.orderStatus.replace(/_/g, ' ')}
                  </div>
                </div>

                <p className="text-sm text-slate-600 font-bold mb-2">
                  {(order.itemsSnapshot || order.items || [])
                    .map(
                      (i: any) =>
                        `${i.quantity}x ${i.name}${
                          i.selectedAddOns?.length
                            ? ` (+${i.selectedAddOns.map((a: any) => a.option?.name || '').filter(Boolean).join(', ')})`
                            : ''
                        }`
                    )
                    .join(', ')}
                </p>

                {order.addressSnapshot?.latitude && (
                  <div className="mb-3 p-2.5 bg-slate-50 rounded-2xl flex flex-wrap items-center justify-between gap-2 text-xs">
                    <span className="flex items-center gap-1.5 font-mono font-bold text-slate-600">
                      <MapPin size={12} className="text-orange-500" />
                      {order.addressSnapshot.latitude.toFixed(6)},{' '}
                      {order.addressSnapshot.longitude.toFixed(6)}
                    </span>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <a
                        href={getGoogleMapsCoordUrl(
                          order.addressSnapshot.latitude,
                          order.addressSnapshot.longitude
                        )}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-[10px] font-bold flex items-center gap-1"
                      >
                        <ExternalLink size={11} />
                        <span>Google Maps</span>
                      </a>
                      <a
                        href={whatsappUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="px-2.5 py-1 bg-green-600 hover:bg-green-700 text-white rounded-lg text-[10px] font-bold flex items-center gap-1"
                      >
                        <MessageCircle size={11} />
                        <span>WhatsApp</span>
                      </a>
                      <a
                        href={mailtoUrl}
                        onClick={(e) => e.stopPropagation()}
                        className="px-2.5 py-1 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-[10px] font-bold flex items-center gap-1"
                      >
                        <Mail size={11} />
                        <span>Email</span>
                      </a>
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between pt-4 border-t border-slate-50">
                  <div className="flex flex-col">
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest leading-none">
                      Total COD Amount
                    </span>
                    <span className="text-base font-black text-slate-900">
                      {formatCurrency(order.totalAmount)}
                    </span>
                    {order.gstEnabled && Number(order.gstAmount || 0) > 0 && (
                      <span className="text-[10px] font-black text-emerald-600 mt-0.5">
                        Sub: ₹{Number(order.itemSubtotal || 0).toFixed(2)} • 5% GST: ₹
                        {Number(order.gstAmount).toFixed(2)} • Del: ₹
                        {Number(order.deliveryCharge || 0).toFixed(2)}
                      </span>
                    )}
                  </div>
                  <button className="flex items-center gap-1 text-orange-600 text-xs font-black uppercase tracking-widest hover:translate-x-1 transition-transform">
                    Track & Details
                    <ChevronRight size={16} strokeWidth={3} />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default OrdersTab;
