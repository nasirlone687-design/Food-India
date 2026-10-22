import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  CheckCircle2,
  Package,
  ArrowRight,
  ShoppingBag,
  MessageCircle,
  MessageSquare,
  Mail,
  MapPin,
  ExternalLink,
} from 'lucide-react';
import { motion } from 'motion/react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase/config';
import { Order } from '../models/types';
import {
  buildOrderWhatsAppUrl,
  buildOrderMailtoUrl,
  buildOrderSmsInboxUrl,
  ADMIN_AND_ORDER_SMS_NUMBER,
} from '../services/notifications';
import { getGoogleMapsCoordUrl } from '../utils/gps';

export default function OrderSuccessScreen() {
  const navigate = useNavigate();
  const { orderId } = useParams();
  const [order, setOrder] = useState<Order | null>(null);

  useEffect(() => {
    if (!orderId) return;
    const unsub = onSnapshot(doc(db, 'orders', orderId), (snap) => {
      if (snap.exists()) {
        setOrder({ ...snap.data(), orderId: snap.id } as Order);
      }
    }, () => {});
    return () => unsub();
  }, [orderId]);

  const smsInboxUrl = order
    ? buildOrderSmsInboxUrl({
        targetPhone: ADMIN_AND_ORDER_SMS_NUMBER,
        order,
        headline: 'New COD Order Placed',
      })
    : '';

  const whatsappUrl = order
    ? buildOrderWhatsAppUrl({
        targetPhone: order.restaurantPhone || ADMIN_AND_ORDER_SMS_NUMBER,
        order,
        headline: 'New COD Order Placed',
      })
    : '';

  const mailtoUrl = order
    ? buildOrderMailtoUrl({
        targetEmail: order.customerEmail || '',
        order,
        headline: 'Order Confirmation',
      })
    : '';

  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6 text-center">
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', damping: 12, stiffness: 200 }}
        className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mb-6"
      >
        <CheckCircle2 className="h-12 w-12 text-green-500" fill="currentColor" stroke="white" />
      </motion.div>

      <motion.h1
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="text-3xl font-black text-slate-900 mb-2"
      >
        Order Placed!
      </motion.h1>

      <motion.p
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="text-slate-500 mb-6 max-w-sm text-sm"
      >
        Your order{' '}
        <span className="font-bold text-slate-900">
          #{order?.orderNumber || orderId?.slice(-6).toUpperCase()}
        </span>{' '}
        has been sent to{' '}
        <span className="font-bold text-slate-900">
          {order?.restaurantName || 'the Seller Kitchen'}
        </span>{' '}
        with a 3-second sound alert and permanently saved to your profile.
      </motion.p>

      {order && (
        <div className="w-full max-w-sm bg-slate-50 border border-slate-100 rounded-3xl p-4 mb-6 text-left space-y-2.5 text-xs">
          <div className="flex justify-between items-center">
            <span className="font-black text-slate-400 uppercase tracking-wider">Customer Name</span>
            <span className="font-bold text-slate-900">{order.customerName}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="font-black text-slate-400 uppercase tracking-wider">Customer Cell</span>
            <span className="font-bold text-slate-900">{order.customerPhone}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="font-black text-slate-400 uppercase tracking-wider">Item Subtotal</span>
            <span className="font-bold text-slate-900">₹{Number(order.itemSubtotal || 0).toFixed(2)}</span>
          </div>
          {order.gstEnabled && Number(order.gstAmount || 0) > 0 && (
            <div className="flex justify-between items-center bg-emerald-50 px-2.5 py-1.5 rounded-xl border border-emerald-200">
              <span className="font-black text-emerald-700 uppercase tracking-wider">
                GST (5% Govt. Tax)
              </span>
              <span className="font-black text-emerald-700">
                ₹{Number(order.gstAmount).toFixed(2)}
              </span>
            </div>
          )}
          <div className="flex justify-between items-center">
            <span className="font-black text-slate-400 uppercase tracking-wider">Delivery Fee</span>
            <span className="font-bold text-slate-900">₹{Number(order.deliveryCharge || 0).toFixed(2)}</span>
          </div>
          <div className="flex justify-between items-center pt-1.5 border-t border-slate-200/70">
            <span className="font-black text-slate-700 uppercase tracking-wider">Total COD Bill</span>
            <span className="font-black text-orange-600 text-sm">
              ₹{Number(order.totalAmount || 0).toFixed(2)}
            </span>
          </div>

          {order.addressSnapshot?.latitude && (
            <div className="pt-2 border-t border-slate-200/70 flex items-center justify-between gap-2">
              <span className="font-mono font-bold text-slate-600 flex items-center gap-1">
                <MapPin size={12} className="text-orange-500" />
                {order.addressSnapshot.latitude.toFixed(5)},{' '}
                {order.addressSnapshot.longitude.toFixed(5)}
              </span>
              <a
                href={getGoogleMapsCoordUrl(
                  order.addressSnapshot.latitude,
                  order.addressSnapshot.longitude
                )}
                target="_blank"
                rel="noopener noreferrer"
                className="px-2.5 py-1 bg-blue-600 text-white rounded-lg text-[10px] font-black uppercase flex items-center gap-1"
              >
                <ExternalLink size={10} /> Maps Pin
              </a>
            </div>
          )}

          <div className="pt-2 border-t border-slate-200/70 space-y-2">
            {smsInboxUrl && (
              <a
                href={smsInboxUrl}
                className="w-full py-2.5 px-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-black text-[11px] uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-sm"
              >
                <MessageSquare size={14} />
                <span>Send Order SMS to Phone Inbox ({ADMIN_AND_ORDER_SMS_NUMBER})</span>
              </a>
            )}
            <div className="flex flex-wrap gap-2">
              {whatsappUrl && (
                <a
                  href={whatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 py-2.5 px-3 bg-green-600 hover:bg-green-700 text-white rounded-xl font-black text-[11px] uppercase tracking-wider flex items-center justify-center gap-1.5"
                >
                  <MessageCircle size={14} />
                  <span>Send via WhatsApp</span>
                </a>
              )}
              {mailtoUrl && (
                <a
                  href={mailtoUrl}
                  className="flex-1 py-2.5 px-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-black text-[11px] uppercase tracking-wider flex items-center justify-center gap-1.5"
                >
                  <Mail size={14} />
                  <span>Email Receipt</span>
                </a>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="w-full max-w-sm space-y-3">
        <motion.button
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          onClick={() => navigate(`/track-order/${orderId}`)}
          className="w-full py-4 bg-orange-500 text-white font-bold rounded-2xl shadow-lg shadow-orange-100 flex items-center justify-center gap-2 hover:bg-orange-600 transition-colors"
        >
          Track My Order Live
          <Package size={18} />
        </motion.button>

        <motion.button
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          onClick={() => navigate('/customer')}
          className="w-full py-4 bg-slate-100 text-slate-900 font-bold rounded-2xl flex items-center justify-center gap-2 hover:bg-slate-200 transition-colors"
        >
          Back to Home
          <ArrowRight size={18} />
        </motion.button>
      </div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.8 }}
        className="mt-10 flex items-center gap-2 text-xs text-slate-400 font-bold uppercase tracking-widest"
      >
        <ShoppingBag size={14} />
        Food India 🇮🇳
      </motion.div>
    </div>
  );
}
