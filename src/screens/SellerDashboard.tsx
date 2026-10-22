import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { authService } from '../services/auth';
import { productService } from '../services/products';
import { orderService } from '../services/orders';
import { deliveryService } from '../services/delivery';
import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  setDoc,
  updateDoc,
  serverTimestamp,
  orderBy,
} from 'firebase/firestore';
import { db } from '../firebase/config';
import {
  Restaurant,
  Order,
  Product,
  Seller,
  Category,
  DeliveryRange,
  SellerDocument,
} from '../models/types';
import { LocationPicker } from '../components/LocationPicker';
import {
  LogOut,
  Store,
  LayoutDashboard,
  ClipboardList,
  TrendingUp,
  Plus,
  Edit3,
  Trash2,
  Package,
  MapPin,
  Clock,
  CheckCircle2,
  ShieldCheck,
  CreditCard,
  Navigation,
  Loader2,
  ChevronRight,
  Phone,
  Search,
  Grid,
  Layers,
  Calendar,
  X,
  Truck,
  ExternalLink,
  Upload,
  FileText,
  Database,
  Sparkles,
  Zap,
  AlertTriangle,
  Bell,
  MessageCircle,
  MessageSquare,
  Mail,
  Download,
} from 'lucide-react';
import { format } from 'date-fns';
import {
  getGoogleMapsCoordUrl,
  lookupLocationByPinOrCity,
  requestLiveGpsLocation,
  loadSavedLiveGpsLocation,
  isLegacyFakeCoordinate,
} from '../utils/gps';
import { reportGlobalButtonStatus, reportGlobalError } from '../context/ErrorLogContext';
import { seedCategories, seedIndianTestProducts, deleteAllTestProducts } from '../firebase/seed';
import {
  uploadSellerDocumentFast,
  deleteSellerDocumentFast,
  saveSellerKycNumbersToProfile,
  downloadSellerDocumentFile,
  createValidSamplePdfFile,
  getDocTypeLabel,
  SellerDocType,
} from '../utils/documentUpload';
import { NotificationCenterModal } from '../components/NotificationCenterModal';
import {
  buildOrderWhatsAppUrl,
  buildOrderMailtoUrl,
  buildOrderSmsInboxUrl,
  ADMIN_AND_ORDER_SMS_NUMBER,
} from '../services/notifications';

type SellerTab = 'overview' | 'orders' | 'menu' | 'restaurant' | 'account';
type OrderFilter =
  | 'all'
  | 'pending'
  | 'confirmed'
  | 'preparing'
  | 'ready_for_pickup'
  | 'out_for_delivery'
  | 'completed'
  | 'cancelled';

const DAYS_OF_WEEK = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

const DEFAULT_OPENING_HOURS: Record<string, { open: string; close: string; isClosed: boolean }> = {
  monday: { open: '09:00', close: '22:00', isClosed: false },
  tuesday: { open: '09:00', close: '22:00', isClosed: false },
  wednesday: { open: '09:00', close: '22:00', isClosed: false },
  thursday: { open: '09:00', close: '22:00', isClosed: false },
  friday: { open: '09:00', close: '23:00', isClosed: false },
  saturday: { open: '09:00', close: '23:00', isClosed: false },
  sunday: { open: '10:00', close: '22:00', isClosed: false },
};

const DEFAULT_DELIVERY_SLABS: DeliveryRange[] = [
  { minKm: 0, maxKm: 5, price: 30 },
  { minKm: 5, maxKm: 10, price: 50 },
];

