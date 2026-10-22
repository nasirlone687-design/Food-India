import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Package,
  ChevronRight,
  Clock,
  MapPin,
  Loader2,
  ExternalLink,
  MessageCircle,
  Mail,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Order } from '../models/types';
import { format } from 'date-fns';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase/config';
import { getGoogleMapsCoordUrl } from '../utils/gps';
import { buildOrderWhatsAppUrl, buildOrderMailtoUrl, normalizeIndianWhatsAppNumber } from '../services/notifications';
import { getSavedCustomerOrderIds, getOrCreateCustomerDeviceId, getSavedCustomerPhone } from '../utils/orderStorage';

const OrdersScreen: React.FC = () => {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
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
          if (savedOrderIds.has(order.orderId)) return true;
          if (user?.uid && order.customerId === user.uid) return true;
          if (order.customerId === devCustId || (order as any).deviceCustomerId === devCustId) return true;
          if (cleanPhoneDigits && order.customerPhone) {
            const orderPhoneDigits = normalizeIndianWhatsAppNumber(order.customerPhone);
            if (orderPhoneDigits && (orderPhoneDigits === cleanPhoneDigits || orderPhoneDigits.endsWith(cleanPhoneDigits.slice(-10)))) {
              return true;
            }
          }
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
      setLoading(false);
    };
    window.addEventListener('food_india_orders_updated', handleOrdersEvent);

    return () => {
      unsub();
      window.removeEventListener('food_india_orders_updated', handleOrdersEvent);
    };
  }, [user?.uid, user?.email, profile?.phone]);

  const getStatusColor = (status: Order['orderStatus']) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-50 text-yellow-700 border-yellow-100';
      case 'confirmed':
        return 'bg-blue-50 text-blue-700 border-blue-100';
      case 'preparing':
        return 'bg-indigo-50 text-indigo-700 border-indigo-100';
      case 'ready_for_pickup':
        return 'bg-blue-50 text-blue-700 border-blue-100';
      case 'out_for_delivery':
        return 'bg-purple-50 text-purple-700 border-purple-100';
      case 'delivered':
        return 'bg-green-50 text-green-700 border-green-100';
      case 'cancelled':
        return 'bg-red-50 text-red-700 border-red-100';
      default:
        return 'bg-gray-50 text-gray-700 border-gray-100';
    }
  };

  const getStatusLabel = (status: Order['orderStatus']) => {
    return status.replace(/_/g, ' ').toUpperCase();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-8">
      {/* Header */}
      <header className="bg-white px-4 py-4 flex items-center gap-4 sticky top-0 z-10 border-b">
        <button
          onClick={() => navigate(-1)}
          className="p-2 -ml-2 rounded-full hover:bg-gray-100 transition-colors"
        >
          <ArrowLeft className="w-6 h-6 text-gray-900" />
        </button>
        <h1 className="text-xl font-bold text-gray-900">My Orders ({orders.length})</h1>
      </header>

      <div className="max-w-2xl mx-auto p-4 space-y-4">
        {orders.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 text-center shadow-sm">
            <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <Package className="w-10 h-10 text-gray-300" />
            </div>
            <h3 className="text-lg font-bold text-gray-900">No orders yet</h3>
            <p className="text-gray-500 mt-1">When you place an order, it will appear here.</p>
            <button
              onClick={() => navigate('/customer')}
              className="mt-6 text-orange-500 font-semibold"
            >
              Start Ordering
            </button>
          </div>
        ) : (
          orders.map((order) => {
            const whatsappUrl = buildOrderWhatsAppUrl({
              targetPhone: order.restaurantPhone || order.customerPhone,
              order,
            });
            const mailtoUrl = buildOrderMailtoUrl({
              targetEmail: order.customerEmail || '',
              order,
            });

            return (
              <div
                key={order.orderId}
                onClick={() => navigate(`/track-order/${order.orderId}`)}
                className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 hover:border-orange-200 transition-colors cursor-pointer group"
              >
                <div className="flex justify-between items-start mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-bold text-gray-900">{order.restaurantName}</h3>
                      <ChevronRight className="w-4 h-4 text-gray-400 group-hover:translate-x-1 transition-transform" />
                    </div>
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <Clock className="w-3 h-3" />
                      {order.createdAt?.toDate ? format(order.createdAt.toDate(), 'PPp') : 'Just now'}
                    </div>
                  </div>
                  <span
                    className={`px-2 py-1 rounded text-[10px] font-bold border ${getStatusColor(
                      order.orderStatus
                    )}`}
                  >
                    {getStatusLabel(order.orderStatus)}
                  </span>
                </div>

                <div className="flex gap-4 mb-4">
                  <div className="flex-1 space-y-1">
                    {(order.itemsSnapshot || order.items || []).map((item: any, idx: number) => (
                      <p key={idx} className="text-sm text-gray-600 truncate">
                        {item.quantity} x {item.name}
                      </p>
                    ))}
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-gray-900">₹{order.totalAmount}</p>
                    {order.gstEnabled && Number(order.gstAmount || 0) > 0 && (
                      <p className="text-[10px] font-bold text-emerald-600">
                        Incl. 5% GST: ₹{Number(order.gstAmount).toFixed(2)}
                      </p>
                    )}
                    <p className="text-[10px] text-gray-500">{order.paymentMethod}</p>
                  </div>
                </div>

                <div className="pt-3 border-t flex flex-wrap justify-between items-center gap-2">
                  <div className="flex items-center gap-1.5 text-xs text-gray-500">
                    <MapPin className="w-3.5 h-3.5 text-orange-500" />
                    <span className="truncate max-w-[160px]">
                      {order.addressSnapshot?.displayName || order.addressSnapshot?.formattedAddress}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {order.addressSnapshot?.latitude && (
                      <a
                        href={getGoogleMapsCoordUrl(
                          order.addressSnapshot.latitude,
                          order.addressSnapshot.longitude
                        )}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-lg text-[11px] font-bold flex items-center gap-1"
                      >
                        <ExternalLink className="w-3 h-3" />
                        Maps
                      </a>
                    )}
                    <a
                      href={whatsappUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="px-2.5 py-1 bg-green-50 hover:bg-green-100 text-green-700 rounded-lg text-[11px] font-bold flex items-center gap-1"
                    >
                      <MessageCircle className="w-3 h-3" />
                      WhatsApp
                    </a>
                    <a
                      href={mailtoUrl}
                      onClick={(e) => e.stopPropagation()}
                      className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[11px] font-bold flex items-center gap-1"
                    >
                      <Mail className="w-3 h-3" />
                      Email
                    </a>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/track-order/${order.orderId}`);
                      }}
                      className="text-orange-500 text-xs font-bold flex items-center gap-1"
                    >
                      Track <ExternalLink className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default OrdersScreen;
