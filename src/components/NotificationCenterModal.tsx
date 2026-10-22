import React, { useEffect, useState } from 'react';
import { Bell, X, MessageCircle, Mail, CheckCircle2, ExternalLink } from 'lucide-react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../context/AuthContext';
import { AppNotification } from '../models/types';
import { notificationService, normalizeIndianWhatsAppNumber } from '../services/notifications';
import { getSavedCustomerOrderIds, getOrCreateCustomerDeviceId, getSavedCustomerPhone } from '../utils/orderStorage';

interface NotificationCenterModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const NotificationCenterModal: React.FC<NotificationCenterModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { user, profile } = useAuth();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);

  useEffect(() => {
    const devCustId = getOrCreateCustomerDeviceId();
    const savedPhone = getSavedCustomerPhone();
    const targetPhone = profile?.phone || savedPhone || '';
    const cleanPhoneDigits = normalizeIndianWhatsAppNumber(targetPhone);

    const unsub = onSnapshot(
      collection(db, 'notifications'),
      (snap) => {
        const savedOrderIds = new Set(getSavedCustomerOrderIds());
        const allList = snap.docs.map(
          (d) => ({ notificationId: d.id, ...d.data() } as AppNotification)
        );

        const matched = allList.filter((n) => {
          if (n.orderId && savedOrderIds.has(n.orderId)) return true;
          if (user?.uid && n.recipientUid === user.uid) return true;
          if (n.recipientUid === devCustId) return true;
          if (cleanPhoneDigits && n.recipientPhone) {
            const notifPhoneDigits = normalizeIndianWhatsAppNumber(n.recipientPhone);
            if (notifPhoneDigits && (notifPhoneDigits === cleanPhoneDigits || notifPhoneDigits.endsWith(cleanPhoneDigits.slice(-10)))) {
              return true;
            }
          }
          if (user?.email && n.recipientEmail && n.recipientEmail.toLowerCase() === user.email.toLowerCase()) {
            return true;
          }
          return false;
        });

        matched.sort((a, b) => {
          const ta = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
          const tb = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
          return tb - ta;
        });
        setNotifications(matched);
      },
      (err) => {
        console.error('Error listening to notifications:', err);
      }
    );
    return () => unsub();
  }, [user?.uid, user?.email, profile?.phone]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-slate-900/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-lg rounded-[32px] border border-slate-100 shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        <div className="bg-slate-900 text-white p-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-orange-500 flex items-center justify-center">
              <Bell size={20} className="text-white" />
            </div>
            <div>
              <h3 className="text-sm font-black uppercase tracking-wider">
                Live App, Email & WhatsApp Notifications ({notifications.length})
              </h3>
              <p className="text-[10px] text-slate-400 font-mono">
                Synced with Firestore notifications collection
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-4 overflow-y-auto space-y-3 flex-1">
          {notifications.length === 0 ? (
            <div className="text-center py-12 space-y-2">
              <Bell size={36} className="mx-auto text-slate-200" />
              <p className="text-xs font-bold text-slate-400">
                No notifications yet. Place or update an order to receive instant App, Email &
                WhatsApp alerts.
              </p>
            </div>
          ) : (
            notifications.map((n) => (
              <div
                key={n.notificationId}
                onClick={() => notificationService.markAsRead(n.notificationId)}
                className={`p-4 rounded-2xl border transition-all space-y-2 ${
                  n.readAt
                    ? 'bg-slate-50 border-slate-100'
                    : 'bg-orange-50/60 border-orange-200 shadow-sm'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <h4 className="text-xs font-black text-slate-900">{n.title}</h4>
                  <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-white border border-slate-200 text-slate-500 shrink-0">
                    {n.createdAt?.toDate
                      ? n.createdAt.toDate().toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })
                      : 'Just now'}
                  </span>
                </div>
                <p className="text-xs text-slate-600 font-medium">{n.body}</p>
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 flex items-center gap-1">
                    <CheckCircle2 size={10} /> In-App Synced
                  </span>
                  {n.whatsappUrl && (
                    <a
                      href={n.whatsappUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="px-2.5 py-1 bg-green-600 hover:bg-green-700 text-white rounded-lg text-[10px] font-black uppercase flex items-center gap-1"
                    >
                      <MessageCircle size={11} />
                      <span>Send WhatsApp</span>
                      <ExternalLink size={10} />
                    </a>
                  )}
                  {n.mailtoUrl && (
                    <a
                      href={n.mailtoUrl}
                      onClick={(e) => e.stopPropagation()}
                      className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-[10px] font-black uppercase flex items-center gap-1"
                    >
                      <Mail size={11} />
                      <span>Send Email</span>
                    </a>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