function createInitialRestaurant(uid: string, restaurantId?: string, email?: string, ownerName?: string): Restaurant {
  const resolvedId = restaurantId || `rest_${uid}`;
  const savedGps = loadSavedLiveGpsLocation();
  const lat = savedGps?.latitude ?? 0;
  const lng = savedGps?.longitude ?? 0;
  return {
    restaurantId: resolvedId,
    sellerId: uid,
    restaurantName: ownerName ? `${ownerName}'s Kitchen` : 'Food India Kitchen',
    description: 'Freshly prepared authentic Indian dishes.',
    phone: '+91 9876543210',
    email: email || '',
    address: savedGps?.address || '',
    state: savedGps?.state || '',
    city: savedGps?.city || '',
    locality: savedGps?.locality || savedGps?.city || '',
    district: savedGps?.district || '',
    postalCode: savedGps?.pincode || '',
    pincode: savedGps?.pincode || '',
    latitude: lat,
    longitude: lng,
    googleMapsLink: lat && lng ? getGoogleMapsCoordUrl(lat, lng) : '',
    openingHours: DEFAULT_OPENING_HOURS,
    isOpen: true,
    preparationTime: '25-35 mins',
    allowOwnDeliveryStaff: true,
    deliveryPricingMode: 'base_km',
    baseDeliveryCharge: 25,
    deliveryPricePerKm: 8,
    deliveryRanges: DEFAULT_DELIVERY_SLABS,
    approvalStatus: 'approved',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

const SellerDashboard: React.FC = () => {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const docFileInputRef = useRef<HTMLInputElement | null>(null);

  const [activeTab, setActiveTab] = useState<SellerTab>('overview');
  const [orderFilter, setOrderFilter] = useState<OrderFilter>('all');
  const [restaurant, setRestaurant] = useState<Restaurant>(() =>
    createInitialRestaurant(user?.uid || 'seller_default', undefined, user?.email || undefined, profile?.fullName)
  );
  const [seller, setSeller] = useState<Seller | null>(null);
  const [documents, setDocuments] = useState<SellerDocument[]>([]);
  const [selectedDocType, setSelectedDocType] = useState<SellerDocType>('id_proof');
  const [uploadingDoc, setUploadingDoc] = useState(false);

  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [lookingUpPin, setLookingUpPin] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [showSearchBar, setShowSearchBar] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [todayOnlyFilter, setTodayOnlyFilter] = useState(false);
  const [menuSubTab, setMenuSubTab] = useState<'products' | 'categories' | 'addons'>('products');
  const [seedingMenu, setSeedingMenu] = useState(false);
  const [selectedSellerCategory, setSelectedSellerCategory] = useState<string>('all');
  const [locatingSellerGps, setLocatingSellerGps] = useState(false);
  const [showNotifModal, setShowNotifModal] = useState(false);
  const [unreadNotifCount, setUnreadNotifCount] = useState(0);
  const [businessLicenseNumber, setBusinessLicenseNumber] = useState('');
  const [fssaiLicenseNumber, setFssaiLicenseNumber] = useState('');
  const [aadhaarOrPanNumber, setAadhaarOrPanNumber] = useState('');
  const [confirmDeleteSeller, setConfirmDeleteSeller] = useState(false);
  const [deletingSeller, setDeletingSeller] = useState(false);
  const [incomingAlertOrder, setIncomingAlertOrder] = useState<Order | null>(null);
  const [processingIncomingOrder, setProcessingIncomingOrder] = useState(false);
  const alertedOrderIdsRef = useRef<Set<string>>(new Set());
  const activeRingStopRef = useRef<(() => void) | null>(null);

  // 3-Second Web Audio API Beep & Sound Notification + 3-Second Vibration for Incoming Seller Orders
  const triggerFiveSecondOrderAlert = (order: Order) => {
    try {
      if (activeRingStopRef.current) {
        activeRingStopRef.current();
      }
      // 1. 3-Second Device Vibration pattern (total ~3000ms)
      if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
        navigator.vibrate([400, 150, 400, 150, 400, 150, 400, 150, 600]);
      }

      // 2. Browser Notification if permitted
      if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
        new Notification(`New Order #${order.orderNumber || order.orderId.slice(-6).toUpperCase()} — ₹${order.totalAmount}`, {
          body: `${order.customerName || 'Customer'} (${order.customerPhone || ''}) placed an order. Accept or Reject now.`,
        });
      }

      // 3. 3-Second Web Audio API Dual-Tone Kitchen Order Beep & Sound (3.0 seconds)
      const AudioCtx = (window as any).AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        const ctx = new AudioCtx();
        let stopped = false;
        const startTime = ctx.currentTime;
        const beepCount = 6; // 6 distinct high-clarity beeps over 3.0 seconds
        for (let i = 0; i < beepCount; i++) {
          const t = startTime + i * 0.5;
          const osc1 = ctx.createOscillator();
          const osc2 = ctx.createOscillator();
          const gain = ctx.createGain();
          osc1.type = 'sine';
          osc2.type = 'triangle';
          osc1.frequency.setValueAtTime(i % 2 === 0 ? 880 : 1046.5, t);
          osc2.frequency.setValueAtTime(i % 2 === 0 ? 1318.5 : 1567.98, t);
          gain.gain.setValueAtTime(0.001, t);
          gain.gain.exponentialRampToValueAtTime(0.32, t + 0.04);
          gain.gain.exponentialRampToValueAtTime(0.001, t + 0.44);
          osc1.connect(gain);
          osc2.connect(gain);
          gain.connect(ctx.destination);
          osc1.start(t);
          osc2.start(t);
          osc1.stop(t + 0.46);
          osc2.stop(t + 0.46);
        }
        const closeTimer = window.setTimeout(() => {
          if (!stopped) {
            stopped = true;
            ctx.close().catch(() => {});
          }
        }, 3100);

        activeRingStopRef.current = () => {
          window.clearTimeout(closeTimer);
          if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
            navigator.vibrate(0);
          }
          if (!stopped) {
            stopped = true;
            ctx.close().catch(() => {});
          }
        };
      }
    } catch {
      // Ignore audio autoplay restriction until user interacts
    }
  };

  // 30-Day Subscription Validity & Pause Check
  const subscriptionMeta = useMemo(() => {
    const expiryRaw = seller?.subscriptionExpiryDate || profile?.subscriptionExpiryDate;
    let expiryDate: Date | null = null;
    if (expiryRaw) {
      if (typeof expiryRaw.toDate === 'function') expiryDate = expiryRaw.toDate();
      else expiryDate = new Date(expiryRaw);
    }
    const now = new Date();
    const isExpiredByDate = expiryDate ? expiryDate.getTime() < now.getTime() : false;
    const daysRemaining = expiryDate
      ? Math.max(0, Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
      : 30;
    const isPaused =
      Boolean(seller?.accountPaused) ||
      seller?.subscriptionStatus === 'expired' ||
      seller?.subscriptionStatus === 'paused' ||
      isExpiredByDate;
    return {
      expiryDate,
      daysRemaining,
      isExpiredByDate,
      isPaused,
    };
  }, [seller, profile]);

  useEffect(() => {
    if (!user || !subscriptionMeta.isExpiredByDate || seller?.subscriptionStatus === 'expired') return;
    // Automatically pause seller account in Firestore when 30-day subscription expires
    setDoc(
      doc(db, 'sellers', user.uid),
      {
        subscriptionStatus: 'expired',
        accountPaused: true,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    ).catch(() => {});
  }, [user, subscriptionMeta.isExpiredByDate, seller?.subscriptionStatus]);

  // Stats
  const stats = useMemo(() => {
    const today = new Date().toDateString();
    const todayOrders = orders.filter((o) => {
      const d = o.createdAt?.toDate ? o.createdAt.toDate() : new Date();
      return d.toDateString() === today;
    });
    const completedToday = todayOrders.filter((o) => o.orderStatus === 'delivered');
    const revenueToday = completedToday.reduce((acc, o) => acc + Number(o.totalAmount || 0), 0);

    return {
      revenueToday,
      ordersToday: todayOrders.length,
      pendingOrders: orders.filter((o) => o.orderStatus === 'pending').length,
      activeProducts: products.filter((p) => p.isAvailable).length,
    };
  }, [orders, products]);

  useEffect(() => {
    if (!user) return;

    let unsubRestaurant: (() => void) | null = null;
    const fallbackRestId = `rest_${user.uid}`;

    // 1. Live Seller & Restaurant Listener (with automatic bootstrap if missing)
    const unsubSeller = onSnapshot(doc(db, 'sellers', user.uid), async (sellerSnap) => {
      if (sellerSnap.exists()) {
        const sellerData = sellerSnap.data() as Seller;
        setSeller(sellerData);
        if (sellerData.businessLicenseNumber) setBusinessLicenseNumber(sellerData.businessLicenseNumber);
        if (sellerData.fssaiLicenseNumber) setFssaiLicenseNumber(sellerData.fssaiLicenseNumber);
        if (sellerData.aadhaarOrPanNumber) setAadhaarOrPanNumber(sellerData.aadhaarOrPanNumber);
        const targetRestId = sellerData.restaurantId || fallbackRestId;

        if (!sellerData.restaurantId) {
          try {
            await setDoc(
              doc(db, 'sellers', user.uid),
              { restaurantId: targetRestId, updatedAt: serverTimestamp() },
              { merge: true }
            );
          } catch {
            // ignore
          }
        }

        if (unsubRestaurant) unsubRestaurant();
        unsubRestaurant = onSnapshot(doc(db, 'restaurants', targetRestId), async (resSnap) => {
          if (resSnap.exists()) {
            const data = resSnap.data() as Restaurant;
            setRestaurant((prev) => ({
              ...prev,
              ...data,
              restaurantId: resSnap.id,
              sellerId: data.sellerId || user.uid,
              phone: data.phone || sellerData.phone || sellerData.businessPhone || prev.phone || '',
              state: data.state || sellerData.state || prev.state || 'Delhi',
              city: data.city || data.locality || sellerData.city || prev.city || 'New Delhi',
              locality: data.locality || data.city || sellerData.city || prev.locality || 'New Delhi',
              district: data.district || sellerData.district || prev.district || 'Central Delhi',
              postalCode: data.postalCode || data.pincode || sellerData.pincode || prev.postalCode || '110001',
              pincode: data.pincode || data.postalCode || sellerData.pincode || prev.pincode || '110001',
              allowOwnDeliveryStaff:
                data.allowOwnDeliveryStaff !== undefined
                  ? data.allowOwnDeliveryStaff
                  : sellerData.allowOwnDeliveryStaff !== undefined
                  ? sellerData.allowOwnDeliveryStaff
                  : true,
              deliveryPricingMode:
                data.deliveryPricingMode || sellerData.deliveryPricingMode || prev.deliveryPricingMode || 'base_km',
              deliveryRanges:
                Array.isArray(data.deliveryRanges) && data.deliveryRanges.length > 0
                  ? data.deliveryRanges
                  : Array.isArray(sellerData.deliveryRanges) && sellerData.deliveryRanges.length > 0
                  ? sellerData.deliveryRanges
                  : DEFAULT_DELIVERY_SLABS,
              openingHours: data.openingHours || DEFAULT_OPENING_HOURS,
            }));
          } else {
            // Auto-create initial restaurant doc so Seller Profile inputs are immediately backed by Firestore
            const initialRest = createInitialRestaurant(
              user.uid,
              targetRestId,
              user.email || undefined,
              sellerData.ownerName || profile?.fullName
            );
            setRestaurant(initialRest);
            try {
              await setDoc(
                doc(db, 'restaurants', targetRestId),
                {
                  ...initialRest,
                  createdAt: serverTimestamp(),
                  updatedAt: serverTimestamp(),
                },
                { merge: true }
              );
            } catch {
              // ignore
            }
          }
        }, () => {});
      } else {
        // Bootstrap Seller + Restaurant doc for this authenticated user
        const initialRest = createInitialRestaurant(
          user.uid,
          fallbackRestId,
          user.email || undefined,
          profile?.fullName
        );
        setRestaurant(initialRest);
        try {
          await setDoc(
            doc(db, 'sellers', user.uid),
            {
              sellerId: user.uid,
              uid: user.uid,
              ownerName: profile?.fullName || user.displayName || 'Kitchen Partner',
              email: user.email || '',
              phone: profile?.phone || '+91 9876543210',
              restaurantId: fallbackRestId,
              verificationStatus: 'pending',
              subscriptionStatus: 'active',
              registrationDate: serverTimestamp(),
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            },
            { merge: true }
          );
          await setDoc(
            doc(db, 'restaurants', fallbackRestId),
            {
              ...initialRest,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            },
            { merge: true }
          );
        } catch {
          // ignore
        }
      }
    }, () => {});

    // 2. Live Seller Documents Listener
    const docsQuery = query(collection(db, 'sellerDocuments'), where('sellerId', '==', user.uid));
    const unsubDocs = onSnapshot(docsQuery, (snap) => {
      const list = snap.docs.map((d) => ({ documentId: d.id, ...d.data() } as SellerDocument));
      list.sort((a, b) => {
        const ta = a.uploadedAt?.toMillis ? a.uploadedAt.toMillis() : 0;
        const tb = b.uploadedAt?.toMillis ? b.uploadedAt.toMillis() : 0;
        return tb - ta;
      });
      setDocuments(list);
    }, () => {});

    // 3. Live Products Listener
    const productsQuery = query(collection(db, 'products'), where('sellerId', '==', user.uid));
    const unsubProducts = onSnapshot(productsQuery, (snap) => {
      setProducts(snap.docs.map((d) => ({ ...d.data(), productId: d.id } as Product)));
    }, () => {});

    // 4. Live Categories Listener
    const catQuery = query(collection(db, 'categories'), where('isActive', '==', true));
    const unsubCats = onSnapshot(catQuery, (snap) => {
      setCategories(snap.docs.map((d) => ({ ...d.data(), categoryId: d.id } as Category)));
    }, () => {});

    // 5. Live Orders Listener (sorted client-side without composite index error, matching seller's restaurant & test restaurants)
    const unsubscribeOrders = onSnapshot(
      collection(db, 'orders'),
      (snapshot) => {
        const allOrders = snapshot.docs.map((d) => ({ ...d.data(), orderId: d.id } as Order));
        const myOrders = allOrders.filter(
          (o) =>
            o.sellerId === user.uid ||
            o.restaurantId === `rest_${user.uid}` ||
            (seller?.restaurantId && o.restaurantId === seller.restaurantId) ||
            (restaurant?.restaurantId && o.restaurantId === restaurant.restaurantId)
        );
        myOrders.sort((a, b) => {
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
        setOrders(myOrders);
        setLoading(false);

        // Detect any pending order not yet alerted in this session and trigger 5-second sound + vibration + Accept/Reject modal
        const unalertedPending = myOrders.find(
          (o) => o.orderStatus === 'pending' && !alertedOrderIdsRef.current.has(o.orderId)
        );
        if (unalertedPending) {
          alertedOrderIdsRef.current.add(unalertedPending.orderId);
          setIncomingAlertOrder(unalertedPending);
          triggerFiveSecondOrderAlert(unalertedPending);
        }
      },
      () => {
        setLoading(false);
      }
    );

    // 6. Live Notifications Listener
    const notifQuery = query(collection(db, 'notifications'), where('recipientUid', '==', user.uid));
    const unsubNotifs = onSnapshot(
      notifQuery,
      (snap) => {
        setUnreadNotifCount(snap.docs.filter((d) => !d.data().readAt).length);
      },
      () => {}
    );

    return () => {
      unsubSeller();
      if (unsubRestaurant) unsubRestaurant();
      unsubDocs();
      unsubProducts();
      unsubCats();
      unsubscribeOrders();
      unsubNotifs();
    };
  }, [user, profile?.fullName, profile?.phone, seller?.restaurantId]);

  /**
   * Helper that persists any partial restaurant/seller update directly to Firestore
   * and logs the button status, linked Firestore paths, DB update confirmation, and suggestions.
   */
  const persistFieldsToFirestore = async (
    buttonName: string,
    partialFields: Partial<Restaurant>,
    suggestionText: string
  ) => {
    if (!user) {
      reportGlobalError(
        `Cannot execute "${buttonName}": No authenticated Seller session found.`,
        undefined,
        'button',
        {
          buttonName,
          backendPath: 'Firestore: restaurants/{restaurantId} & sellers/{uid}',
          dbUpdated: 'NOT_UPDATED',
          statusType: 'error',
          suggestion: 'Please sign in to your Seller account first.',
        }
      );
      return false;
    }

    const restId = restaurant?.restaurantId || seller?.restaurantId || `rest_${user.uid}`;
    const backendPath = `Firestore: restaurants/${restId} & sellers/${user.uid}`;

    try {
      await setDoc(
        doc(db, 'restaurants', restId),
        {
          ...partialFields,
          restaurantId: restId,
          sellerId: user.uid,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      // Sync shared profile/location/delivery fields to sellers/{uid} as well
      const sellerSync: Record<string, any> = {
        uid: user.uid,
        sellerId: user.uid,
        restaurantId: restId,
        updatedAt: serverTimestamp(),
      };
      if (partialFields.phone !== undefined) {
        sellerSync.phone = partialFields.phone;
        sellerSync.businessPhone = partialFields.phone;
      }
      if (partialFields.state !== undefined) sellerSync.state = partialFields.state;
      if (partialFields.city !== undefined) sellerSync.city = partialFields.city;
      if (partialFields.district !== undefined) sellerSync.district = partialFields.district;
      if (partialFields.pincode !== undefined || partialFields.postalCode !== undefined) {
        sellerSync.pincode = partialFields.pincode || partialFields.postalCode;
      }
      if (partialFields.allowOwnDeliveryStaff !== undefined) {
        sellerSync.allowOwnDeliveryStaff = partialFields.allowOwnDeliveryStaff;
      }
      if (partialFields.deliveryPricingMode !== undefined) {
        sellerSync.deliveryPricingMode = partialFields.deliveryPricingMode;
      }
      if (partialFields.deliveryRanges !== undefined) {
        sellerSync.deliveryRanges = partialFields.deliveryRanges;
      }

      await setDoc(doc(db, 'sellers', user.uid), sellerSync, { merge: true });

      if (partialFields.phone !== undefined) {
        await setDoc(
          doc(db, 'users', user.uid),
          { phone: partialFields.phone, updatedAt: serverTimestamp() },
          { merge: true }
        );
      }

      reportGlobalButtonStatus({
        buttonName,
        backendPath,
        dbUpdated: 'UPDATED',
        statusType: 'success',
        message: `Successfully updated ${Object.keys(partialFields).join(', ')} in Firestore.`,
        suggestion: suggestionText,
        details: JSON.stringify(partialFields, null, 2),
      });

      return true;
    } catch (err: any) {
      const msg = err?.message || `Failed to update Firestore for "${buttonName}".`;
      reportGlobalError(msg, err?.stack, 'backend', {
        buttonName,
        backendPath,
        dbUpdated: 'NOT_UPDATED',
        statusType: 'error',
        suggestion: suggestionText,
      });
      setSaveError(msg);
      return false;
    }
  };

  const handleUpdateStatus = async (orderId: string, status: Order['orderStatus']) => {
    const backendPath = `Firestore: orders/${orderId}`;
    try {
      await orderService.updateOrderStatus(
        orderId,
        status,
        `Status updated to ${status.replace(/_/g, ' ')} by restaurant`
      );
      reportGlobalButtonStatus({
        buttonName: `Order Status → ${status.toUpperCase()}`,
        backendPath,
        dbUpdated: 'UPDATED',
        statusType: 'success',
        message: `Order ${orderId} status updated to "${status}" in Firestore.`,
        suggestion: 'After accepting an order, dispatch delivery or update kitchen preparation status.',
      });
    } catch (error: any) {
      reportGlobalError(error?.message || 'Error updating order status', error?.stack, 'backend', {
        buttonName: `Order Status → ${status.toUpperCase()}`,
        backendPath,
        dbUpdated: 'NOT_UPDATED',
        statusType: 'error',
      });
    }
  };

  const handleAcceptIncomingOrder = async (order: Order) => {
    setProcessingIncomingOrder(true);
    try {
      if (activeRingStopRef.current) activeRingStopRef.current();
      await handleUpdateStatus(order.orderId, 'confirmed');
      // Automatically dispatch order to the integrated Local Food Delivery Company API
      try {
        await deliveryService.bookDelivery({
          orderId: order.orderId,
          providerId: order.selectedDeliveryProviderId || 'local_delivery_company',
          confirmedByRole: 'seller',
        });
      } catch {
        // Non-blocking if delivery booking already exists
      }
      setIncomingAlertOrder(null);
      setActiveTab('orders');
      setOrderFilter('confirmed');
      setSaveMessage(
        `Order #${order.orderNumber || order.orderId.slice(-6).toUpperCase()} ACCEPTED & dispatched to Local Food Delivery Partner!`
      );
      setTimeout(() => setSaveMessage(null), 4500);
    } finally {
      setProcessingIncomingOrder(false);
    }
  };

  const handleRejectIncomingOrder = async (order: Order) => {
    setProcessingIncomingOrder(true);
    try {
      if (activeRingStopRef.current) activeRingStopRef.current();
      await handleUpdateStatus(order.orderId, 'cancelled');
      setIncomingAlertOrder(null);
      setSaveMessage(`Order #${order.orderNumber || order.orderId.slice(-6).toUpperCase()} REJECTED.`);
      setTimeout(() => setSaveMessage(null), 4000);
    } finally {
      setProcessingIncomingOrder(false);
    }
  };

  const handleSellerDispatchDelivery = async (order: Order, providerIdOverride?: string) => {
    const backendPath = `Firestore: deliveryBookings & orders/${order.orderId}`;
    try {
      if (providerIdOverride) {
        await deliveryService.cancelOrReassignBooking({
          orderId: order.orderId,
          bookingId: order.deliveryBookingId,
          newProviderId: providerIdOverride,
          reason: 'Reassigned by restaurant seller',
          actorRole: 'seller',
        });
      }
      const res = await deliveryService.bookDelivery({
        orderId: order.orderId,
        providerId: providerIdOverride || order.selectedDeliveryProviderId,
        confirmedByRole: 'seller',
      });
      const msg = `Delivery dispatched via ${res.booking.providerName} (Ref: ${res.booking.trackingRef})`;
      setSaveMessage(msg);
      reportGlobalButtonStatus({
        buttonName: 'Dispatch Delivery Booking',
        backendPath,
        dbUpdated: 'UPDATED',
        statusType: 'success',
        message: msg,
        suggestion: 'Track rider progress or trigger webhook verification when delivered.',
      });
      setTimeout(() => setSaveMessage(null), 4000);
    } catch (err: any) {
      setSaveMessage(err.message || 'Failed to dispatch delivery booking');
      reportGlobalError(err.message || 'Failed to dispatch delivery booking', err?.stack, 'backend', {
        buttonName: 'Dispatch Delivery Booking',
        backendPath,
        dbUpdated: 'NOT_UPDATED',
        statusType: 'error',
      });
      setTimeout(() => setSaveMessage(null), 4000);
    }
  };

  const handleSellerWebhookUpdate = async (
    order: Order,
    targetStatus: 'rider_assigned' | 'picked_up' | 'in_transit' | 'delivered'
  ) => {
    if (!order.deliveryBookingId) return;
    try {
      await deliveryService.triggerSandboxWebhook({
        bookingId: order.deliveryBookingId,
        orderId: order.orderId,
        targetStatus,
      });
      setSaveMessage(`Verified delivery status updated to ${targetStatus.replace(/_/g, ' ').toUpperCase()}`);
      setTimeout(() => setSaveMessage(null), 3500);
    } catch (err: any) {
      setSaveMessage(err.message || 'Failed to update delivery status');
      setTimeout(() => setSaveMessage(null), 3500);
    }
  };

  const handleToggleStore = async () => {
    const nextOpen = !restaurant.isOpen;
    setRestaurant((r) => ({ ...r, isOpen: nextOpen }));
    const ok = await persistFieldsToFirestore(
      `Toggle Store (${nextOpen ? 'OPEN' : 'CLOSED'})`,
      { isOpen: nextOpen },
      'Toggle Store Open to accept live customer orders, or Store Closed when kitchen is offline.'
    );
    if (ok) {
      setSaveMessage(`Kitchen is now ${nextOpen ? 'OPEN and accepting orders' : 'CLOSED'} (Saved to Database).`);
      setTimeout(() => setSaveMessage(null), 3000);
    }
  };

  const handleToggleOwnDeliveryStaff = async () => {
    const nextVal = restaurant.allowOwnDeliveryStaff === false ? true : false;
    setRestaurant((r) => ({ ...r, allowOwnDeliveryStaff: nextVal }));
    const ok = await persistFieldsToFirestore(
      `Allow Restaurant's Own Delivery Staff (${nextVal ? 'ENABLED' : 'DISABLED'})`,
      { allowOwnDeliveryStaff: nextVal },
      'Keep ENABLED to allow your own restaurant delivery staff alongside or as fallback to 3P delivery providers.'
    );
    if (ok) {
      setSaveMessage(
        `Allow Restaurant's Own Delivery Staff set to ${nextVal ? 'ENABLED' : 'DISABLED'} in Firestore!`
      );
      setTimeout(() => setSaveMessage(null), 3500);
    }
  };

  const handleSelectPricingMode = async (mode: 'base_km' | 'range') => {
    const updatedRanges =
      mode === 'range' && (!restaurant.deliveryRanges || restaurant.deliveryRanges.length === 0)
        ? DEFAULT_DELIVERY_SLABS
        : restaurant.deliveryRanges || DEFAULT_DELIVERY_SLABS;

    setRestaurant((r) => ({
      ...r,
      deliveryPricingMode: mode,
      deliveryRanges: updatedRanges,
    }));

    const ok = await persistFieldsToFirestore(
      `Delivery Pricing Mode → ${mode === 'base_km' ? 'BASE + PER KM' : 'DISTANCE SLABS'}`,
      {
        deliveryPricingMode: mode,
        deliveryRanges: updatedRanges,
        baseDeliveryCharge: restaurant.baseDeliveryCharge ?? 25,
        deliveryPricePerKm: restaurant.deliveryPricePerKm ?? 8,
      },
      mode === 'base_km'
        ? 'What to enter: Enter Base Fee (e.g., ₹25) and Per Km Rate (e.g., ₹8).'
        : 'What to enter: Configure Distance Slabs (e.g., 0 to 5 km → ₹30, 5 to 10 km → ₹50) or click "+ Add Slab".'
    );
    if (ok) {
      setSaveMessage(
        `Delivery Pricing Mode switched to ${
          mode === 'base_km' ? 'BASE + PER KM' : 'DISTANCE SLABS'
        } and saved to Firestore!`
      );
      setTimeout(() => setSaveMessage(null), 3500);
    }
  };

  const addDeliveryRange = async () => {
    const current = restaurant.deliveryRanges || [];
    const nextMin = current.length > 0 ? Number(current[current.length - 1].maxKm || 0) : 0;
    const newRange: DeliveryRange = {
      minKm: nextMin,
      maxKm: nextMin + 5,
      price: current.length === 0 ? 30 : Number(current[current.length - 1].price || 30) + 20,
    };
    const nextRanges = [...current, newRange];

    setRestaurant((r) => ({
      ...r,
      deliveryPricingMode: 'range',
      deliveryRanges: nextRanges,
    }));

    const ok = await persistFieldsToFirestore(
      'Add Distance Slab (+ Add Slab)',
      {
        deliveryPricingMode: 'range',
        deliveryRanges: nextRanges,
      },
      `Added slab ${newRange.minKm}–${newRange.maxKm} km → ₹${newRange.price}. Enter Min km (e.g. ${newRange.minKm}), Max km (e.g. ${newRange.maxKm}), and ₹ Fee (e.g. ₹${newRange.price}).`
    );
    if (ok) {
      setSaveMessage(`Added Distance Slab (${newRange.minKm}–${newRange.maxKm} km → ₹${newRange.price}) to Firestore!`);
      setTimeout(() => setSaveMessage(null), 3500);
    }
  };

  const updateDeliveryRange = (idx: number, field: keyof DeliveryRange, val: number) => {
    setRestaurant((r) => {
      const updated = [...(r.deliveryRanges || [])];
      updated[idx] = { ...updated[idx], [field]: val };
      return { ...r, deliveryRanges: updated };
    });
  };

  const saveDeliveryRangesOnBlur = async () => {
    await persistFieldsToFirestore(
      'Update Distance Slabs (KM → ₹)',
      {
        deliveryPricingMode: 'range',
        deliveryRanges: restaurant.deliveryRanges || DEFAULT_DELIVERY_SLABS,
      },
      'What to enter: Ensure each slab has Min km < Max km (e.g., 0 to 5 km = ₹30, 5 to 10 km = ₹50).'
    );
  };

  const removeDeliveryRange = async (idx: number) => {
    const nextRanges = (restaurant.deliveryRanges || []).filter((_, i) => i !== idx);
    setRestaurant((r) => ({
      ...r,
      deliveryRanges: nextRanges,
    }));
    await persistFieldsToFirestore(
      'Remove Distance Slab',
      { deliveryRanges: nextRanges },
      'Click "+ Add Slab" to add a new distance slab (km → ₹).'
    );
  };

  const handleRequestSellerBrowserGps = async () => {
    setLocatingSellerGps(true);
    setSaveError(null);
    try {
      const gps = await requestLiveGpsLocation({
        uid: user?.uid,
        role: 'seller',
        restaurantId: restaurant.restaurantId || seller?.restaurantId,
        phone: restaurant.phone || seller?.phone || profile?.phone,
      });
      const nextFields: Partial<Restaurant> = {
        address: gps.address || restaurant.address,
        latitude: gps.latitude,
        longitude: gps.longitude,
        googleMapsLink: gps.googleMapsUrl,
        ...(gps.state ? { state: gps.state } : {}),
        ...(gps.city ? { city: gps.city, locality: gps.locality || gps.city } : {}),
        ...(gps.district ? { district: gps.district } : {}),
        ...(gps.pincode ? { postalCode: gps.pincode, pincode: gps.pincode } : {}),
      };
      setRestaurant((r) => ({ ...r, ...nextFields }));
      await persistFieldsToFirestore(
        'Allow Live Phone GPS (Native Browser Popup)',
        nextFields,
        'Live phone GPS coordinates, PIN code, State, City, and District auto-filled and saved to Firestore.'
      );
      setSaveMessage(
        `Live Phone GPS captured (${gps.latitude.toFixed(6)}, ${gps.longitude.toFixed(6)}) & auto-filled: ${
          gps.city || ''
        } ${gps.pincode ? `- PIN ${gps.pincode}` : ''}`
      );
      setTimeout(() => setSaveMessage(null), 4000);
    } catch (err: any) {
      setSaveError(
        err?.message ||
          'Please allow Location access in your browser popup to auto-fill live coordinates and PIN code.'
      );
    } finally {
      setLocatingSellerGps(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'restaurant') {
      const lat = Number(restaurant.latitude);
      const lng = Number(restaurant.longitude);
      if (!lat || !lng || isLegacyFakeCoordinate(lat, lng) || !restaurant.pincode) {
        handleRequestSellerBrowserGps();
      }
    }
  }, [activeTab]);

  const handleAutoFillFromPin = async () => {
    const pinOrCity = (restaurant.postalCode || restaurant.pincode || restaurant.city || '').trim();
    if (!pinOrCity) {
      await handleRequestSellerBrowserGps();
      return;
    }
    setLookingUpPin(true);
    try {
      const resolved = await lookupLocationByPinOrCity(pinOrCity);
      const nextFields: Partial<Restaurant> = {
        state: resolved.state || restaurant.state,
        city: resolved.city || restaurant.city,
        locality: resolved.city || restaurant.locality,
        district: resolved.district || restaurant.district,
        postalCode: resolved.pincode || pinOrCity,
        pincode: resolved.pincode || pinOrCity,
        address: resolved.address || restaurant.address,
        latitude: resolved.latitude,
        longitude: resolved.longitude,
        googleMapsLink: resolved.googleMapsUrl,
      };
      setRestaurant((r) => ({ ...r, ...nextFields }));
      const ok = await persistFieldsToFirestore(
        'Auto-Fill & Sync Location from PIN Code',
        nextFields,
        'What to enter: Enter any 6-digit Indian PIN code.'
      );
      if (ok) {
        setSaveMessage(
          `Auto-filled & saved to DB: ${nextFields.city}, ${nextFields.district}, ${nextFields.state} - ${nextFields.pincode}`
        );
        setTimeout(() => setSaveMessage(null), 4000);
      }
    } finally {
      setLookingUpPin(false);
    }
  };

  const updateOpeningHours = (day: string, field: 'open' | 'close' | 'isClosed', value: any) => {
    setRestaurant((r) => {
      const currentHours = r.openingHours || DEFAULT_OPENING_HOURS;
      const dayObj = currentHours[day] || { open: '09:00', close: '22:00', isClosed: false };
      return {
        ...r,
        openingHours: {
          ...currentHours,
          [day]: {
            ...dayObj,
            [field]: value,
          },
        },
      };
    });
  };

  const handleSaveRestaurant = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveError(null);
    setSaveMessage(null);

    if (!user) {
      setSaveError('You must be signed in as a Seller to save restaurant settings.');
      return;
    }

    const suggestions: string[] = [];
    const cleanPhone = (restaurant.phone || '').trim();
    const cleanPin = (restaurant.postalCode || restaurant.pincode || '').trim();
    const cleanState = (restaurant.state || '').trim();
    const cleanCity = (restaurant.city || restaurant.locality || '').trim();
    const cleanDistrict = (restaurant.district || '').trim();

    if (!cleanPhone || cleanPhone.replace(/\D/g, '').length < 10) {
      suggestions.push('CONTACT PHONE: Enter a valid 10-digit number (e.g. +91 9876543210).');
    }
    if (!cleanState) {
      suggestions.push('STATE: Enter your state name (e.g. Delhi, Maharashtra, Karnataka).');
    }
    if (!cleanCity) {
      suggestions.push('CITY: Enter your city name (e.g. New Delhi, Mumbai, Bengaluru).');
    }
    if (!cleanDistrict) {
      suggestions.push('DISTRICT: Enter your district name (e.g. Central Delhi, Mumbai Suburban).');
    }
    if (!cleanPin || !/^\d{6}$/.test(cleanPin)) {
      suggestions.push('PIN CODE: Enter a 6-digit Indian PIN code (e.g. 110001, 400001, 560001).');
    }

    setSavingProfile(true);
    try {
      const restId = restaurant.restaurantId || seller?.restaurantId || `rest_${user.uid}`;
      const payloadToSave: Partial<Restaurant> = {
        restaurantId: restId,
        sellerId: user.uid,
        restaurantName: (restaurant.restaurantName || 'Food India Kitchen').trim(),
        phone: cleanPhone || '+91 9876543210',
        description: restaurant.description || '',
        preparationTime: restaurant.preparationTime || '25-35 mins',
        address:
          restaurant.address ||
          `${cleanCity || 'New Delhi'}, ${cleanDistrict || 'Central Delhi'}, ${cleanState || 'Delhi'} - ${
            cleanPin || '110001'
          }`,
        state: cleanState || 'Delhi',
        city: cleanCity || 'New Delhi',
        locality: cleanCity || 'New Delhi',
        district: cleanDistrict || 'Central Delhi',
        postalCode: cleanPin || '110001',
        pincode: cleanPin || '110001',
        latitude: Number(restaurant.latitude) || 28.6139,
        longitude: Number(restaurant.longitude) || 77.2090,
        googleMapsLink:
          restaurant.googleMapsLink ||
          getGoogleMapsCoordUrl(Number(restaurant.latitude) || 28.6139, Number(restaurant.longitude) || 77.2090),
        allowOwnDeliveryStaff: restaurant.allowOwnDeliveryStaff !== false,
        deliveryPricingMode: restaurant.deliveryPricingMode || 'base_km',
        baseDeliveryCharge: Number(restaurant.baseDeliveryCharge ?? 25),
        deliveryPricePerKm: Number(restaurant.deliveryPricePerKm ?? 8),
        deliveryRanges:
          Array.isArray(restaurant.deliveryRanges) && restaurant.deliveryRanges.length > 0
            ? restaurant.deliveryRanges
            : DEFAULT_DELIVERY_SLABS,
        openingHours: restaurant.openingHours || DEFAULT_OPENING_HOURS,
        isOpen: restaurant.isOpen !== false,
        approvalStatus: restaurant.approvalStatus || 'approved',
      };

      const ok = await persistFieldsToFirestore(
        'SAVE KITCHEN, DELIVERY & HOURS',
        payloadToSave,
        suggestions.length > 0
          ? `Saved with auto-defaults! Suggestions to refine: ${suggestions.join(' | ')}`
          : 'All fields (Contact Phone, State, City, District, PIN Code, Own Delivery Staff, Pricing Mode, Distance Slabs & Hours) are valid and synced to Firestore!'
      );

      if (ok) {
        setRestaurant((r) => ({ ...r, ...payloadToSave }));
        setSaveMessage(
          suggestions.length > 0
            ? `Saved to Firestore! Tip: ${suggestions[0]}`
            : 'Kitchen Profile, Contact Phone, State/City/District/PIN, Delivery Slabs & Opening Hours saved to Database!'
        );
        setTimeout(() => setSaveMessage(null), 5000);
      }
    } finally {
      setSavingProfile(false);
    }
  };

  const handleDashboardDocUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setUploadingDoc(true);
    try {
      const res = await uploadSellerDocumentFast({
        uid: user.uid,
        documentType: selectedDocType,
        file,
        businessLicenseNumber,
        fssaiLicenseNumber,
        aadhaarOrPanNumber,
        sellerName: seller?.ownerName || profile?.fullName || restaurant.restaurantName,
        sellerEmail: user.email || '',
        sellerPhone: restaurant.phone || seller?.phone || '',
        restaurantId: restaurant.restaurantId,
        restaurantName: restaurant.restaurantName,
      });
      setSaveMessage(
        `Uploaded ${getDocTypeLabel(selectedDocType)} ("${res.fileName}") to Firestore & Admin Dashboard in ${res.durationMs}ms!`
      );
      setTimeout(() => setSaveMessage(null), 4000);
    } catch (err: any) {
      setSaveError(err?.message || 'Document upload failed.');
    } finally {
      setUploadingDoc(false);
      if (docFileInputRef.current) {
        docFileInputRef.current.value = '';
      }
    }
  };

  const handleQuickSampleDocUpload = async () => {
    if (!user) return;
    setUploadingDoc(true);
    try {
      const file = createValidSamplePdfFile(`${selectedDocType}_fast.pdf`, [
        'Food India Official KYC Document',
        `Seller: ${user.uid}`,
        `Restaurant: ${restaurant.restaurantName}`,
        `Type: ${getDocTypeLabel(selectedDocType)}`,
        `Business License / GST: ${businessLicenseNumber || '27AABCU9603R1ZM'}`,
        `FSSAI License: ${fssaiLicenseNumber || '11523001000456'}`,
        `Aadhaar / PAN: ${aadhaarOrPanNumber || 'ABCDE1234F'}`,
        `Timestamp: ${new Date().toISOString()}`,
      ]);
      const res = await uploadSellerDocumentFast({
        uid: user.uid,
        documentType: selectedDocType,
        file,
        businessLicenseNumber: businessLicenseNumber || '27AABCU9603R1ZM',
        fssaiLicenseNumber: fssaiLicenseNumber || '11523001000456',
        aadhaarOrPanNumber: aadhaarOrPanNumber || 'ABCDE1234F',
        sellerName: seller?.ownerName || profile?.fullName || restaurant.restaurantName,
        sellerEmail: user.email || '',
        sellerPhone: restaurant.phone || seller?.phone || '',
        restaurantId: restaurant.restaurantId,
        restaurantName: restaurant.restaurantName,
      });
      setSaveMessage(
        `Instant ${getDocTypeLabel(selectedDocType)} uploaded & linked to Admin Dashboard in ${res.durationMs}ms!`
      );
      setTimeout(() => setSaveMessage(null), 4000);
    } catch (err: any) {
      setSaveError(err?.message || 'Sample document upload failed.');
    } finally {
      setUploadingDoc(false);
    }
  };

  const handleDeleteProduct = async (productId: string, productName?: string) => {
    const backendPath = `Firestore: products/${productId}`;
    try {
      await productService.deleteProduct(productId);
      setSaveMessage(`Deleted product${productName ? ` "${productName}"` : ''} successfully.`);
      reportGlobalButtonStatus({
        buttonName: `Delete Product (${productName || productId})`,
        backendPath,
        dbUpdated: 'UPDATED',
        statusType: 'success',
        message: `Deleted product "${productName || productId}" from Firestore.`,
        suggestion: 'Click "Add Product" or "Load Indian Test Products" to add dishes.',
      });
      setTimeout(() => setSaveMessage(null), 3000);
    } catch (err: any) {
      setSaveMessage(err?.message || 'Failed to delete product.');
      reportGlobalError(err?.message || 'Failed to delete product', err?.stack, 'backend', {
        buttonName: 'Delete Product',
        backendPath,
        dbUpdated: 'NOT_UPDATED',
        statusType: 'error',
      });
      setTimeout(() => setSaveMessage(null), 3500);
    }
  };

  const handleSeedSellerTestProducts = async () => {
    if (!user) return;
    setSeedingMenu(true);
    try {
      const res = await seedIndianTestProducts({
        sellerId: user.uid,
        restaurantId: restaurant?.restaurantId || seller?.restaurantId,
        force: true,
      });
      const msg = `Added ${res.productsSeeded} Indian test products across ${res.categoriesSeeded} categories!`;
      setSaveMessage(msg);
      reportGlobalButtonStatus({
        buttonName: 'Load Indian Test Products',
        backendPath: 'Firestore: categories & products',
        dbUpdated: 'UPDATED',
        statusType: 'success',
        message: msg,
        suggestion: 'You can edit or delete any test product using the Delete button on each card.',
      });
      setTimeout(() => setSaveMessage(null), 4000);
    } catch (err: any) {
      setSaveMessage(err?.message || 'Failed to add Indian test products.');
      setTimeout(() => setSaveMessage(null), 4000);
    } finally {
      setSeedingMenu(false);
    }
  };

  const handleDeleteSellerTestProducts = async () => {
    if (!user) return;
    setSeedingMenu(true);
    try {
      const deletedCount = await deleteAllTestProducts(user.uid);
      const msg = `Deleted ${deletedCount} test product(s) from your menu.`;
      setSaveMessage(msg);
      reportGlobalButtonStatus({
        buttonName: 'Delete Test Products',
        backendPath: 'Firestore: products (where isTestProduct == true)',
        dbUpdated: 'UPDATED',
        statusType: 'success',
        message: msg,
        suggestion: 'Click "Load Indian Test Products" anytime to restore sample dishes.',
      });
      setTimeout(() => setSaveMessage(null), 3500);
    } catch (err: any) {
      setSaveMessage(err?.message || 'Failed to delete test products.');
      setTimeout(() => setSaveMessage(null), 3500);
    } finally {
      setSeedingMenu(false);
    }
  };

  const handleToggleProductAvailability = async (product: Product) => {
    try {
      await updateDoc(doc(db, 'products', product.productId), {
        isAvailable: !product.isAvailable,
        updatedAt: serverTimestamp(),
      });
      reportGlobalButtonStatus({
        buttonName: `Toggle Product Stock (${product.name})`,
        backendPath: `Firestore: products/${product.productId}`,
        dbUpdated: 'UPDATED',
        statusType: 'success',
        message: `"${product.name}" marked as ${!product.isAvailable ? 'In Stock' : 'Sold Out'} in Firestore.`,
      });
    } catch (err: any) {
      reportGlobalError(err?.message || 'Error toggling availability', err?.stack, 'backend', {
        buttonName: `Toggle Product Stock (${product.name})`,
        backendPath: `Firestore: products/${product.productId}`,
        dbUpdated: 'NOT_UPDATED',
        statusType: 'error',
      });
    }
  };

  const handleLogout = async () => {
    await authService.logout();
    navigate('/welcome');
  };

  const filteredOrders = useMemo(() => {
    let list = orders;
    if (todayOnlyFilter) {
      const todayStr = new Date().toDateString();
      list = list.filter(
        (o) => (o.createdAt?.toDate ? o.createdAt.toDate() : new Date()).toDateString() === todayStr
      );
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (o) =>
          o.orderNumber?.toLowerCase().includes(q) ||
          o.customerName?.toLowerCase().includes(q) ||
          o.customerPhone?.toLowerCase().includes(q)
      );
    }
    if (orderFilter === 'all') return list;
    if (orderFilter === 'completed') return list.filter((o) => o.orderStatus === 'delivered' || o.orderStatus === 'completed');
    return list.filter((o) => o.orderStatus === orderFilter);
  }, [orders, orderFilter, todayOnlyFilter, searchQuery]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
      </div>
    );
  }

  // --- Sub-Views ---

  const renderOverview = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-orange-500 rounded-3xl p-5 text-white shadow-lg shadow-orange-100 relative overflow-hidden">
          <TrendingUp className="absolute -right-4 -bottom-4 w-24 h-24 text-white/10" />
          <p className="text-orange-100 text-[10px] font-bold uppercase tracking-widest">Today's COD Sales</p>
          <h2 className="text-3xl font-black mt-1">₹{stats.revenueToday.toFixed(0)}</h2>
          <p className="text-xs text-orange-100 mt-2 font-bold">{stats.ordersToday} Orders Today</p>
        </div>
        <button
          onClick={() => {
            setActiveTab('orders');
            setOrderFilter('pending');
          }}
          className="bg-white rounded-3xl p-5 border border-slate-100 shadow-sm text-left hover:border-orange-300 transition-colors"
        >
          <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">New Orders</p>
          <h2 className="text-3xl font-black mt-1 text-slate-900">{stats.pendingOrders}</h2>
          <p className="text-xs text-orange-500 mt-2 font-bold">Tap to Review →</p>
        </button>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <button
          onClick={() => navigate('/seller/verification')}
          className="bg-slate-900 rounded-3xl p-5 text-white shadow-lg text-left"
        >
          <div className="flex items-center gap-2 mb-2">
            <ShieldCheck
              className={`w-4 h-4 ${
                seller?.verificationStatus === 'verified' ? 'text-green-400' : 'text-orange-400'
              }`}
            />
            <span className="text-[10px] font-bold text-slate-400 uppercase">Verification</span>
          </div>
          <p className="font-bold capitalize">{seller?.verificationStatus || 'Pending'}</p>
          <p className="text-[10px] text-slate-400 mt-1">
            Documents: {documents.length} uploaded • Restaurant: {restaurant?.approvalStatus || 'pending'}
          </p>
        </button>
        <button
          onClick={() => navigate('/seller/subscription')}
          className="bg-indigo-600 rounded-3xl p-5 text-white shadow-lg text-left"
        >
          <div className="flex items-center gap-2 mb-2">
            <CreditCard className="w-4 h-4 text-indigo-200" />
            <span className="text-[10px] font-bold text-indigo-200 uppercase">Subscription</span>
          </div>
          <p className="font-bold capitalize">
            {seller?.subscriptionStatus === 'active' ? 'Active Plan' : 'Subscribe Now'}
          </p>
          <p className="text-[10px] text-indigo-200 mt-1">0% Commission Model</p>
        </button>
      </div>

      <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="font-black text-slate-900">Recent Live Orders</h3>
          <button
            onClick={() => setActiveTab('orders')}
            className="text-orange-500 text-xs font-bold uppercase"
          >
            View All
          </button>
        </div>
        <div className="space-y-4">
          {orders.slice(0, 5).map((order) => (
            <div
              key={order.orderId}
              onClick={() => {
                setActiveTab('orders');
                setOrderFilter(order.orderStatus === 'delivered' ? 'completed' : order.orderStatus);
              }}
              className="flex items-center gap-4 cursor-pointer hover:bg-slate-50 p-2 -mx-2 rounded-2xl transition-colors"
            >
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                  order.orderStatus === 'pending'
                    ? 'bg-orange-50 text-orange-500'
                    : order.orderStatus === 'delivered'
                    ? 'bg-green-50 text-green-500'
                    : 'bg-blue-50 text-blue-500'
                }`}
              >
                <Package size={20} />
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="font-bold text-slate-900 truncate">
                  ₹{order.totalAmount} (COD) • {order.customerName}
                </h4>
                <p className="text-[10px] text-slate-400 font-bold uppercase">
                  #{order.orderNumber} • {order.orderStatus.replace(/_/g, ' ')}
                </p>
              </div>
              <span className="text-[10px] font-bold text-slate-400 uppercase">
                {order.createdAt?.toDate ? format(order.createdAt.toDate(), 'HH:mm') : 'Now'}
              </span>
            </div>
          ))}
          {orders.length === 0 && (
            <p className="text-center py-4 text-slate-400 italic text-sm">No orders received yet.</p>
          )}
        </div>
      </div>
    </div>
  );

  const orderFilterTabs: { id: OrderFilter; label: string }[] = [
    { id: 'all', label: `All (${orders.length})` },
    { id: 'pending', label: `New (${orders.filter((o) => o.orderStatus === 'pending').length})` },
    { id: 'confirmed', label: `Accepted (${orders.filter((o) => o.orderStatus === 'confirmed').length})` },
    { id: 'preparing', label: `Preparing (${orders.filter((o) => o.orderStatus === 'preparing').length})` },
    { id: 'ready_for_pickup', label: `Ready (${orders.filter((o) => o.orderStatus === 'ready_for_pickup').length})` },
    { id: 'out_for_delivery', label: `Out for Delivery (${orders.filter((o) => o.orderStatus === 'out_for_delivery').length})` },
    { id: 'completed', label: `Completed (${orders.filter((o) => o.orderStatus === 'delivered' || o.orderStatus === 'completed').length})` },
    { id: 'cancelled', label: `Cancelled (${orders.filter((o) => o.orderStatus === 'cancelled').length})` },
  ];

  const renderOrders = () => (
    <div className="space-y-4 pb-20">
      <div className="sticky top-0 z-10 bg-slate-50/95 backdrop-blur-md py-2 -mx-4 px-4">
        <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
          {orderFilterTabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setOrderFilter(tab.id)}
              className={`px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest whitespace-nowrap transition-all border ${
                orderFilter === tab.id
                  ? 'bg-orange-500 border-orange-500 text-white shadow-lg shadow-orange-200'
                  : 'bg-white border-slate-200 text-slate-500'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        {filteredOrders.map((order) => (
          <div
            key={order.orderId}
            className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden"
          >
            <div className="p-5 space-y-4">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest">
                    Order #{order.orderNumber}
                  </p>
                  <h4 className="text-xl font-black text-slate-900 mt-0.5">
                    Final COD: <span className="text-orange-600">₹{order.totalAmount}</span>
                  </h4>
                </div>
                <div
                  className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                    order.orderStatus === 'pending'
                      ? 'bg-orange-100 text-orange-600'
                      : order.orderStatus === 'delivered'
                      ? 'bg-green-100 text-green-600'
                      : order.orderStatus === 'cancelled'
                      ? 'bg-red-100 text-red-600'
                      : 'bg-blue-100 text-blue-600'
                  }`}
                >
                  {order.orderStatus.replace(/_/g, ' ')}
                </div>
              </div>

              <div className="bg-slate-50 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    Customer Details & Cell Number
                  </p>
                  <p className="text-sm font-bold text-slate-900 mt-0.5">{order.customerName}</p>
                  <p className="text-xs font-mono font-bold text-orange-600 mt-0.5">
                    Cell: {order.customerPhone || 'Not provided'}
                  </p>
                  {order.customerEmail && (
                    <p className="text-[11px] text-slate-500">{order.customerEmail}</p>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {order.customerPhone && (
                    <a
                      href={`tel:${order.customerPhone}`}
                      className="px-3 py-2 bg-white rounded-xl flex items-center gap-1.5 text-xs font-bold text-orange-600 shadow-sm border border-slate-100 hover:bg-orange-50"
                    >
                      <Phone size={14} />
                      Call
                    </a>
                  )}
                  <a
                    href={buildOrderSmsInboxUrl({
                      targetPhone: ADMIN_AND_ORDER_SMS_NUMBER,
                      order,
                      headline: `Order #${order.orderNumber} (${restaurant?.restaurantName || 'Kitchen'})`,
                    })}
                    className="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl flex items-center gap-1.5 text-xs font-bold shadow-sm"
                    title="Send Customer Name, Phone, Address & Google Maps Link to Phone SMS Inbox (+918825028335)"
                  >
                    <MessageSquare size={14} />
                    SMS (+918825028335)
                  </a>
                  <a
                    href={buildOrderWhatsAppUrl({
                      targetPhone: order.customerPhone,
                      order,
                      headline: `Order #${order.orderNumber} Update from ${
                        restaurant?.restaurantName || 'Kitchen'
                      }`,
                    })}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded-xl flex items-center gap-1.5 text-xs font-bold shadow-sm"
                  >
                    <MessageCircle size={14} />
                    WhatsApp
                  </a>
                  <a
                    href={buildOrderMailtoUrl({
                      targetEmail: order.customerEmail || '',
                      order,
                      headline: `Order #${order.orderNumber} Update`,
                    })}
                    className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl flex items-center gap-1.5 text-xs font-bold shadow-sm"
                  >
                    <Mail size={14} />
                    Email
                  </a>
                </div>
              </div>

              <div className="space-y-2 border-t border-slate-100 pt-3">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  Products & Add-ons
                </p>
                {(order.itemsSnapshot || []).map((item: any, i: number) => (
                  <div key={i} className="flex justify-between text-sm items-start py-1">
                    <div className="flex items-start gap-2.5">
                      <span className="px-2 py-0.5 bg-orange-50 text-orange-700 rounded-md text-xs font-black shrink-0">
                        {item.quantity}x
                      </span>
                      <div>
                        <span className="text-slate-900 font-bold">{item.name}</span>
                        {item.variant && (
                          <p className="text-xs text-slate-500 font-medium">
                            Variant: {item.variant.name} (+₹{item.variant.price})
                          </p>
                        )}
                        {item.selectedAddOns && item.selectedAddOns.length > 0 && (
                          <p className="text-xs text-slate-500">
                            Add-ons:{' '}
                            {item.selectedAddOns
                              .map((a: any) => `${a.option.name} (+₹${a.option.price})`)
                              .join(', ')}
                          </p>
                        )}
                      </div>
                    </div>
                    <span className="text-slate-800 font-bold shrink-0">₹{item.lineTotal}</span>
                  </div>
                ))}
              </div>

              <div className="bg-slate-50/70 rounded-2xl p-3.5 space-y-1.5 text-xs border border-slate-100">
                <div className="flex justify-between text-slate-500 font-medium">
                  <span>Item Subtotal</span>
                  <span>₹{Number(order.itemSubtotal || 0).toFixed(2)}</span>
                </div>
                {order.gstEnabled && Number(order.gstAmount || 0) > 0 && (
                  <div className="flex justify-between text-emerald-700 font-bold bg-emerald-50/70 px-2.5 py-1 rounded-lg border border-emerald-200">
                    <span>GST (5% Govt. Tax - Admin Approved Seller)</span>
                    <span>₹{Number(order.gstAmount).toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between text-slate-500 font-medium">
                  <span>Delivery Fee</span>
                  <span>₹{Number(order.deliveryCharge || 0).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-slate-900 font-black text-sm pt-1 border-t border-slate-200/60">
                  <span>Final COD Bill (Seller & Customer)</span>
                  <span className="text-orange-600">₹{Number(order.totalAmount || 0).toFixed(2)}</span>
                </div>
              </div>

              <div className="pt-2 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-start gap-2 min-w-0">
                  <MapPin className="w-4 h-4 text-orange-500 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                      Delivery Address
                    </p>
                    <p className="text-xs text-slate-700 font-medium">
                      {order.addressSnapshot?.formattedAddress}
                    </p>
                    {order.addressSnapshot?.latitude && (
                      <p className="text-[11px] font-mono font-bold text-slate-500 mt-0.5">
                        GPS: {order.addressSnapshot.latitude.toFixed(6)},{' '}
                        {order.addressSnapshot.longitude.toFixed(6)}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                  {order.addressSnapshot?.latitude && (
                    <a
                      href={getGoogleMapsCoordUrl(
                        order.addressSnapshot.latitude,
                        order.addressSnapshot.longitude
                      )}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="bg-blue-600 text-white px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-1 hover:bg-blue-700 transition-colors"
                    >
                      Open in Maps <ExternalLink size={11} />
                    </a>
                  )}
                  <a
                    href={
                      order.addressSnapshot?.googleMapsLink ||
                      `https://www.google.com/maps/dir/?api=1&destination=${order.addressSnapshot?.latitude},${order.addressSnapshot?.longitude}`
                    }
                    target="_blank"
                    rel="noopener noreferrer"
                    className="bg-blue-50 text-blue-600 px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-1 hover:bg-blue-100 transition-colors"
                  >
                    Directions <Navigation size={11} />
                  </a>
                </div>
              </div>

              {order.statusHistory && order.statusHistory.length > 0 && (
                <div className="pt-2 border-t border-slate-100 space-y-1">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                    Status History Timestamps
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {order.statusHistory.map((h, idx) => (
                      <span
                        key={idx}
                        className="text-[10px] bg-slate-50 border border-slate-100 text-slate-600 px-2 py-0.5 rounded-lg font-medium"
                      >
                        <strong className="uppercase">{h.status.replace(/_/g, ' ')}:</strong>{' '}
                        {new Date(h.timestamp).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="bg-slate-50 rounded-2xl p-3.5 border border-slate-100 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Truck size={15} className="text-orange-500" />
                    <div>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                        Delivery Method
                      </p>
                      <p className="text-xs font-bold text-slate-900">
                        {order.selectedDeliveryProviderName || "Restaurant's Own Delivery Staff"}
                      </p>
                    </div>
                  </div>
                  <span
                    className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-md ${
                      order.deliveryBookingStatus === 'delivered'
                        ? 'bg-green-100 text-green-700'
                        : order.deliveryBookingStatus === 'failed' ||
                          order.deliveryBookingStatus === 'cancelled'
                        ? 'bg-red-100 text-red-600'
                        : order.deliveryBookingId
                        ? 'bg-blue-100 text-blue-700'
                        : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    {(order.deliveryBookingStatus || 'awaiting_acceptance').replace(/_/g, ' ')}
                  </span>
                </div>

                {order.deliveryTrackingRef && (
                  <div className="flex flex-wrap items-center justify-between text-[11px] text-slate-600 pt-1 border-t border-slate-200/60">
                    <span>
                      Booking Ref: <strong className="font-mono">{order.deliveryProviderBookingRef}</strong>
                    </span>
                    <span>
                      Tracking:{' '}
                      <strong className="font-mono text-orange-600">{order.deliveryTrackingRef}</strong>
                    </span>
                  </div>
                )}

                {order.orderStatus !== 'pending' &&
                  order.orderStatus !== 'cancelled' &&
                  order.orderStatus !== 'delivered' && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {(!order.deliveryBookingId ||
                        order.deliveryBookingStatus === 'failed' ||
                        order.deliveryBookingStatus === 'cancelled' ||
                        order.deliveryBookingStatus === 'ready_to_book') && (
                        <>
                          <button
                            type="button"
                            onClick={() => handleSellerDispatchDelivery(order)}
                            className="px-3 py-1.5 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-wider hover:bg-orange-500 transition-colors"
                          >
                            Dispatch Selected Delivery
                          </button>
                          {order.selectedDeliveryProviderType !== 'restaurant_staff' &&
                            restaurant?.allowOwnDeliveryStaff !== false && (
                              <button
                                type="button"
                                onClick={() => handleSellerDispatchDelivery(order, 'restaurant_staff')}
                                className="px-3 py-1.5 bg-white border border-slate-200 text-slate-700 rounded-xl text-[10px] font-bold uppercase tracking-wider hover:bg-slate-100"
                              >
                                Fallback to Kitchen Staff
                              </button>
                            )}
                        </>
                      )}
                      {order.deliveryBookingId &&
                        order.selectedDeliveryProviderType !== 'restaurant_staff' && (
                          <>
                            <button
                              type="button"
                              onClick={() => handleSellerWebhookUpdate(order, 'picked_up')}
                              className="px-2.5 py-1 bg-indigo-50 text-indigo-700 rounded-lg text-[10px] font-bold uppercase"
                            >
                              Webhook: Picked Up
                            </button>
                            <button
                              type="button"
                              onClick={() => handleSellerWebhookUpdate(order, 'delivered')}
                              className="px-2.5 py-1 bg-emerald-50 text-emerald-700 rounded-lg text-[10px] font-bold uppercase"
                            >
                              Webhook: Delivered
                            </button>
                          </>
                        )}
                    </div>
                  )}
              </div>

              <div className="flex gap-2 pt-2">
                {order.orderStatus === 'pending' && (
                  <>
                    <button
                      onClick={() => handleUpdateStatus(order.orderId, 'cancelled')}
                      className="flex-1 h-12 rounded-2xl bg-red-50 text-red-600 font-black text-xs uppercase tracking-widest hover:bg-red-100 transition-colors"
                    >
                      Reject Order
                    </button>
                    <button
                      onClick={() => handleUpdateStatus(order.orderId, 'confirmed')}
                      className="flex-[2] h-12 rounded-2xl bg-orange-500 text-white font-black text-xs uppercase tracking-widest shadow-lg shadow-orange-100 hover:bg-orange-600 transition-colors"
                    >
                      Accept Order
                    </button>
                  </>
                )}
                {order.orderStatus === 'confirmed' && (
                  <button
                    onClick={() => handleUpdateStatus(order.orderId, 'preparing')}
                    className="w-full h-12 rounded-2xl bg-indigo-500 text-white font-black text-xs uppercase tracking-widest"
                  >
                    Mark as Preparing
                  </button>
                )}
                {order.orderStatus === 'preparing' && (
                  <button
                    onClick={() => handleUpdateStatus(order.orderId, 'ready_for_pickup')}
                    className="w-full h-12 rounded-2xl bg-indigo-600 text-white font-black text-xs uppercase tracking-widest"
                  >
                    Mark Ready for Pickup
                  </button>
                )}
                {order.orderStatus === 'ready_for_pickup' && (
                  <button
                    onClick={() => handleUpdateStatus(order.orderId, 'out_for_delivery')}
                    className="w-full h-12 rounded-2xl bg-purple-600 text-white font-black text-xs uppercase tracking-widest"
                  >
                    Mark Out for Delivery
                  </button>
                )}
                {order.orderStatus === 'out_for_delivery' && (
                  <button
                    onClick={() => handleUpdateStatus(order.orderId, 'delivered')}
                    className="w-full h-12 rounded-2xl bg-green-600 text-white font-black text-xs uppercase tracking-widest"
                  >
                    Complete Delivery (COD Collected)
                  </button>
                )}
                {(order.orderStatus === 'delivered' || order.orderStatus === 'completed') && (
                  <div className="w-full h-12 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2">
                    <CheckCircle2 size={16} className="text-emerald-600" />
                    <span>Order Completed • COD Collected (₹{order.totalAmount})</span>
                  </div>
                )}
                {order.orderStatus === 'cancelled' && (
                  <div className="w-full h-12 rounded-2xl bg-red-50 border border-red-200 text-red-700 font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2">
                    <span>Order Cancelled</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
        {filteredOrders.length === 0 && (
          <div className="py-20 text-center space-y-4">
            <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mx-auto text-slate-300">
              <ClipboardList size={32} />
            </div>
            <p className="text-slate-400 font-medium italic">
              No {orderFilter.replace(/_/g, ' ')} orders found.
            </p>
          </div>
        )}
      </div>
    </div>
  );

  const filteredSellerProducts =
    selectedSellerCategory === 'all'
      ? products
      : products.filter((p) => p.categoryId === selectedSellerCategory);

  const renderMenu = () => (
    <div className="space-y-6 pb-20">
      <div className="flex flex-wrap justify-between items-center gap-3 px-1">
        <div>
          <h3 className="font-black text-slate-900">Menu Products, Categories & Add-ons</h3>
          <p className="text-[11px] text-slate-400 font-bold">
            Upload your authentic dishes, configure variants, pricing, and dietary types
          </p>
        </div>
        <button
          onClick={() => navigate('/seller/add-product')}
          className="bg-orange-500 text-white px-4 py-3 rounded-2xl shadow-lg shadow-orange-100 flex items-center gap-2 hover:bg-orange-600 transition-colors"
        >
          <Plus size={18} />
          <span className="text-xs font-black uppercase tracking-widest">Add Product</span>
        </button>
      </div>

      {saveMessage && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-2xl text-xs font-bold flex items-center gap-2">
          <CheckCircle2 size={16} className="shrink-0" />
          <span>{saveMessage}</span>
        </div>
      )}

      {products.some((p) => p.isTestProduct || p.productId.startsWith('test_prod_')) && (
        <div className="bg-red-50 border border-red-200 rounded-3xl p-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-black text-red-900 uppercase tracking-wider">
              Residual Test Data Detected
            </p>
            <p className="text-[11px] text-red-700 font-medium">
              Click below to permanently purge all sample dishes from your menu.
            </p>
          </div>
          <button
            type="button"
            disabled={seedingMenu}
            onClick={handleDeleteSellerTestProducts}
            className="px-3.5 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-xl text-[11px] font-black uppercase tracking-wider flex items-center gap-1.5 transition-colors shadow-sm"
          >
            <Trash2 size={13} />
            {seedingMenu ? 'Purging...' : 'Purge All Test Dishes'}
          </button>
        </div>
      )}

      <div className="bg-white rounded-3xl p-2 border border-slate-100 shadow-sm flex">
        <button
          onClick={() => setMenuSubTab('products')}
          className={`flex-1 py-3 rounded-2xl text-[10px] font-bold uppercase tracking-widest transition-colors ${
            menuSubTab === 'products' ? 'bg-slate-900 text-white' : 'text-slate-400'
          }`}
        >
          Products ({products.length})
        </button>
        <button
          onClick={() => setMenuSubTab('categories')}
          className={`flex-1 py-3 rounded-2xl text-[10px] font-bold uppercase tracking-widest transition-colors ${
            menuSubTab === 'categories' ? 'bg-slate-900 text-white' : 'text-slate-400'
          }`}
        >
          Categories ({categories.length})
        </button>
        <button
          onClick={() => setMenuSubTab('addons')}
          className={`flex-1 py-3 rounded-2xl text-[10px] font-bold uppercase tracking-widest transition-colors ${
            menuSubTab === 'addons' ? 'bg-slate-900 text-white' : 'text-slate-400'
          }`}
        >
          Add-ons
        </button>
      </div>

      {menuSubTab === 'products' && (
        <div className="space-y-3">
          {categories.length > 0 && (
            <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
              <button
                type="button"
                onClick={() => setSelectedSellerCategory('all')}
                className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider whitespace-nowrap border ${
                  selectedSellerCategory === 'all'
                    ? 'bg-orange-500 text-white border-orange-500'
                    : 'bg-white text-slate-600 border-slate-200'
                }`}
              >
                All ({products.length})
              </button>
              {categories.map((cat) => {
                const cnt = products.filter((p) => p.categoryId === cat.categoryId).length;
                return (
                  <button
                    key={cat.categoryId}
                    type="button"
                    onClick={() => setSelectedSellerCategory(cat.categoryId)}
                    className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider whitespace-nowrap border ${
                      selectedSellerCategory === cat.categoryId
                        ? 'bg-orange-500 text-white border-orange-500'
                        : 'bg-white text-slate-600 border-slate-200'
                    }`}
                  >
                    {cat.name} ({cnt})
                  </button>
                );
              })}
            </div>
          )}

          {filteredSellerProducts.map((product) => {
            const isTest = Boolean(product.isTestProduct || product.productId?.startsWith('test_prod_'));
            const displayPrice = product.price ?? product.basePrice ?? 0;
            return (
              <div
                key={product.productId}
                className="bg-white p-4 rounded-3xl border border-slate-100 shadow-sm flex items-center gap-4"
              >
                <img
                  src={
                    product.imagePaths?.[0] ||
                    'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=200&h=200&fit=crop'
                  }
                  alt={product.name}
                  className="w-16 h-16 rounded-2xl object-cover bg-slate-50 shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <h4 className="font-bold text-slate-900 truncate">{product.name}</h4>
                    {isTest && (
                      <span className="px-1.5 py-0.5 bg-amber-100 text-amber-800 rounded text-[9px] font-black uppercase shrink-0">
                        Test
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-2 mt-1">
                    <span className="text-sm font-black text-orange-500">₹{displayPrice}</span>
                    <button
                      type="button"
                      onClick={() => handleToggleProductAvailability(product)}
                      className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase ${
                        product.isAvailable ? 'bg-green-50 text-green-600' : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      {product.isAvailable ? 'In Stock' : 'Sold Out'}
                    </button>
                    <span className="text-[10px] text-slate-400 font-bold uppercase">{product.categoryId}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => navigate(`/seller/edit-product/${product.productId}`)}
                    className="p-2.5 bg-slate-50 rounded-xl text-slate-600 hover:bg-slate-100 transition-colors"
                    title="Edit Product"
                  >
                    <Edit3 size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteProduct(product.productId, product.name)}
                    className="px-3 py-2.5 bg-red-50 rounded-xl text-red-600 hover:bg-red-100 transition-colors flex items-center gap-1 text-[10px] font-black uppercase tracking-wider"
                    title="Delete Product"
                  >
                    <Trash2 size={15} />
                    <span>Delete</span>
                  </button>
                </div>
              </div>
            );
          })}
          {filteredSellerProducts.length === 0 && (
            <div className="text-center py-10 bg-white rounded-3xl border border-slate-100 space-y-3">
              <p className="text-slate-400 italic text-sm">No products in this view yet.</p>
              <button
                type="button"
                onClick={handleSeedSellerTestProducts}
                className="px-4 py-2 bg-orange-500 text-white rounded-xl text-xs font-black uppercase tracking-widest"
              >
                Load All Indian Food Test Products
              </button>
            </div>
          )}
        </div>
      )}

      {menuSubTab === 'categories' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <span className="text-xs font-bold text-slate-500">
              All {categories.length} Indian Food Categories Available
            </span>
            <button
              type="button"
              onClick={async () => {
                setSeedingMenu(true);
                await seedCategories(true);
                setSeedingMenu(false);
                setSaveMessage('All 20 Indian food categories synced!');
                setTimeout(() => setSaveMessage(null), 3000);
              }}
              className="text-xs font-black text-orange-600 uppercase tracking-wider"
            >
              Sync All Indian Categories
            </button>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {categories.map((cat) => {
              const count = products.filter((p) => p.categoryId === cat.categoryId).length;
              return (
                <button
                  key={cat.categoryId}
                  type="button"
                  onClick={() => {
                    setSelectedSellerCategory(cat.categoryId);
                    setMenuSubTab('products');
                  }}
                  className="bg-white p-4 rounded-3xl border border-slate-100 shadow-sm flex flex-col items-center gap-2 hover:border-orange-400 transition-colors text-center"
                >
                  <div className="w-14 h-14 bg-slate-50 rounded-2xl overflow-hidden flex items-center justify-center">
                    <img
                      src={
                        cat.imagePath ||
                        'https://images.unsplash.com/photo-1585937421612-70a008356fbe?w=200&h=200&fit=crop'
                      }
                      alt={cat.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <span className="text-xs font-bold text-slate-900">{cat.name}</span>
                  <span className="text-[10px] font-bold text-orange-500 uppercase">{count} Dishes</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {menuSubTab === 'addons' && (
        <div className="space-y-3">
          {products
            .filter((p) => (p.addOnGroups && p.addOnGroups.length > 0) || (p.variants && p.variants.length > 0))
            .map((prod) => (
              <div
                key={prod.productId}
                className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm space-y-3"
              >
                <div className="flex items-center justify-between">
                  <h4 className="font-black text-slate-900 text-sm">{prod.name}</h4>
                  <button
                    onClick={() => navigate(`/seller/edit-product/${prod.productId}`)}
                    className="text-xs font-bold text-orange-600 hover:underline"
                  >
                    Configure Add-ons →
                  </button>
                </div>
                {prod.addOnGroups?.map((g) => (
                  <div key={g.id} className="bg-slate-50 p-3 rounded-2xl text-xs space-y-1">
                    <div className="flex justify-between font-bold text-slate-700">
                      <span>
                        {g.name} ({g.isRequired ? 'Required' : 'Optional'})
                      </span>
                      <span>Max {g.maxSelections}</span>
                    </div>
                    <p className="text-slate-500">
                      {g.options.map((o) => `${o.name} (+₹${o.price})`).join(', ')}
                    </p>
                  </div>
                ))}
              </div>
            ))}
          {products.every((p) => !p.addOnGroups?.length) && (
            <div className="bg-white p-8 rounded-[32px] border border-slate-100 text-center space-y-3">
              <Layers className="mx-auto text-slate-300" size={36} />
              <p className="text-sm text-slate-500 font-bold">
                Configure required & optional add-on groups when adding or editing any product.
              </p>
              <button
                onClick={() => navigate('/seller/add-product')}
                className="px-4 py-2 bg-orange-500 text-white rounded-xl text-xs font-black uppercase tracking-widest"
              >
                Create Product with Add-ons
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );

  const renderRestaurant = () => {
    const restId = restaurant?.restaurantId || seller?.restaurantId || `rest_${user?.uid || 'seller'}`;
    const isSlabsMode = restaurant.deliveryPricingMode === 'range';

    return (
      <div className="space-y-6 pb-20">
        <div className="flex flex-wrap justify-between items-center gap-2 px-1">
          <div>
            <h3 className="font-black text-slate-900">Restaurant Profile, Delivery & Hours</h3>
            <p className="text-[11px] font-mono text-slate-400">
              Linked DB: Firestore restaurants/{restId.slice(0, 12)} & sellers/{user?.uid?.slice(0, 8)}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleToggleStore}
              className={`px-4 py-2 rounded-2xl text-[10px] font-black uppercase tracking-widest border transition-all ${
                restaurant?.isOpen
                  ? 'bg-green-50 text-green-600 border-green-200'
                  : 'bg-slate-50 text-slate-400 border-slate-200'
              }`}
            >
              {restaurant?.isOpen ? 'Store Open' : 'Store Closed'}
            </button>
          </div>
        </div>

        {saveMessage && (
          <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl text-xs font-bold flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
              <span>{saveMessage}</span>
            </div>
          </div>
        )}

        {saveError && (
          <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-2xl text-xs font-bold flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <AlertTriangle size={16} className="text-red-500 shrink-0" />
              <span>{saveError}</span>
            </div>
          </div>
        )}

        <form onSubmit={handleSaveRestaurant} className="space-y-6">
          {/* 1. Restaurant Profile & Contact Phone */}
          <div className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
                <Store size={16} className="text-orange-500" />
                Restaurant Profile & Contact Phone
              </h4>
              <span className="text-[10px] font-mono text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-lg font-bold">
                DB Linked ✓
              </span>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">
                Restaurant Name
              </label>
              <input
                type="text"
                value={restaurant.restaurantName || ''}
                onChange={(e) => setRestaurant((r) => ({ ...r, restaurantName: e.target.value }))}
                onBlur={() =>
                  persistFieldsToFirestore(
                    'Update Restaurant Name',
                    { restaurantName: restaurant.restaurantName },
                    'What to enter: Your kitchen or restaurant brand name (e.g. Royal Spice Kitchen).'
                  )
                }
                placeholder="e.g. Royal Spice Kitchen"
                className="w-full h-13 px-4 bg-slate-50 rounded-2xl text-sm font-bold border border-slate-200 focus:border-orange-500 transition-all outline-none"
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-widest ml-1">
                  CONTACT PHONE
                </label>
                <button
                  type="button"
                  onClick={async () => {
                    const ok = await persistFieldsToFirestore(
                      'Save Contact Phone (CONTACT PHONE)',
                      { phone: restaurant.phone },
                      'What to enter: 10-digit Indian mobile or landline number (e.g. +91 9876543210).'
                    );
                    if (ok) {
                      setSaveMessage(`Contact Phone "${restaurant.phone}" saved to Firestore!`);
                      setTimeout(() => setSaveMessage(null), 3000);
                    }
                  }}
                  className="text-[10px] font-black uppercase tracking-wider text-orange-600 hover:underline"
                >
                  Save Phone to DB →
                </button>
              </div>
              <div className="relative">
                <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-orange-500 w-4 h-4" />
                <input
                  type="tel"
                  value={restaurant.phone || ''}
                  onChange={(e) => setRestaurant((r) => ({ ...r, phone: e.target.value }))}
                  onBlur={() =>
                    persistFieldsToFirestore(
                      'Update Contact Phone (CONTACT PHONE)',
                      { phone: restaurant.phone },
                      'What to enter: 10-digit Indian mobile or landline number (e.g. +91 9876543210).'
                    )
                  }
                  placeholder="+91 9876543210"
                  className="w-full h-13 pl-11 pr-4 bg-slate-50 rounded-2xl text-sm font-bold border border-slate-200 focus:border-orange-500 transition-all outline-none"
                />
              </div>
              <p className="text-[10px] text-slate-400 font-medium ml-1">
                💡 Suggestion: Enter 10-digit mobile/landline (e.g. <strong>+91 9876543210</strong>). Linked to{' '}
                <code className="text-slate-600">restaurants/{restId.slice(0, 8)}.phone</code> &{' '}
                <code className="text-slate-600">sellers/{user?.uid?.slice(0, 8)}.phone</code>
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">
                Description
              </label>
              <textarea
                value={restaurant.description || ''}
                onChange={(e) => setRestaurant((r) => ({ ...r, description: e.target.value }))}
                className="w-full p-4 bg-slate-50 rounded-2xl text-sm font-medium border border-slate-200 focus:border-orange-500 transition-all outline-none min-h-[84px]"
                placeholder="Tell customers about your kitchen specialties..."
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">
                Preparation Time
              </label>
              <input
                type="text"
                value={restaurant.preparationTime || ''}
                onChange={(e) => setRestaurant((r) => ({ ...r, preparationTime: e.target.value }))}
                className="w-full h-12 px-4 bg-slate-50 rounded-2xl text-sm font-bold border border-slate-200 focus:border-orange-500 transition-all outline-none"
                placeholder="e.g. 25-35 mins"
              />
            </div>
          </div>

          {/* 2. Location, STATE, CITY, DISTRICT, PIN CODE, Own Staff & Pricing Mode */}
          <div className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h4 className="text-xs font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
                <MapPin size={16} className="text-orange-500" />
                Delivery Settings, Coverage Area & Live Phone GPS
              </h4>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  disabled={locatingSellerGps}
                  onClick={handleRequestSellerBrowserGps}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center gap-1 transition-colors"
                >
                  {locatingSellerGps ? (
                    <Loader2 size={12} className="animate-spin" />
                  ) : (
                    <Navigation size={12} />
                  )}
                  <span>
                    {locatingSellerGps ? 'Detecting Browser GPS...' : 'Allow Browser Live GPS & Auto-Fill PIN'}
                  </span>
                </button>
                <button
                  type="button"
                  disabled={lookingUpPin}
                  onClick={handleAutoFillFromPin}
                  className="px-3 py-1.5 bg-orange-50 hover:bg-orange-100 text-orange-700 rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center gap-1 transition-colors"
                >
                  {lookingUpPin ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                  Auto-Fill State/City from PIN
                </button>
              </div>
            </div>

            <LocationPicker
              autoLocate={!restaurant.latitude || isLegacyFakeCoordinate(Number(restaurant.latitude), Number(restaurant.longitude))}
              initialLocation={{
                lat: Number(restaurant.latitude) || 20.5937,
                lng: Number(restaurant.longitude) || 78.9629,
              }}
              initialAddress={restaurant.address}
              onLocationSelect={(loc) => {
                const updatedLoc: Partial<Restaurant> = {
                  address: loc.address,
                  latitude: loc.latitude,
                  longitude: loc.longitude,
                  googleMapsLink: loc.googleMapsLink,
                  ...(loc.state ? { state: loc.state } : {}),
                  ...(loc.city ? { city: loc.city, locality: loc.city } : {}),
                  ...(loc.district ? { district: loc.district } : {}),
                  ...(loc.pincode ? { postalCode: loc.pincode, pincode: loc.pincode } : {}),
                };
                setRestaurant((r) => ({
                  ...r,
                  ...updatedLoc,
                }));
                persistFieldsToFirestore(
                  'Select Map / GPS Location',
                  updatedLoc,
                  'GPS coordinates and State/City/District/PIN automatically synced to Firestore.'
                );
              }}
            />

            {/* STATE, CITY, DISTRICT, PIN CODE */}
            <div className="p-4 bg-slate-50/80 rounded-2xl border border-slate-200/80 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-[11px] font-black text-slate-800 uppercase tracking-wider">
                  Service Coverage Location (Linked to Firestore)
                </span>
                <button
                  type="button"
                  onClick={async () => {
                    const ok = await persistFieldsToFirestore(
                      'Save State, City, District & PIN Code',
                      {
                        state: restaurant.state || 'Delhi',
                        city: restaurant.city || restaurant.locality || 'New Delhi',
                        locality: restaurant.city || restaurant.locality || 'New Delhi',
                        district: restaurant.district || 'Central Delhi',
                        postalCode: restaurant.postalCode || restaurant.pincode || '110001',
                        pincode: restaurant.postalCode || restaurant.pincode || '110001',
                      },
                      'What to enter: State (e.g. Delhi), City (e.g. New Delhi), District (e.g. Central Delhi), PIN Code (e.g. 110001).'
                    );
                    if (ok) {
                      setSaveMessage('State, City, District & PIN Code saved to Firestore!');
                      setTimeout(() => setSaveMessage(null), 3000);
                    }
                  }}
                  className="px-3 py-1 bg-slate-900 hover:bg-orange-600 text-white rounded-lg text-[10px] font-black uppercase tracking-wider transition-colors"
                >
                  Save Location Fields to DB
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-600 uppercase">STATE</label>
                  <input
                    type="text"
                    value={restaurant.state || ''}
                    onChange={(e) => setRestaurant((r) => ({ ...r, state: e.target.value }))}
                    onBlur={() =>
                      persistFieldsToFirestore(
                        'Update STATE',
                        { state: restaurant.state },
                        'What to enter: Indian State name (e.g. Delhi, Maharashtra, Karnataka, Jammu and Kashmir).'
                      )
                    }
                    placeholder="e.g. Delhi, Maharashtra"
                    className="w-full h-11 px-3 bg-white rounded-xl text-xs font-bold border border-slate-200 focus:border-orange-500 outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-600 uppercase">CITY</label>
                  <input
                    type="text"
                    value={restaurant.city || restaurant.locality || ''}
                    onChange={(e) =>
                      setRestaurant((r) => ({ ...r, city: e.target.value, locality: e.target.value }))
                    }
                    onBlur={() =>
                      persistFieldsToFirestore(
                        'Update CITY',
                        { city: restaurant.city, locality: restaurant.city },
                        'What to enter: City or town name (e.g. New Delhi, Mumbai, Bengaluru, Srinagar).'
                      )
                    }
                    placeholder="e.g. New Delhi, Mumbai"
                    className="w-full h-11 px-3 bg-white rounded-xl text-xs font-bold border border-slate-200 focus:border-orange-500 outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-600 uppercase">DISTRICT</label>
                  <input
                    type="text"
                    value={restaurant.district || ''}
                    onChange={(e) => setRestaurant((r) => ({ ...r, district: e.target.value }))}
                    onBlur={() =>
                      persistFieldsToFirestore(
                        'Update DISTRICT',
                        { district: restaurant.district },
                        'What to enter: District name (e.g. Central Delhi, Mumbai Suburban, Bengaluru Urban).'
                      )
                    }
                    placeholder="e.g. Central Delhi"
                    className="w-full h-11 px-3 bg-white rounded-xl text-xs font-bold border border-slate-200 focus:border-orange-500 outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-600 uppercase">PIN CODE</label>
                  <div className="flex gap-1.5">
                    <input
                      type="text"
                      value={restaurant.postalCode || restaurant.pincode || ''}
                      onChange={(e) =>
                        setRestaurant((r) => ({
                          ...r,
                          postalCode: e.target.value,
                          pincode: e.target.value,
                        }))
                      }
                      onBlur={() =>
                        persistFieldsToFirestore(
                          'Update PIN CODE',
                          {
                            postalCode: restaurant.postalCode || restaurant.pincode,
                            pincode: restaurant.postalCode || restaurant.pincode,
                          },
                          'What to enter: 6-digit Indian Postal PIN code (e.g. 110001, 400001, 560001).'
                        )
                      }
                      placeholder="e.g. 110001"
                      className="flex-1 h-11 px-3 bg-white rounded-xl text-xs font-bold border border-slate-200 focus:border-orange-500 outline-none"
                    />
                    <button
                      type="button"
                      disabled={lookingUpPin}
                      onClick={handleAutoFillFromPin}
                      className="px-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-[10px] font-black uppercase shrink-0"
                      title="Lookup PIN Code and auto-fill State, City & District"
                    >
                      {lookingUpPin ? '...' : 'Lookup'}
                    </button>
                  </div>
                </div>
              </div>
              <p className="text-[10px] text-slate-500 font-medium">
                💡 What to enter: Enter a 6-digit PIN Code (e.g. <strong>110001</strong>, <strong>400001</strong>, <strong>560001</strong>, <strong>190001</strong>) and tap <strong>Lookup</strong> to auto-populate State, City & District.
              </p>
            </div>

            {/* Allow Restaurant's Own Delivery Staff */}
            <div className="p-4 bg-slate-50/80 rounded-2xl border border-slate-200/80 flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-black text-slate-900">
                  Allow Restaurant's Own Delivery Staff
                </p>
                <p className="text-[11px] text-slate-500 font-medium">
                  Enable in-house delivery staff alongside or as fallback to 3P providers.
                </p>
                <p className="text-[10px] font-mono text-slate-400 mt-0.5">
                  Field: restaurants/{restId.slice(0, 8)}.allowOwnDeliveryStaff
                </p>
              </div>
              <button
                type="button"
                onClick={handleToggleOwnDeliveryStaff}
                className={`px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest shadow-sm border transition-all active:scale-95 shrink-0 ${
                  restaurant.allowOwnDeliveryStaff !== false
                    ? 'bg-emerald-600 text-white border-emerald-600'
                    : 'bg-slate-200 text-slate-700 border-slate-300'
                }`}
              >
                {restaurant.allowOwnDeliveryStaff !== false ? 'ENABLED' : 'DISABLED'}
              </button>
            </div>

            {/* DELIVERY PRICING MODE & DISTANCE SLABS */}
            <div className="p-4 bg-slate-50/80 rounded-2xl border border-slate-200/80 space-y-4">
              <div className="flex items-center justify-between">
                <label className="text-xs font-black text-slate-800 uppercase tracking-widest block">
                  DELIVERY PRICING MODE
                </label>
                <span className="text-[10px] font-mono text-slate-500">
                  Current: {isSlabsMode ? 'DISTANCE SLABS' : 'BASE + PER KM'}
                </span>
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => handleSelectPricingMode('base_km')}
                  className={`flex-1 py-3 rounded-xl font-black text-xs uppercase tracking-widest transition-all border ${
                    !isSlabsMode
                      ? 'bg-orange-500 text-white border-orange-500 shadow-lg shadow-orange-100'
                      : 'bg-white text-slate-600 border-slate-200 hover:border-orange-300'
                  }`}
                >
                  BASE + PER KM
                </button>
                <button
                  type="button"
                  onClick={() => handleSelectPricingMode('range')}
                  className={`flex-1 py-3 rounded-xl font-black text-xs uppercase tracking-widest transition-all border ${
                    isSlabsMode
                      ? 'bg-orange-500 text-white border-orange-500 shadow-lg shadow-orange-100'
                      : 'bg-white text-slate-600 border-slate-200 hover:border-orange-300'
                  }`}
                >
                  DISTANCE SLABS
                </button>
              </div>

              {!isSlabsMode ? (
                <div className="grid grid-cols-2 gap-4 pt-1">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-600 uppercase tracking-tighter">
                      Base Fee (₹)
                    </label>
                    <input
                      type="number"
                      value={restaurant.baseDeliveryCharge ?? 25}
                      onChange={(e) =>
                        setRestaurant((r) => ({
                          ...r,
                          baseDeliveryCharge: parseFloat(e.target.value) || 0,
                        }))
                      }
                      onBlur={() =>
                        persistFieldsToFirestore(
                          'Update Base Delivery Fee (₹)',
                          { baseDeliveryCharge: Number(restaurant.baseDeliveryCharge ?? 25) },
                          'What to enter: Base delivery fee in ₹ (e.g. 20 to 40).'
                        )
                      }
                      className="w-full h-12 px-4 bg-white rounded-xl text-sm font-black border border-slate-200 focus:border-orange-500 outline-none"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-600 uppercase tracking-tighter">
                      Per Km Rate (₹)
                    </label>
                    <input
                      type="number"
                      value={restaurant.deliveryPricePerKm ?? 8}
                      onChange={(e) =>
                        setRestaurant((r) => ({
                          ...r,
                          deliveryPricePerKm: parseFloat(e.target.value) || 0,
                        }))
                      }
                      onBlur={() =>
                        persistFieldsToFirestore(
                          'Update Per Km Delivery Rate (₹)',
                          { deliveryPricePerKm: Number(restaurant.deliveryPricePerKm ?? 8) },
                          'What to enter: Per-kilometer charge in ₹ (e.g. 5 to 12).'
                        )
                      }
                      className="w-full h-12 px-4 bg-white rounded-xl text-sm font-black border border-slate-200 focus:border-orange-500 outline-none"
                    />
                  </div>
                </div>
              ) : null}

              {/* Always show Distance Slabs header & "+ Add Slab" button so seller can add/edit slabs anytime */}
              <div className="pt-2 border-t border-slate-200/80 space-y-3">
                <div className="flex justify-between items-center">
                  <div>
                    <span className="text-[11px] font-black text-slate-800 uppercase block">
                      DISTANCE SLABS (KM → ₹)
                    </span>
                    <span className="text-[10px] text-slate-500">
                      Configure custom delivery fee by distance range (Min km → Max km = ₹ Fee)
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={addDeliveryRange}
                    className="px-3 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1 shadow-sm transition-colors"
                  >
                    <Plus size={14} /> Add Slab
                  </button>
                </div>

                <div className="grid grid-cols-7 gap-2 px-2 text-[10px] font-black text-slate-400 uppercase">
                  <span className="col-span-2 text-center">Min KM</span>
                  <span className="col-span-2 text-center">Max KM</span>
                  <span className="col-span-2 text-center">Fee (₹)</span>
                  <span className="text-center">Action</span>
                </div>

                {(restaurant.deliveryRanges || DEFAULT_DELIVERY_SLABS).map((range, idx) => (
                  <div
                    key={idx}
                    className="grid grid-cols-7 gap-2 items-center bg-white p-2.5 rounded-xl border border-slate-200"
                  >
                    <input
                      type="number"
                      value={range.minKm}
                      onChange={(e) =>
                        updateDeliveryRange(idx, 'minKm', parseFloat(e.target.value) || 0)
                      }
                      onBlur={saveDeliveryRangesOnBlur}
                      placeholder="Min km"
                      className="col-span-2 h-10 px-2 bg-slate-50 rounded-lg text-xs font-bold text-center border border-slate-200"
                    />
                    <input
                      type="number"
                      value={range.maxKm}
                      onChange={(e) =>
                        updateDeliveryRange(idx, 'maxKm', parseFloat(e.target.value) || 0)
                      }
                      onBlur={saveDeliveryRangesOnBlur}
                      placeholder="Max km"
                      className="col-span-2 h-10 px-2 bg-slate-50 rounded-lg text-xs font-bold text-center border border-slate-200"
                    />
                    <input
                      type="number"
                      value={range.price}
                      onChange={(e) =>
                        updateDeliveryRange(idx, 'price', parseFloat(e.target.value) || 0)
                      }
                      onBlur={saveDeliveryRangesOnBlur}
                      placeholder="₹ Fee"
                      className="col-span-2 h-10 px-2 bg-orange-50 rounded-lg text-xs font-black text-orange-600 text-center border border-orange-200"
                    />
                    <button
                      type="button"
                      onClick={() => removeDeliveryRange(idx)}
                      className="text-red-500 hover:bg-red-50 p-2 rounded-lg flex justify-center"
                      title="Remove Slab"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* 3. Permanent KYC License Numbers & Fast Document Upload Card directly inside Seller Profile */}
          <div className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h4 className="text-xs font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
                  <ShieldCheck size={16} className="text-orange-500" />
                  Permanent KYC License Numbers & Document Upload
                </h4>
                <p className="text-[10px] font-mono text-slate-400 mt-0.5">
                  Linked Backend: Firestore sellerDocuments & sellers/{user?.uid?.slice(0, 8)} (Synced to Admin Dashboard)
                </p>
              </div>
              <button
                type="button"
                disabled={uploadingDoc}
                onClick={handleQuickSampleDocUpload}
                className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center gap-1"
              >
                <Zap size={12} />
                Instant Test Upload
              </button>
            </div>

            {/* Business License, FSSAI License, and Aadhaar/PAN Numbers */}
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-black text-slate-800 uppercase">
                  Official License & Identity Numbers
                </span>
                <button
                  type="button"
                  onClick={async () => {
                    if (!user) return;
                    await saveSellerKycNumbersToProfile({
                      uid: user.uid,
                      restaurantId: restaurant.restaurantId,
                      businessLicenseNumber,
                      fssaiLicenseNumber,
                      aadhaarOrPanNumber,
                    });
                    setSaveMessage(
                      'Business License, FSSAI License & Aadhaar/PAN numbers permanently saved to Profile & Admin Dashboard!'
                    );
                    setTimeout(() => setSaveMessage(null), 4000);
                  }}
                  className="px-3 py-1 bg-slate-900 hover:bg-orange-600 text-white rounded-lg text-[10px] font-black uppercase tracking-wider transition-colors"
                >
                  Save License Numbers to DB
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-600 uppercase">
                    Business License / GST No.
                  </label>
                  <input
                    type="text"
                    value={businessLicenseNumber}
                    onChange={(e) => setBusinessLicenseNumber(e.target.value)}
                    onBlur={() =>
                      user &&
                      saveSellerKycNumbersToProfile({
                        uid: user.uid,
                        restaurantId: restaurant.restaurantId,
                        businessLicenseNumber,
                        fssaiLicenseNumber,
                        aadhaarOrPanNumber,
                      })
                    }
                    placeholder="e.g. 27AABCU9603R1ZM"
                    className="w-full h-10 px-3 bg-white rounded-xl text-xs font-bold border border-slate-200 focus:border-orange-500 outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-600 uppercase">
                    FSSAI License Number
                  </label>
                  <input
                    type="text"
                    value={fssaiLicenseNumber}
                    onChange={(e) => setFssaiLicenseNumber(e.target.value)}
                    onBlur={() =>
                      user &&
                      saveSellerKycNumbersToProfile({
                        uid: user.uid,
                        restaurantId: restaurant.restaurantId,
                        businessLicenseNumber,
                        fssaiLicenseNumber,
                        aadhaarOrPanNumber,
                      })
                    }
                    placeholder="e.g. 11523001000456"
                    className="w-full h-10 px-3 bg-white rounded-xl text-xs font-bold border border-slate-200 focus:border-orange-500 outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-600 uppercase">
                    Aadhaar or PAN Number
                  </label>
                  <input
                    type="text"
                    value={aadhaarOrPanNumber}
                    onChange={(e) => setAadhaarOrPanNumber(e.target.value)}
                    onBlur={() =>
                      user &&
                      saveSellerKycNumbersToProfile({
                        uid: user.uid,
                        restaurantId: restaurant.restaurantId,
                        businessLicenseNumber,
                        fssaiLicenseNumber,
                        aadhaarOrPanNumber,
                      })
                    }
                    placeholder="e.g. ABCDE1234F / Aadhaar"
                    className="w-full h-10 px-3 bg-white rounded-xl text-xs font-bold border border-slate-200 focus:border-orange-500 outline-none"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {(['id_proof', 'fssai_license', 'gst_certificate'] as const).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setSelectedDocType(type)}
                  className={`p-2.5 rounded-xl border text-center text-[10px] font-black uppercase transition-all ${
                    selectedDocType === type
                      ? 'bg-orange-500 text-white border-orange-500'
                      : 'bg-slate-50 text-slate-600 border-slate-200'
                  }`}
                >
                  {getDocTypeLabel(type).split(' ')[0]}
                </button>
              ))}
            </div>

            <div className="relative">
              <input
                ref={docFileInputRef}
                type="file"
                onChange={handleDashboardDocUpload}
                disabled={uploadingDoc}
                accept=".pdf,.jpg,.jpeg,.png,.webp,image/*,application/pdf"
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
              />
              <div className="w-full py-4 px-4 border-2 border-dashed border-orange-200 rounded-2xl bg-orange-50/40 hover:bg-orange-50 flex items-center justify-center gap-3 transition-colors">
                {uploadingDoc ? (
                  <Loader2 className="w-5 h-5 text-orange-500 animate-spin" />
                ) : (
                  <Upload className="w-5 h-5 text-orange-500" />
                )}
                <span className="text-xs font-black text-slate-800 uppercase tracking-wider">
                  {uploadingDoc
                    ? 'Uploading to Firestore...'
                    : `Tap to Upload ${getDocTypeLabel(selectedDocType)} (PDF/JPG/PNG)`}
                </span>
              </div>
            </div>

            {documents.length > 0 && (
              <div className="space-y-2 pt-1">
                {documents.map((d) => (
                  <div
                    key={d.documentId}
                    className="flex items-center justify-between bg-slate-50 px-3 py-2 rounded-xl text-xs"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <FileText size={14} className="text-orange-500 shrink-0" />
                      <span className="font-bold text-slate-800 truncate">
                        {getDocTypeLabel(d.documentType)} {d.fileName ? `(${d.fileName})` : ''}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span
                        className={`text-[10px] font-black uppercase px-2 py-0.5 rounded ${
                          d.verificationStatus === 'verified'
                            ? 'bg-green-100 text-green-700'
                            : d.verificationStatus === 'rejected'
                            ? 'bg-red-100 text-red-600'
                            : 'bg-orange-100 text-orange-700'
                        }`}
                      >
                        {d.verificationStatus}
                      </span>
                      <button
                        type="button"
                        onClick={() => downloadSellerDocumentFile(d)}
                        className="text-blue-600 hover:text-blue-800"
                        title="Download Document"
                      >
                        <Download size={13} />
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteSellerDocumentFast(d.documentId, d.fileName)}
                        className="text-red-500 hover:text-red-700"
                        title="Delete Document"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 4. Opening Hours Section */}
          <div className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm space-y-4">
            <h4 className="text-xs font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
              <Clock size={16} className="text-orange-500" />
              Opening Hours
            </h4>
            <div className="space-y-2.5">
              {DAYS_OF_WEEK.map((day) => {
                const dayHours = restaurant?.openingHours?.[day] || {
                  open: '09:00',
                  close: '22:00',
                  isClosed: false,
                };
                return (
                  <div
                    key={day}
                    className="flex items-center justify-between gap-2 py-2 border-b border-slate-50 last:border-b-0"
                  >
                    <span className="text-xs font-bold capitalize text-slate-700 w-24">{day}</span>
                    {!dayHours.isClosed ? (
                      <div className="flex items-center gap-1.5">
                        <input
                          type="time"
                          value={dayHours.open}
                          onChange={(e) => updateOpeningHours(day, 'open', e.target.value)}
                          className="px-2 py-1 bg-slate-50 rounded-lg text-xs font-bold text-slate-700"
                        />
                        <span className="text-xs text-slate-400">to</span>
                        <input
                          type="time"
                          value={dayHours.close}
                          onChange={(e) => updateOpeningHours(day, 'close', e.target.value)}
                          className="px-2 py-1 bg-slate-50 rounded-lg text-xs font-bold text-slate-700"
                        />
                      </div>
                    ) : (
                      <span className="text-xs font-bold text-red-500 uppercase">Closed</span>
                    )}
                    <button
                      type="button"
                      onClick={() => updateOpeningHours(day, 'isClosed', !dayHours.isClosed)}
                      className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase ${
                        dayHours.isClosed
                          ? 'bg-slate-200 text-slate-600'
                          : 'bg-green-50 text-green-600'
                      }`}
                    >
                      {dayHours.isClosed ? 'Closed' : 'Open'}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          <button
            type="submit"
            disabled={savingProfile}
            className="w-full h-16 bg-slate-900 hover:bg-orange-600 disabled:opacity-60 text-white font-black uppercase tracking-widest rounded-[24px] shadow-xl shadow-slate-200 active:scale-95 transition-all flex items-center justify-center gap-2"
          >
            {savingProfile ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>SAVING TO FIRESTORE DATABASE...</span>
              </>
            ) : (
              <span>SAVE KITCHEN, DELIVERY & HOURS</span>
            )}
          </button>
        </form>
      </div>
    );
  };

  const handleDeleteSellerAccount = async () => {
    if (!user) return;
    setDeletingSeller(true);
    try {
      await authService.deleteAccount(user.uid, 'seller');
      navigate('/welcome');
    } catch (err: any) {
      setSaveError(err?.message || 'Failed to delete seller account.');
      setDeletingSeller(false);
    }
  };

  const renderAccount = () => (
    <div className="space-y-6 pb-20">
      <div className="flex flex-wrap items-center justify-between gap-2 px-1">
        <h3 className="font-black text-slate-900">Seller Profile, Subscription & Settings</h3>
        <span
          className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border ${
            seller?.gstEnabled || restaurant?.gstEnabled
              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
              : 'bg-slate-100 text-slate-600 border-slate-200'
          }`}
        >
          {seller?.gstEnabled || restaurant?.gstEnabled
            ? '5% GST Allowed by Admin'
            : '0% GST (Standard Non-GST)'}
        </span>
      </div>

      {/* UPI Subscription & Transaction Reference Card with GST Breakdown */}
      <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white rounded-[28px] p-5 shadow-lg space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <span className="text-[10px] font-black uppercase tracking-widest text-orange-400">
              30-Day Subscription Plan (₹499 + 18% GST ₹89.82 = ₹588.82 • GSTIN: 01BMAPL3192D1CY)
            </span>
            <h4 className="text-base font-black mt-0.5">
              {subscriptionMeta.isPaused
                ? 'Account Paused — Subscription Renewal Required (Plan ₹499 + GST)'
                : seller?.subscriptionStatus === 'pending_verification'
                ? 'Awaiting Admin Verification (UTR Submitted)'
                : `Active Partner • ${subscriptionMeta.daysRemaining} Days Remaining`}
            </h4>
          </div>
          <button
            type="button"
            onClick={() => navigate('/seller/subscription')}
            className="px-3.5 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-[10px] font-black uppercase tracking-wider shrink-0"
          >
            {subscriptionMeta.isPaused ? 'Pay ₹499 + GST' : 'Manage / Submit UTR'}
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2 border-t border-white/10 text-xs">
          <div className="bg-white/5 p-3 rounded-xl">
            <span className="text-[9px] font-black uppercase text-slate-400 block">
              Submitted UPI Transaction Reference (UTR)
            </span>
            <span className="font-mono font-black text-emerald-400 mt-0.5 block break-all">
              {seller?.upiTransactionRef || profile?.upiTransactionRef || 'Not submitted yet'}
            </span>
          </div>
          <div className="bg-white/5 p-3 rounded-xl">
            <span className="text-[9px] font-black uppercase text-slate-400 block">
              30-Day Subscription Validity
            </span>
            <span className="font-bold text-white mt-0.5 block">
              {subscriptionMeta.expiryDate
                ? `Valid until ${subscriptionMeta.expiryDate.toLocaleDateString('en-IN', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })}`
                : 'Plan ₹499 + 18% GST (₹89.82) = ₹588.82 for 30 days'}
            </span>
          </div>
        </div>
        <p className="text-[11px] text-slate-300">
          Note: Plan <strong>₹499 + 18% GST (₹89.82) = ₹588.82</strong> (GSTIN: <strong>01BMAPL3192D1CY</strong>) to UPI <strong>8825018335@axl</strong> every 30 days. For any refund or billing help, contact{' '}
          <strong className="text-orange-300">+91 8825028335 / +8825018335</strong>.
        </p>
      </div>

      {/* Official Corporate & Statutory Details Card */}
      <div className="bg-white rounded-[28px] p-5 border border-orange-200 shadow-sm space-y-2.5 text-xs">
        <p className="text-[10px] font-black uppercase tracking-widest text-orange-600">
          About Food India — Official Platform Compliance & Registration
        </p>
        <p className="font-black text-slate-900 text-sm">
          Food India is a unit of KulgamKart (Website:{' '}
          <a
            href="https://kulgamkart.in"
            target="_blank"
            rel="noopener noreferrer"
            className="text-orange-600 underline"
          >
            kulgamkart.in
          </a>
          )
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 bg-slate-50 p-3 rounded-2xl border border-slate-100 text-[11px]">
          <div>
            <span className="font-black text-slate-700">Udyam Registration No:</span>{' '}
            <span className="font-mono font-black text-slate-900">UDYAM-JK-11-0018721</span>
          </div>
          <div>
            <span className="font-black text-slate-700">GST Number (GSTIN):</span>{' '}
            <span className="font-mono font-black text-slate-900">01BMAPL3192D1CY</span>
          </div>
          <div className="sm:col-span-2">
            <span className="font-black text-slate-700">FSSAI अनुज्ञिप्त संख्या / License Number:</span>{' '}
            <span className="font-mono font-black text-emerald-700">11026999000072</span>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-[32px] border border-slate-100 shadow-sm overflow-hidden divide-y divide-slate-50">
        <div className="p-6 flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-orange-100 flex items-center justify-center text-orange-600 font-black text-2xl shrink-0">
            {seller?.ownerName?.charAt(0) || 'S'}
          </div>
          <div className="min-w-0">
            <h4 className="font-black text-slate-900 text-lg truncate">
              {seller?.ownerName || restaurant.restaurantName}
            </h4>
            <p className="text-xs text-slate-400 font-bold uppercase tracking-widest truncate">{user?.email}</p>
            <p className="text-xs text-slate-600 font-bold mt-0.5">
              Phone: {restaurant.phone || seller?.phone || 'Not set'}
            </p>
            <p className="text-[10px] text-slate-400 font-bold mt-1">
              Registered:{' '}
              {profile?.registrationDate?.toDate
                ? profile.registrationDate.toDate().toLocaleDateString()
                : 'Active Partner'}
            </p>
          </div>
        </div>

        <button
          onClick={() => navigate('/seller/verification')}
          className="w-full p-5 flex items-center justify-between group hover:bg-slate-50 transition-colors"
        >
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400 group-hover:bg-orange-100 group-hover:text-orange-600 transition-colors">
              <ShieldCheck size={20} />
            </div>
            <div className="text-left">
              <p className="text-sm font-bold text-slate-900">
                Verification & Fast Document Upload ({documents.length} uploaded)
              </p>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                Upload & review private KYC documents (&lt;1s Firestore sync)
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={`text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-lg ${
                seller?.verificationStatus === 'verified'
                  ? 'bg-green-100 text-green-600'
                  : 'bg-orange-100 text-orange-600'
              }`}
            >
              {seller?.verificationStatus || 'pending'}
            </span>
            <ChevronRight size={16} className="text-slate-300" />
          </div>
        </button>

        <button
          onClick={() => navigate('/seller/subscription')}
          className="w-full p-5 flex items-center justify-between group hover:bg-slate-50 transition-colors"
        >
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400 group-hover:bg-indigo-100 group-hover:text-indigo-600 transition-colors">
              <CreditCard size={20} />
            </div>
            <div className="text-left">
              <p className="text-sm font-bold text-slate-900">
                Subscription Plan (₹499 + 18% GST • 30 Days • UPI)
              </p>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                GSTIN: 01BMAPL3192D1CY • UPI: 8825018335@axl • Submit UTR
              </p>
            </div>
          </div>
          <ChevronRight size={16} className="text-slate-300" />
        </button>

        <button
          onClick={() => setActiveTab('restaurant')}
          className="w-full p-5 flex items-center justify-between group hover:bg-slate-50 transition-colors"
        >
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400 group-hover:bg-blue-100 group-hover:text-blue-600 transition-colors">
              <Clock size={20} />
            </div>
            <div className="text-left">
              <p className="text-sm font-bold text-slate-900">Opening Hours & Live GPS Delivery Settings</p>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                Auto-fill State, City, PIN Code, Distance Slabs & Contact Phone
              </p>
            </div>
          </div>
          <ChevronRight size={16} className="text-slate-300" />
        </button>

        {/* Contact & Refund Support */}
        <div className="p-5 bg-slate-50/60 space-y-2 text-xs">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
            Support & Refund Contact Details
          </p>
          <div className="flex flex-wrap items-center gap-4">
            <a
              href="tel:+918825028335"
              className="font-bold text-emerald-700 hover:underline flex items-center gap-1.5"
            >
              <Phone size={14} /> +91 8825028335 / +8825018335
            </a>
          </div>
          <div className="flex flex-wrap items-center gap-4 pt-1">
            <button
              type="button"
              onClick={() => navigate('/terms')}
              className="text-xs font-bold text-slate-600 hover:text-orange-600 underline"
            >
              Terms, Privacy & About (KulgamKart)
            </button>
            <button
              type="button"
              onClick={() => navigate('/privacy')}
              className="text-xs font-bold text-slate-600 hover:text-orange-600 underline"
            >
              Privacy Policy
            </button>
          </div>
        </div>

        {/* Delete Seller Account */}
        <div className="p-5 bg-red-50/40 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-sm font-black text-red-700">Delete Seller Account</p>
              <p className="text-[11px] text-red-600/80">
                Deactivate your seller profile while keeping historical audit records in Firestore.
              </p>
            </div>
            {!confirmDeleteSeller && (
              <button
                type="button"
                onClick={() => setConfirmDeleteSeller(true)}
                className="px-3.5 py-2 bg-red-600 text-white rounded-xl text-[10px] font-black uppercase tracking-wider shrink-0"
              >
                Delete Account
              </button>
            )}
          </div>
          {confirmDeleteSeller && (
            <div className="pt-2 border-t border-red-200 flex items-center justify-between gap-2">
              <span className="text-xs font-bold text-red-800">Confirm seller account deactivation?</span>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={deletingSeller}
                  onClick={handleDeleteSellerAccount}
                  className="px-3 py-1.5 bg-red-600 text-white rounded-lg text-[10px] font-black uppercase"
                >
                  {deletingSeller ? 'Processing...' : 'Yes, Confirm'}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmDeleteSeller(false)}
                  className="px-3 py-1.5 bg-white text-slate-600 rounded-lg text-[10px] font-bold"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>

        <button
          onClick={handleLogout}
          className="w-full p-5 flex items-center gap-4 text-red-500 hover:bg-red-50 transition-colors"
        >
          <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center">
            <LogOut size={20} />
          </div>
          <p className="text-sm font-bold">Sign Out</p>
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col pb-24">
      <NotificationCenterModal isOpen={showNotifModal} onClose={() => setShowNotifModal(false)} />

      {/* 3-Second Beep & Sound + Vibration Incoming Order Alert Modal with Accept / Reject & SMS Inbox */}
      {incomingAlertOrder && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-md rounded-[32px] border-2 border-orange-500 shadow-2xl overflow-hidden max-h-[92dvh] overflow-y-auto">
            <div className="bg-gradient-to-r from-orange-600 via-red-600 to-orange-500 p-5 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center animate-bounce">
                  <Bell size={24} className="text-white" />
                </div>
                <div>
                  <span className="text-[10px] font-black uppercase tracking-widest bg-white/20 px-2 py-0.5 rounded-full">
                    3s Beep & Sound + SMS Alert
                  </span>
                  <h3 className="text-lg font-black mt-0.5">
                    New Order #{incomingAlertOrder.orderNumber || incomingAlertOrder.orderId.slice(-6).toUpperCase()}
                  </h3>
                </div>
              </div>
              <button
                type="button"
                onClick={() => triggerFiveSecondOrderAlert(incomingAlertOrder)}
                className="px-2.5 py-1.5 bg-white/20 hover:bg-white/30 rounded-xl text-[10px] font-black uppercase tracking-wider"
              >
                Replay 3s Beep
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="flex items-center justify-between bg-slate-50 p-3.5 rounded-2xl border border-slate-100">
                <div>
                  <p className="text-[10px] font-black uppercase text-slate-400">Customer</p>
                  <p className="text-sm font-black text-slate-900">{incomingAlertOrder.customerName || 'Verified Customer'}</p>
                  <p className="text-xs font-bold text-slate-600">{incomingAlertOrder.customerPhone || '+91 9876543210'}</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-black uppercase text-slate-400">Total COD Bill</p>
                  <p className="text-xl font-black text-emerald-600">₹{incomingAlertOrder.totalAmount}</p>
                  {incomingAlertOrder.gstEnabled && Number(incomingAlertOrder.gstAmount || 0) > 0 && (
                    <p className="text-[10px] font-black text-emerald-700">
                      Incl. 5% GST: ₹{Number(incomingAlertOrder.gstAmount).toFixed(2)}
                    </p>
                  )}
                  <p className="text-[10px] font-bold uppercase text-orange-600">{incomingAlertOrder.paymentMethod}</p>
                </div>
              </div>

              <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                <p className="text-[10px] font-black uppercase text-slate-400">Ordered Dishes</p>
                {(incomingAlertOrder.items || []).map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between text-xs font-bold bg-orange-50/60 px-3 py-2 rounded-xl">
                    <span className="text-slate-900">
                      {item.quantity}x {item.name}
                    </span>
                    <span className="text-slate-700">₹{Number(item.price || 0) * Number(item.quantity || 1)}</span>
                  </div>
                ))}
              </div>

              {incomingAlertOrder.deliveryAddress && (
                <div className="text-xs bg-slate-50 p-3 rounded-xl border border-slate-100 space-y-1.5">
                  <p className="text-[10px] font-black uppercase text-slate-400">Delivery Dropoff & Live GPS</p>
                  <p className="font-bold text-slate-700 line-clamp-2">{incomingAlertOrder.deliveryAddress}</p>
                  {incomingAlertOrder.addressSnapshot?.googleMapsLink && (
                    <a
                      href={incomingAlertOrder.addressSnapshot.googleMapsLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[11px] font-black text-blue-600 hover:underline"
                    >
                      <ExternalLink size={12} /> Open Customer Coordinate Pin in Google Maps
                    </a>
                  )}
                </div>
              )}

              <a
                href={buildOrderSmsInboxUrl({
                  targetPhone: ADMIN_AND_ORDER_SMS_NUMBER,
                  order: incomingAlertOrder,
                  headline: 'New COD Order Placed',
                })}
                className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-md shadow-indigo-600/20"
              >
                <MessageSquare size={15} />
                <span>Send Order SMS to Phone Inbox ({ADMIN_AND_ORDER_SMS_NUMBER})</span>
              </a>

              <div className="grid grid-cols-2 gap-3 pt-1">
                <button
                  type="button"
                  disabled={processingIncomingOrder}
                  onClick={() => handleRejectIncomingOrder(incomingAlertOrder)}
                  className="h-14 rounded-2xl bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 font-black uppercase tracking-widest text-xs transition-all active:scale-95 disabled:opacity-50"
                >
                  Reject Order
                </button>
                <button
                  type="button"
                  disabled={processingIncomingOrder}
                  onClick={() => handleAcceptIncomingOrder(incomingAlertOrder)}
                  className="h-14 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase tracking-widest text-xs shadow-lg shadow-emerald-600/25 transition-all active:scale-95 disabled:opacity-50"
                >
                  {processingIncomingOrder ? 'Accepting...' : 'Accept Order'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <header className="bg-white px-6 py-4 border-b border-slate-100 sticky top-0 z-30 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-orange-50 rounded-2xl flex items-center justify-center overflow-hidden border border-orange-100">
              {restaurant?.logoPath ? (
                <img src={restaurant.logoPath} alt="logo" className="w-full h-full object-cover" />
              ) : (
                <Store className="text-orange-500" size={24} />
              )}
            </div>
            <div className="min-w-0">
              <h1 className="text-sm font-black text-slate-900 truncate max-w-[180px] tracking-tight">
                {restaurant?.restaurantName || 'Seller Dashboard'}
              </h1>
              <div className="flex items-center gap-1.5">
                <div
                  className={`w-2 h-2 rounded-full ${
                    restaurant?.isOpen
                      ? 'bg-green-500 animate-pulse shadow-sm shadow-green-200'
                      : 'bg-slate-300'
                  }`}
                />
                <span
                  className={`text-[10px] font-black uppercase tracking-widest ${
                    restaurant?.isOpen ? 'text-green-600' : 'text-slate-400'
                  }`}
                >
                  {restaurant?.isOpen ? 'Accepting Orders' : 'Offline'}
                </span>
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setShowNotifModal(true)}
              className="w-10 h-10 rounded-xl flex items-center justify-center border bg-slate-50 text-slate-600 border-slate-100 relative hover:bg-orange-50 hover:text-orange-600 transition-colors"
              title="Live App, Email & WhatsApp Notifications"
            >
              <Bell size={18} />
              {unreadNotifCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] bg-orange-500 text-white text-[10px] font-black rounded-full flex items-center justify-center border-2 border-white px-1">
                  {unreadNotifCount}
                </span>
              )}
            </button>
            <button
              onClick={() => {
                setTodayOnlyFilter(!todayOnlyFilter);
                setActiveTab('orders');
              }}
              className={`w-10 h-10 rounded-xl flex items-center justify-center border transition-colors ${
                todayOnlyFilter
                  ? 'bg-orange-500 text-white border-orange-500'
                  : 'bg-slate-50 text-slate-400 border-slate-100'
              }`}
              title="Toggle Today's Orders Filter"
            >
              <Calendar size={18} />
            </button>
            <button
              onClick={() => {
                setShowSearchBar(!showSearchBar);
                setActiveTab('orders');
              }}
              className={`w-10 h-10 rounded-xl flex items-center justify-center border transition-colors ${
                showSearchBar
                  ? 'bg-slate-900 text-white border-slate-900'
                  : 'bg-slate-50 text-slate-400 border-slate-100'
              }`}
              title="Search Orders"
            >
              <Search size={18} />
            </button>
          </div>
        </div>

        {showSearchBar && (
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search order #, customer name, or phone..."
              className="w-full h-10 pl-4 pr-9 bg-slate-50 rounded-xl text-xs font-bold border border-slate-200 focus:outline-none focus:border-orange-500"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
              >
                <X size={14} />
              </button>
            )}
          </div>
        )}
      </header>

      <main className="flex-1 p-4 overflow-y-auto overflow-x-hidden max-w-2xl mx-auto w-full">
        {subscriptionMeta.isPaused && (
          <div className="mb-4 p-4 bg-red-600 text-white rounded-3xl shadow-lg flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-red-100">
                30-Day Subscription Expired — Seller Account Paused
              </p>
              <p className="text-xs font-bold mt-0.5">
                Please pay exactly ₹499 via UPI (8825018335@axl) and submit your Transaction Reference ID to reactivate your kitchen for 30 days.
              </p>
            </div>
            <button
              type="button"
              onClick={() => navigate('/seller/subscription')}
              className="px-4 py-2 bg-white text-red-600 rounded-xl text-xs font-black uppercase tracking-wider shrink-0"
            >
              Pay ₹499 Now
            </button>
          </div>
        )}
        {activeTab === 'overview' && renderOverview()}
        {activeTab === 'orders' && renderOrders()}
        {activeTab === 'menu' && renderMenu()}
        {activeTab === 'restaurant' && renderRestaurant()}
        {activeTab === 'account' && renderAccount()}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-xl border-t border-slate-100 flex items-center justify-around py-3 px-6 z-40">
        <button
          onClick={() => setActiveTab('overview')}
          className={`flex flex-col items-center gap-1 transition-all ${
            activeTab === 'overview' ? 'text-orange-500 scale-105' : 'text-slate-400'
          }`}
        >
          <LayoutDashboard size={20} strokeWidth={activeTab === 'overview' ? 2.5 : 2} />
          <span className="text-[10px] font-black uppercase tracking-tighter">Overview</span>
        </button>
        <button
          onClick={() => {
            setActiveTab('orders');
            setOrderFilter('pending');
          }}
          className={`flex flex-col items-center gap-1 transition-all ${
            activeTab === 'orders' ? 'text-orange-500 scale-105' : 'text-slate-400'
          }`}
        >
          <div className="relative">
            <ClipboardList size={20} strokeWidth={activeTab === 'orders' ? 2.5 : 2} />
            {stats.pendingOrders > 0 && (
              <span className="absolute -top-1.5 -right-2 w-4 h-4 bg-red-500 text-white text-[9px] font-black rounded-full flex items-center justify-center border border-white">
                {stats.pendingOrders}
              </span>
            )}
          </div>
          <span className="text-[10px] font-black uppercase tracking-tighter">Orders</span>
        </button>
        <button
          onClick={() => setActiveTab('menu')}
          className={`flex flex-col items-center gap-1 transition-all ${
            activeTab === 'menu' ? 'text-orange-500 scale-105' : 'text-slate-400'
          }`}
        >
          <Layers size={20} strokeWidth={activeTab === 'menu' ? 2.5 : 2} />
          <span className="text-[10px] font-black uppercase tracking-tighter">Products</span>
        </button>
        <button
          onClick={() => setActiveTab('restaurant')}
          className={`flex flex-col items-center gap-1 transition-all ${
            activeTab === 'restaurant' ? 'text-orange-500 scale-105' : 'text-slate-400'
          }`}
        >
          <Store size={20} strokeWidth={activeTab === 'restaurant' ? 2.5 : 2} />
          <span className="text-[10px] font-black uppercase tracking-tighter">Profile</span>
        </button>
        <button
          onClick={() => setActiveTab('account')}
          className={`flex flex-col items-center gap-1 transition-all ${
            activeTab === 'account' ? 'text-orange-500 scale-105' : 'text-slate-400'
          }`}
        >
          <Grid size={20} strokeWidth={activeTab === 'account' ? 2.5 : 2} />
          <span className="text-[10px] font-black uppercase tracking-tighter">Settings</span>
        </button>
      </nav>
    </div>
  );
};

export default SellerDashboard;
