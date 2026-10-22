import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { 
  collection, query, onSnapshot, doc, updateDoc, setDoc,
  deleteDoc, addDoc, serverTimestamp, orderBy, limit 
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { 
  User, Seller, Restaurant, Category, 
  SubscriptionPlan, SellerDocument, Payment, 
  Order, Product, AuditLog, AdminSettings,
  DeliveryProvider, DeliveryServiceArea, DeliveryBooking, DeliveryWebhookEvent
} from '../models/types';
import { 
  Users, Store, LayoutGrid, ClipboardCheck, Settings, 
  ShieldCheck, Trash2, Plus, 
  CheckCircle2, XCircle, LogOut, 
  FileText, ExternalLink, Loader2, CreditCard, 
  Package, DollarSign, History,
  Truck, Globe, Ban, MessageSquare, ShoppingBag, Layers, RefreshCw, MapPin,
  Download, Eye, Phone, Mail, MessageCircle, Navigation, Award, X, Copy, Check, Bug
} from 'lucide-react';
import { logAdminAction } from '../utils/audit';
import { deliveryService } from '../services/delivery';
import { authService } from '../services/auth';
import { seedCategories, seedIndianTestProducts, deleteAllTestProducts } from '../firebase/seed';
import { downloadSellerDocumentFile, resolveSellerDocumentDataUrl } from '../utils/documentUpload';
import { useErrorLog, reportGlobalButtonStatus, reportGlobalError } from '../context/ErrorLogContext';
import { notificationService } from '../services/notifications';
import { orderService } from '../services/orders';
import { format } from 'date-fns';
import { PluginAdminSettings } from '../plugins/restaurantMap/components/PluginAdminSettings';

type AdminTab = 'sellers' | 'documents' | 'restaurants' | 'products' | 'categories' | 'delivery' | 'users' | 'plans' | 'payments' | 'orders' | 'logs' | 'settings' | 'restaurant_map';

export default function AdminDashboard() {
  const { user, profile } = useAuth();
  const { errors, actionLogs, setIsOpen: setErrorWindowOpen } = useErrorLog();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<AdminTab>('sellers');
  const [copiedRefText, setCopiedRefText] = useState<string | null>(null);

  const handleCopyRef = (refValue: string) => {
    if (!refValue) return;
    navigator.clipboard.writeText(refValue).catch(() => {});
    setCopiedRefText(refValue);
    setAdminMessage(`Copied UPI Transaction Reference: ${refValue}`);
    setTimeout(() => setCopiedRefText(null), 2500);
  };
  
  // Data State
  const [sellers, setSellers] = useState<Seller[]>([]);
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [documents, setDocuments] = useState<SellerDocument[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [settings, setSettings] = useState<AdminSettings>({
    deliveryLimits: { maximumDistanceKm: 15, globalBaseCharge: 25 },
    privacyPolicyURL: '/terms',
    termsAndConditionsURL: '/terms',
    companyName: 'Food India (A Unit of KulgamKart)',
    parentUnitName: 'KulgamKart',
    parentWebsite: 'https://kulgamkart.in',
    udyamRegistrationNumber: 'UDYAM-JK-11-0018721',
    gstNumber: '01BMAPL3192D1CY',
    fssaiLicenseNumber: 'अनुज्ञिप्त संख्या / License Number: 11026999000072',
    plan499BaseAmount: 499,
    plan499GstRate: 18,
    plan499GstAmount: 89.82,
    plan499TotalAmount: 588.82,
    updatedAt: null
  });
  
  const [loading, setLoading] = useState(true);
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [newPlan, setNewPlan] = useState({
    name: '',
    price: '',
    currency: 'INR',
    durationDays: '30',
    featuresText: 'Unlimited Menu Items\n0% Marketplace Commission\n100% COD Order Support\nLive Google Maps Directions',
  });
  const [newCategory, setNewCategory] = useState({
    name: '',
    parentCategoryId: '',
    subcategoriesText: '',
  });
  const [noteInputBySeller, setNoteInputBySeller] = useState<Record<string, string>>({});
  const [activatingPaymentId, setActivatingPaymentId] = useState<string | null>(null);
  const [adminMessage, setAdminMessage] = useState<string | null>(null);
  const [previewDoc, setPreviewDoc] = useState<SellerDocument | null>(null);
  const [previewResolvedUrl, setPreviewResolvedUrl] = useState<string>('');
  const [loadingPreviewUrl, setLoadingPreviewUrl] = useState(false);

  // Real Local Food Delivery Company API Integration State
  const [localDeliveryApi, setLocalDeliveryApi] = useState({
    companyName: 'Local Express Food Delivery Co.',
    apiEndpointUrl: 'https://httpbin.org/post',
    apiKey: 'lfdc_live_key_9988776655',
    authHeaderName: 'Authorization',
    webhookSecret: 'whsec_local_delivery_india_2025',
    supportPhone: '+91 8825018335',
    cityCoverage: 'All Cities / Pan-India Hyperlocal',
    baseFee: '25',
    perKmFee: '8',
    autoDispatchOnOrder: true,
    isEnabled: true,
  });
  const [savingLocalDeliveryApi, setSavingLocalDeliveryApi] = useState(false);
  const [testingLocalDeliveryApi, setTestingLocalDeliveryApi] = useState(false);
  const [localDeliveryTestResult, setLocalDeliveryTestResult] = useState<string | null>(null);

  // Delivery Integrations State
  const [deliverySubTab, setDeliverySubTab] = useState<'providers' | 'areas' | 'bookings' | 'restaurants'>('providers');
  const [deliveryProviders, setDeliveryProviders] = useState<DeliveryProvider[]>([]);
  const [serviceAreas, setServiceAreas] = useState<DeliveryServiceArea[]>([]);
  const [deliveryBookings, setDeliveryBookings] = useState<DeliveryBooking[]>([]);
  const [webhookEvents, setWebhookEvents] = useState<DeliveryWebhookEvent[]>([]);
  const [providerEnvStatus, setProviderEnvStatus] = useState<Record<string, { configured: boolean; envLabel: string; webhookEndpoint: string }>>({});
  const [testingProviderId, setTestingProviderId] = useState<string | null>(null);
  const [showAddProviderModal, setShowAddProviderModal] = useState(false);
  const [newProviderForm, setNewProviderForm] = useState({
    providerCode: '',
    name: '',
    providerType: 'third_party_api' as DeliveryProvider['providerType'],
    apiBaseUrl: 'https://api.partner-logistics.in/v1',
    priority: '8',
    fallbackProviderId: 'restaurant_staff',
    baseFee: '30',
    perKmFee: '9',
    maxDistanceKm: '15',
    conditionsNote: 'Official partner integration. Subject to live rider availability.',
    onboardingRequirements: 'Configure partner API token and webhook secret in server .env.',
    requiredEnvVarsText: 'PARTNER_API_KEY, PARTNER_WEBHOOK_SECRET',
  });
  const [newAreaForm, setNewAreaForm] = useState({
    providerId: 'food_india_fleet',
    state: 'Delhi',
    city: 'New Delhi',
    district: 'New Delhi',
    pincodesText: '110001, 110002, *',
    centerLatitude: '28.6139',
    centerLongitude: '77.2090',
    radiusKm: '25',
    areaRulesNote: 'Standard city hyperlocal delivery coverage.',
  });

  useEffect(() => {
    // Load all live Firestore collections immediately whenever Admin Dashboard is opened (including via 10s logo long-press)
    deliveryService.getAdminStatus().then(res => {
      setProviderEnvStatus(res.providers || {});
    }).catch(() => {});

    const unsubSellers = onSnapshot(collection(db, 'sellers'), (snap) => {
      setSellers(snap.docs.map(d => ({ sellerId: d.id, ...d.data() } as Seller)));
    }, () => {});

    const unsubRestaurants = onSnapshot(collection(db, 'restaurants'), (snap) => {
      setRestaurants(snap.docs.map(d => ({ restaurantId: d.id, ...d.data() } as Restaurant)));
    }, () => {});

    const unsubProducts = onSnapshot(collection(db, 'products'), (snap) => {
      setProducts(snap.docs.map(d => ({ productId: d.id, ...d.data() } as Product)));
    }, () => {});

    const unsubCategories = onSnapshot(collection(db, 'categories'), (snap) => {
      setCategories(snap.docs.map(d => ({ categoryId: d.id, ...d.data() } as Category)));
    }, () => {});

    const unsubUsers = onSnapshot(collection(db, 'users'), (snap) => {
      setUsers(snap.docs.map(d => ({ uid: d.id, ...d.data() } as User)));
    }, () => {});

    const unsubPlans = onSnapshot(collection(db, 'subscriptionPlans'), (snap) => {
      setPlans(snap.docs.map(d => ({ planId: d.id, ...d.data() } as SubscriptionPlan)));
    }, () => {});

    const unsubDocs = onSnapshot(collection(db, 'sellerDocuments'), (snap) => {
      const list = snap.docs.map(d => ({ documentId: d.id, ...d.data() } as SellerDocument));
      list.sort((a, b) => (b.uploadedAt?.toMillis?.() || 0) - (a.uploadedAt?.toMillis?.() || 0));
      setDocuments(list);
    }, () => {});

    const unsubPayments = onSnapshot(collection(db, 'payments'), (snap) => {
      const list = snap.docs.map(d => ({ paymentId: d.id, ...d.data() } as Payment));
      list.sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
      setPayments(list);
    }, () => {});

    const unsubOrders = onSnapshot(collection(db, 'orders'), (snap) => {
      const list = snap.docs.map(d => ({ orderId: d.id, ...d.data() } as Order));
      list.sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
      setOrders(list.slice(0, 100));
    }, () => {});

    const unsubLogs = onSnapshot(collection(db, 'auditLogs'), (snap) => {
      const list = snap.docs.map(d => ({ logId: d.id, ...d.data() } as AuditLog));
      list.sort((a, b) => (b.timestamp?.toMillis?.() || 0) - (a.timestamp?.toMillis?.() || 0));
      setLogs(list.slice(0, 100));
    }, () => {});

    const unsubSettings = onSnapshot(doc(db, 'adminSettings', 'global'), (d) => {
      if (d.exists()) {
        const data = d.data() as AdminSettings;
        setSettings(prev => ({
          ...prev,
          ...data,
          companyName: data.companyName || 'Food India (A Unit of KulgamKart)',
          parentUnitName: data.parentUnitName || 'KulgamKart',
          parentWebsite: data.parentWebsite || 'https://kulgamkart.in',
          udyamRegistrationNumber: data.udyamRegistrationNumber || 'UDYAM-JK-11-0018721',
          gstNumber: data.gstNumber || '01BMAPL3192D1CY',
          fssaiLicenseNumber: data.fssaiLicenseNumber || 'अनुज्ञिप्त संख्या / License Number: 11026999000072',
          plan499BaseAmount: data.plan499BaseAmount ?? 499,
          plan499GstRate: data.plan499GstRate ?? 18,
          plan499GstAmount: data.plan499GstAmount ?? 89.82,
          plan499TotalAmount: data.plan499TotalAmount ?? 588.82,
        }));
      }
    }, () => {});

    const unsubLocalDelivApi = onSnapshot(doc(db, 'adminSettings', 'localDeliveryCompanyApi'), (d) => {
      if (d.exists()) {
        const data = d.data() as any;
        setLocalDeliveryApi(prev => ({
          ...prev,
          ...data,
          baseFee: String(data.baseFee ?? prev.baseFee),
          perKmFee: String(data.perKmFee ?? prev.perKmFee),
        }));
      }
    }, () => {});

    const unsubDelivProviders = onSnapshot(collection(db, 'deliveryProviders'), (snap) => {
      const list = snap.docs.map(d => ({ providerId: d.id, ...d.data() } as DeliveryProvider));
      list.sort((a, b) => Number(a.priority || 99) - Number(b.priority || 99));
      setDeliveryProviders(list);
    }, () => {});

    const unsubServiceAreas = onSnapshot(collection(db, 'deliveryServiceAreas'), (snap) => {
      setServiceAreas(snap.docs.map(d => ({ areaId: d.id, ...d.data() } as DeliveryServiceArea)));
    }, () => {});

    const unsubDelivBookings = onSnapshot(collection(db, 'deliveryBookings'), (snap) => {
      const list = snap.docs.map(d => ({ bookingId: d.id, ...d.data() } as DeliveryBooking));
      list.sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
      setDeliveryBookings(list);
    }, () => {});

    const unsubWebhookEvents = onSnapshot(collection(db, 'deliveryWebhookEvents'), (snap) => {
      const list = snap.docs.map(d => ({ eventId: d.id, ...d.data() } as DeliveryWebhookEvent));
      list.sort((a, b) => (b.receivedAt?.toMillis?.() || 0) - (a.receivedAt?.toMillis?.() || 0));
      setWebhookEvents(list);
    }, () => {});

    setLoading(false);
    return () => {
      unsubSellers();
      unsubRestaurants();
      unsubProducts();
      unsubCategories();
      unsubUsers();
      unsubPlans();
      unsubDocs();
      unsubPayments();
      unsubOrders();
      unsubLogs();
      unsubSettings();
      unsubLocalDelivApi();
      unsubDelivProviders();
      unsubServiceAreas();
      unsubDelivBookings();
      unsubWebhookEvents();
    };
  }, []);

  // Unified Sellers List (merges `sellers` collection, `users` with role === 'seller', and `sellerDocuments` so no seller or document is ever hidden)
  const allSellers = React.useMemo<Seller[]>(() => {
    const map = new Map<string, Seller>();
    for (const s of sellers) {
      const id = s.sellerId || s.uid;
      if (!id) continue;
      map.set(id, { ...s, sellerId: id, uid: s.uid || id });
    }
    for (const u of users) {
      if (u.role === 'seller') {
        const existing = map.get(u.uid);
        map.set(u.uid, {
          sellerId: u.uid,
          uid: u.uid,
          ownerName: existing?.ownerName || u.fullName || u.email || 'Seller Partner',
          email: existing?.email || u.email || '',
          phone: existing?.phone || u.phone || '',
          businessPhone: existing?.businessPhone || u.phone || '',
          restaurantId: existing?.restaurantId || `rest_${u.uid}`,
          verificationStatus: (existing?.verificationStatus || (u as any).verificationStatus || 'pending') as any,
          subscriptionStatus: (existing?.subscriptionStatus || u.subscriptionStatus || 'active') as any,
          upiTransactionRef: existing?.upiTransactionRef || u.upiTransactionRef,
          ...existing,
        });
      }
    }
    for (const d of documents) {
      if (!d.sellerId) continue;
      const existing = map.get(d.sellerId);
      if (!existing) {
        map.set(d.sellerId, {
          sellerId: d.sellerId,
          uid: d.sellerId,
          ownerName: d.sellerName || `Seller (${d.sellerId.slice(0, 6)})`,
          email: d.sellerEmail || '',
          phone: d.sellerPhone || '',
          businessPhone: d.sellerPhone || '',
          restaurantId: d.restaurantId || `rest_${d.sellerId}`,
          businessName: d.restaurantName || '',
          businessLicenseNumber: d.businessLicenseNumber || '',
          fssaiLicenseNumber: d.fssaiLicenseNumber || '',
          aadhaarOrPanNumber: d.aadhaarOrPanNumber || '',
          verificationStatus: d.verificationStatus === 'verified' ? 'verified' : 'pending',
          subscriptionStatus: 'active',
        });
      } else {
        map.set(d.sellerId, {
          ...existing,
          ownerName: existing.ownerName || d.sellerName || 'Seller Partner',
          businessPhone: existing.businessPhone || existing.phone || d.sellerPhone || '',
          businessLicenseNumber: existing.businessLicenseNumber || d.businessLicenseNumber || '',
          fssaiLicenseNumber: existing.fssaiLicenseNumber || d.fssaiLicenseNumber || '',
          aadhaarOrPanNumber: existing.aadhaarOrPanNumber || d.aadhaarOrPanNumber || '',
        });
      }
    }
    return Array.from(map.values());
  }, [sellers, users, documents]);

  // True Customer Count (all customer accounts in `users`)
  const trueCustomers = React.useMemo<User[]>(() => {
    const sellerIds = new Set(allSellers.map(s => s.sellerId));
    return users.filter(u => u.role === 'customer' || (!sellerIds.has(u.uid) && u.role !== 'admin' && u.role !== 'seller'));
  }, [users, allSellers]);

  const handleOpenPreviewDoc = async (docItem: SellerDocument) => {
    setPreviewDoc(docItem);
    setPreviewResolvedUrl(docItem.fileDataUrl || '');
    setLoadingPreviewUrl(true);
    try {
      const fullDataUrl = await resolveSellerDocumentDataUrl(docItem);
      setPreviewResolvedUrl(fullDataUrl);
    } finally {
      setLoadingPreviewUrl(false);
    }
  };

  // Actions
  const approveSeller = async (sellerId: string) => {
    const actorUid = user?.uid || 'admin_console';
    const sellerObj = allSellers.find(s => s.sellerId === sellerId || s.uid === sellerId);
    const targetRestId = sellerObj?.restaurantId || `rest_${sellerId}`;
    try {
      await setDoc(doc(db, 'sellers', sellerId), {
        sellerId,
        uid: sellerId,
        ownerName: sellerObj?.ownerName || 'Verified Seller',
        restaurantId: targetRestId,
        verificationStatus: 'verified',
        subscriptionStatus: 'active',
        accountPaused: false,
        verificationNotes: 'Approved by administrator. Product publishing unlocked.',
        updatedAt: serverTimestamp()
      }, { merge: true });

      await setDoc(doc(db, 'users', sellerId), {
        verificationStatus: 'verified',
        subscriptionStatus: 'active',
        accountStatus: 'active',
        updatedAt: serverTimestamp()
      }, { merge: true }).catch(() => {});

      await setDoc(doc(db, 'restaurants', targetRestId), {
        restaurantId: targetRestId,
        sellerId,
        restaurantName: sellerObj?.businessName || (sellerObj?.ownerName ? `${sellerObj.ownerName}'s Kitchen` : 'Food India Kitchen'),
        approvalStatus: 'approved',
        isOpen: true,
        updatedAt: serverTimestamp()
      }, { merge: true }).catch(() => {});

      // Also mark any uploaded documents for this seller as verified
      const sellerDocs = documents.filter(d => d.sellerId === sellerId);
      for (const d of sellerDocs) {
        await setDoc(doc(db, 'sellerDocuments', d.documentId), {
          verificationStatus: 'verified',
          verifiedBy: actorUid,
          rejectionReason: '',
          updatedAt: serverTimestamp()
        }, { merge: true }).catch(() => {});
      }

      await addDoc(collection(db, 'notifications'), {
        recipientUid: sellerId,
        recipientRole: 'seller',
        title: 'Seller Account & KYC Approved — Product Publishing Unlocked',
        body: 'Congratulations! Your seller profile, restaurant, and KYC documents have been approved by Admin. You can now publish dishes immediately.',
        channels: ['app', 'email', 'whatsapp'],
        emailDispatched: true,
        whatsappDispatched: true,
        createdAt: serverTimestamp(),
        readAt: null,
      }).catch(() => {});

      await logAdminAction(actorUid, 'APPROVE_SELLER', 'Seller', sellerId, 'Seller, restaurant, and KYC documents approved for product publishing').catch(() => {});
      reportGlobalButtonStatus({
        buttonName: 'Approve Seller & Unlock Product Publishing',
        screen: 'AdminDashboard (Sellers)',
        backendPath: `sellers/${sellerId}, restaurants/${targetRestId}, users/${sellerId}`,
        dbUpdated: 'UPDATED',
        statusType: 'success',
        message: `Approved seller ${sellerObj?.ownerName || sellerId}, approved restaurant ${targetRestId}, and unlocked product publishing in Firestore.`,
        suggestion: 'Seller can now add and publish products immediately.',
      });
      setAdminMessage(`Seller "${sellerObj?.ownerName || sellerId}" verified & approved! Product publishing is now enabled.`);
    } catch (err: any) {
      reportGlobalButtonStatus({
        buttonName: 'Approve Seller & KYC',
        screen: 'AdminDashboard (Sellers)',
        backendPath: `sellers/${sellerId}`,
        dbUpdated: 'NOT_UPDATED',
        statusType: 'error',
        message: err?.message || 'Failed to approve seller',
        suggestion: 'Check Firestore connectivity and try again.',
      });
      setAdminMessage(`Failed to approve seller: ${err?.message || 'Unknown error'}`);
    }
  };

  const rejectSeller = async (sellerId: string, notes: string) => {
    const actorUid = user?.uid || 'admin_console';
    const sellerObj = allSellers.find(s => s.sellerId === sellerId || s.uid === sellerId);
    const reason = notes.trim() || 'Application rejected. Please review your verification documents, ₹499 UPI UTR, and license numbers.';
    try {
      await setDoc(doc(db, 'sellers', sellerId), {
        sellerId,
        uid: sellerId,
        verificationStatus: 'rejected',
        verificationNotes: reason,
        updatedAt: serverTimestamp()
      }, { merge: true });
      await setDoc(doc(db, 'users', sellerId), {
        verificationStatus: 'rejected',
        updatedAt: serverTimestamp()
      }, { merge: true }).catch(() => {});
      await addDoc(collection(db, 'notifications'), {
        recipientUid: sellerId,
        recipientRole: 'seller',
        title: 'Seller KYC Verification Update',
        body: `Your seller verification requires attention: ${reason}`,
        channels: ['app', 'email', 'whatsapp'],
        emailDispatched: true,
        whatsappDispatched: true,
        createdAt: serverTimestamp(),
        readAt: null,
      }).catch(() => {});
      await logAdminAction(actorUid, 'REJECT_SELLER', 'Seller', sellerId, `Seller rejected: ${reason}`).catch(() => {});
      reportGlobalButtonStatus({
        buttonName: 'Reject Seller KYC',
        screen: 'AdminDashboard (Sellers)',
        backendPath: `sellers/${sellerId}`,
        dbUpdated: 'UPDATED',
        statusType: 'warning',
        message: `Rejected seller ${sellerObj?.ownerName || sellerId}: ${reason}`,
        suggestion: 'Seller has been notified in-app.',
      });
      setAdminMessage('Seller application rejected.');
    } catch (err: any) {
      setAdminMessage(err?.message || 'Failed to reject seller');
    }
  };

  const approveSellerDocument = async (document: SellerDocument) => {
    const actorUid = user?.uid || 'admin_console';
    const targetRestId = document.restaurantId || `rest_${document.sellerId}`;
    try {
      await setDoc(doc(db, 'sellerDocuments', document.documentId), {
        verificationStatus: 'verified',
        verifiedBy: actorUid,
        rejectionReason: '',
        updatedAt: serverTimestamp(),
      }, { merge: true });

      // Also mark the seller & their restaurant as verified/approved so approving their document in Admin unlocks product publishing
      await setDoc(doc(db, 'sellers', document.sellerId), {
        sellerId: document.sellerId,
        uid: document.sellerId,
        restaurantId: targetRestId,
        verificationStatus: 'verified',
        subscriptionStatus: 'active',
        accountPaused: false,
        verificationNotes: `KYC Document (${document.documentType.replace(/_/g, ' ')}) approved by Admin.`,
        updatedAt: serverTimestamp(),
      }, { merge: true });

      await setDoc(doc(db, 'users', document.sellerId), {
        verificationStatus: 'verified',
        subscriptionStatus: 'active',
        accountStatus: 'active',
        updatedAt: serverTimestamp(),
      }, { merge: true }).catch(() => {});

      await setDoc(doc(db, 'restaurants', targetRestId), {
        restaurantId: targetRestId,
        sellerId: document.sellerId,
        approvalStatus: 'approved',
        isOpen: true,
        updatedAt: serverTimestamp(),
      }, { merge: true }).catch(() => {});

      await addDoc(collection(db, 'notifications'), {
        recipientUid: document.sellerId,
        recipientRole: 'seller',
        title: `Document Approved: ${document.documentType.replace(/_/g, ' ').toUpperCase()}`,
        body: `Your uploaded ${document.documentType.replace(/_/g, ' ')} (${document.documentNumber || document.fileName || 'Document'}) was approved by Admin. Your seller account is now verified to publish products!`,
        channels: ['app', 'email', 'whatsapp'],
        emailDispatched: true,
        whatsappDispatched: true,
        createdAt: serverTimestamp(),
        readAt: null,
      }).catch(() => {});

      await logAdminAction(actorUid, 'APPROVE_DOCUMENT', 'SellerDocument', document.documentId, `Approved ${document.documentType} & unlocked publishing for seller ${document.sellerId}`).catch(() => {});
      reportGlobalButtonStatus({
        buttonName: `Approve Document (${document.documentType})`,
        screen: 'AdminDashboard (Seller Docs)',
        backendPath: `sellerDocuments/${document.documentId}, sellers/${document.sellerId}, restaurants/${targetRestId}`,
        dbUpdated: 'UPDATED',
        statusType: 'success',
        message: `Document ${document.documentType} verified and seller ${document.sellerName || document.sellerId} unlocked for product publishing.`,
        suggestion: 'Seller notified of document approval and product publishing enabled.',
      });
      setAdminMessage(`Approved ${document.documentType.replace(/_/g, ' ')} and verified seller ${document.sellerName || document.sellerId.substring(0, 8)} for product publishing!`);
    } catch (err: any) {
      reportGlobalButtonStatus({
        buttonName: `Approve Document (${document.documentType})`,
        screen: 'AdminDashboard (Seller Docs)',
        backendPath: `sellerDocuments/${document.documentId}`,
        dbUpdated: 'NOT_UPDATED',
        statusType: 'error',
        message: err?.message || 'Failed to approve document',
        suggestion: 'Retry approving the document.',
      });
      setAdminMessage(err?.message || 'Failed to approve document.');
    }
  };

  const rejectSellerDocument = async (document: SellerDocument) => {
    const actorUid = user?.uid || 'admin_console';
    const reason = noteInputBySeller[document.sellerId]?.trim() || 'Document unclear or license number mismatch. Please re-upload.';
    try {
      await setDoc(doc(db, 'sellerDocuments', document.documentId), {
        verificationStatus: 'rejected',
        verifiedBy: actorUid,
        rejectionReason: reason,
        updatedAt: serverTimestamp(),
      }, { merge: true });
      await setDoc(doc(db, 'sellers', document.sellerId), {
        verificationNotes: `Document (${document.documentType.replace(/_/g, ' ')}) rejected: ${reason}`,
        updatedAt: serverTimestamp(),
      }, { merge: true }).catch(() => {});
      await addDoc(collection(db, 'notifications'), {
        recipientUid: document.sellerId,
        recipientRole: 'seller',
        title: `Document Rejected: ${document.documentType.replace(/_/g, ' ').toUpperCase()}`,
        body: `Your ${document.documentType.replace(/_/g, ' ')} was rejected: ${reason}`,
        channels: ['app', 'email', 'whatsapp'],
        emailDispatched: true,
        whatsappDispatched: true,
        createdAt: serverTimestamp(),
        readAt: null,
      }).catch(() => {});
      await logAdminAction(actorUid, 'REJECT_DOCUMENT', 'SellerDocument', document.documentId, `Rejected ${document.documentType} for seller ${document.sellerId}: ${reason}`).catch(() => {});
      reportGlobalButtonStatus({
        buttonName: `Reject Document (${document.documentType})`,
        screen: 'AdminDashboard (Seller Docs)',
        backendPath: `sellerDocuments/${document.documentId}`,
        dbUpdated: 'UPDATED',
        statusType: 'warning',
        message: `Document ${document.documentType} rejected for seller ${document.sellerName || document.sellerId}.`,
        suggestion: 'Seller notified to re-upload document.',
      });
      setAdminMessage(`Rejected ${document.documentType.replace(/_/g, ' ')} for ${document.sellerName || document.sellerId.substring(0, 8)}.`);
    } catch (err: any) {
      setAdminMessage(err?.message || 'Failed to reject document.');
    }
  };

  const requestInfo = async (sellerId: string, customNotes?: string) => {
    const actorUid = user?.uid || 'admin_console';
    const msg = customNotes?.trim() || 'Additional documents or license numbers requested. Please check your verification tab.';
    await setDoc(doc(db, 'sellers', sellerId), {
      verificationStatus: 'pending',
      verificationNotes: msg,
      updatedAt: serverTimestamp()
    }, { merge: true });
    await logAdminAction(actorUid, 'REQUEST_INFO', 'Seller', sellerId, `Requested additional documents: ${msg}`).catch(() => {});
    reportGlobalButtonStatus({
      buttonName: 'Request Additional Seller Docs',
      screen: 'AdminDashboard (Sellers)',
      backendPath: `sellers/${sellerId}`,
      dbUpdated: 'UPDATED',
      statusType: 'success',
      message: `Sent document request to seller ${sellerId}: ${msg}`,
      suggestion: 'Seller will see this note on their Verification screen.',
    });
    setAdminMessage('Document request sent to seller.');
  };

  const toggleSuspendUser = async (uid: string, currentStatus?: string) => {
    if (!user) return;
    const nextStatus = currentStatus === 'suspended' ? 'active' : 'suspended';
    await updateDoc(doc(db, 'users', uid), {
      accountStatus: nextStatus,
      updatedAt: serverTimestamp()
    });
    await logAdminAction(user.uid, nextStatus === 'suspended' ? 'SUSPEND_USER' : 'ACTIVATE_USER', 'User', uid, `User status set to ${nextStatus}`);
    setAdminMessage(`User account ${nextStatus}.`);
  };

  const approveRestaurant = async (restaurantId: string) => {
    if (!user) return;
    await updateDoc(doc(db, 'restaurants', restaurantId), {
      approvalStatus: 'approved',
      updatedAt: serverTimestamp()
    });
    await logAdminAction(user.uid, 'APPROVE_RESTAURANT', 'Restaurant', restaurantId, 'Restaurant approved for listings');
    setAdminMessage('Restaurant approved.');
  };

  const toggleSuspendRestaurant = async (res: Restaurant) => {
    if (!user) return;
    const nextStatus = res.approvalStatus === 'rejected' ? 'approved' : 'rejected';
    await updateDoc(doc(db, 'restaurants', res.restaurantId), {
      approvalStatus: nextStatus,
      isOpen: nextStatus === 'approved' ? res.isOpen : false,
      updatedAt: serverTimestamp()
    });
    await logAdminAction(user.uid, 'UPDATE_RESTAURANT_STATUS', 'Restaurant', res.restaurantId, `Restaurant approvalStatus=${nextStatus}`);
    setAdminMessage(`Restaurant status updated to ${nextStatus}.`);
  };

  const [seedingCatalog, setSeedingCatalog] = useState(false);
  const [adminProductCategoryFilter, setAdminProductCategoryFilter] = useState<string>('all');

  const handleToggleProductAvailability = async (product: Product) => {
    if (!user) return;
    await updateDoc(doc(db, 'products', product.productId), {
      isAvailable: !product.isAvailable,
      updatedAt: serverTimestamp()
    });
    await logAdminAction(user.uid, 'TOGGLE_PRODUCT', 'Product', product.productId, `Product ${product.name} available=${!product.isAvailable}`);
  };

  const handleDeleteProduct = async (product: Product) => {
    await deleteDoc(doc(db, 'products', product.productId));
    if (user) {
      await logAdminAction(user.uid, 'DELETE_PRODUCT', 'Product', product.productId, `Deleted product ${product.name}`).catch(() => {});
    }
    setAdminMessage(`Product "${product.name}" deleted.`);
  };

  const handleSeedIndianCatalog = async () => {
    setSeedingCatalog(true);
    try {
      const res = await seedIndianTestProducts({ force: true });
      if (user) {
        await logAdminAction(
          user.uid,
          'SEED_INDIAN_CATALOG',
          'Catalog',
          'global',
          `Seeded ${res.categoriesSeeded} Indian categories and ${res.productsSeeded} test products`
        ).catch(() => {});
      }
      setAdminMessage(`Seeded ${res.categoriesSeeded} Indian food categories & ${res.productsSeeded} test products!`);
    } catch (err: any) {
      setAdminMessage(err?.message || 'Failed to seed Indian food catalog.');
    } finally {
      setSeedingCatalog(false);
    }
  };

  const handleDeleteAllTestProducts = async () => {
    setSeedingCatalog(true);
    try {
      const deletedCount = await deleteAllTestProducts();
      if (user) {
        await logAdminAction(
          user.uid,
          'DELETE_TEST_PRODUCTS',
          'Product',
          'test_products',
          `Deleted ${deletedCount} test products`
        ).catch(() => {});
      }
      setAdminMessage(`Deleted ${deletedCount} test product(s).`);
    } catch (err: any) {
      setAdminMessage(err?.message || 'Failed to delete test products.');
    } finally {
      setSeedingCatalog(false);
    }
  };

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newCategory.name.trim()) return;
    const subcategories = newCategory.subcategoriesText
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);

    const docRef = await addDoc(collection(db, 'categories'), {
      name: newCategory.name.trim(),
      imagePath: 'https://images.unsplash.com/photo-1585937421612-70a008356fbe?w=300&h=300&fit=crop',
      parentCategoryId: newCategory.parentCategoryId || null,
      subcategories,
      isGlobal: true,
      restaurantId: null,
      displayOrder: categories.length,
      sortOrder: categories.length + 1,
      isActive: true,
      createdAt: serverTimestamp()
    });
    await updateDoc(doc(db, 'categories', docRef.id), { categoryId: docRef.id });
    await logAdminAction(user.uid, 'CREATE_CATEGORY', 'Category', docRef.id, `Created category ${newCategory.name}`);
    setNewCategory({ name: '', parentCategoryId: '', subcategoriesText: '' });
    setAdminMessage(`Category "${newCategory.name}" created.`);
  };

  const handleDeleteCategory = async (cat: Category) => {
    if (!user) return;
    await deleteDoc(doc(db, 'categories', cat.categoryId));
    await logAdminAction(user.uid, 'DELETE_CATEGORY', 'Category', cat.categoryId, `Deleted category ${cat.name}`);
    setAdminMessage(`Category "${cat.name}" deleted.`);
  };

  const updateGlobalSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settings) return;
    const actorUid = user?.uid || 'admin_console';
    const baseAmt = Number(settings.plan499BaseAmount ?? 499);
    const gstRate = Number(settings.plan499GstRate ?? 18);
    const gstAmt = Number(((baseAmt * gstRate) / 100).toFixed(2));
    const totalAmt = Number((baseAmt + gstAmt).toFixed(2));
    const payload = {
      ...settings,
      companyName: settings.companyName || 'Food India (A Unit of KulgamKart)',
      parentUnitName: settings.parentUnitName || 'KulgamKart',
      parentWebsite: settings.parentWebsite || 'https://kulgamkart.in',
      udyamRegistrationNumber: settings.udyamRegistrationNumber || 'UDYAM-JK-11-0018721',
      gstNumber: settings.gstNumber || '01BMAPL3192D1CY',
      fssaiLicenseNumber: settings.fssaiLicenseNumber || 'अनुज्ञिप्त संख्या / License Number: 11026999000072',
      plan499BaseAmount: baseAmt,
      plan499GstRate: gstRate,
      plan499GstAmount: gstAmt,
      plan499TotalAmount: totalAmt,
      updatedAt: serverTimestamp()
    };
    await setDoc(doc(db, 'adminSettings', 'global'), payload, { merge: true });
    await setDoc(doc(db, 'adminSettings', 'companyProfile'), {
      unitStatement: 'Food India is a unit of KulgamKart',
      companyName: payload.companyName,
      parentUnitName: payload.parentUnitName,
      website: 'kulgamkart.in',
      websiteUrl: payload.parentWebsite,
      udyamRegistrationNumber: payload.udyamRegistrationNumber,
      gstNumber: payload.gstNumber,
      fssaiLicenseNumber: payload.fssaiLicenseNumber,
      fssaiLicenseCode: '11026999000072',
      plan499BaseAmount: baseAmt,
      plan499GstRate: gstRate,
      plan499GstAmount: gstAmt,
      plan499TotalAmount: totalAmt,
      updatedAt: serverTimestamp(),
    }, { merge: true });
    await logAdminAction(actorUid, 'UPDATE_SETTINGS', 'AdminSettings', 'global', 'Global admin profile, KulgamKart, Udyam, GST & FSSAI settings updated').catch(() => {});
    setAdminMessage('Admin Profile, KulgamKart, Udyam, GST (01BMAPL3192D1CY), and FSSAI (11026999000072) saved to Firestore!');
  };

  const handleCreatePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const priceNum = parseFloat(newPlan.price);
    const durationNum = parseInt(newPlan.durationDays, 10);
    if (!newPlan.name.trim() || !Number.isFinite(priceNum) || priceNum <= 0 || !Number.isFinite(durationNum) || durationNum <= 0) {
      setAdminMessage('Please provide a valid plan name, price, and duration.');
      return;
    }

    const features = newPlan.featuresText
      .split('\n')
      .map(f => f.trim())
      .filter(Boolean);

    const docRef = await addDoc(collection(db, 'subscriptionPlans'), {
      name: newPlan.name.trim(),
      price: priceNum,
      currency: newPlan.currency.trim().toUpperCase() || 'INR',
      durationDays: durationNum,
      features,
      isActive: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    await updateDoc(doc(db, 'subscriptionPlans', docRef.id), {
      planId: docRef.id,
    });

    await logAdminAction(
      user.uid,
      'CREATE_SUBSCRIPTION_PLAN',
      'SubscriptionPlan',
      docRef.id,
      `Created plan ${newPlan.name} (${newPlan.currency} ${priceNum} for ${durationNum} days)`
    );

    setShowPlanModal(false);
    setNewPlan({
      name: '',
      price: '',
      currency: 'INR',
      durationDays: '30',
      featuresText: 'Unlimited Menu Items\n0% Marketplace Commission\n100% COD Order Support\nLive Google Maps Directions',
    });
    setAdminMessage(`Subscription plan "${newPlan.name}" created.`);
  };

  const togglePlanActive = async (plan: SubscriptionPlan) => {
    if (!user) return;
    await updateDoc(doc(db, 'subscriptionPlans', plan.planId), {
      isActive: !plan.isActive,
      updatedAt: serverTimestamp(),
    });
    await logAdminAction(
      user.uid,
      'TOGGLE_PLAN_STATUS',
      'SubscriptionPlan',
      plan.planId,
      `Set plan ${plan.name} active=${!plan.isActive}`
    );
  };

  const activateEligibleSubscription = async (payment: Payment) => {
    if (!user) return;
    setActivatingPaymentId(payment.paymentId);
    try {
      const durationDays = Number(payment.durationDays || 30);
      const startDate = new Date();
      const expiryDate = new Date(startDate.getTime() + durationDays * 24 * 60 * 60 * 1000);

      if (payment.subscriptionId) {
        await setDoc(doc(db, 'sellerSubscriptions', payment.subscriptionId), {
          activationStatus: 'active',
          paymentStatus: 'paid',
          startDate: startDate.toISOString(),
          expiryDate: expiryDate.toISOString(),
          activatedBy: user.uid,
          updatedAt: serverTimestamp(),
        }, { merge: true });
      }

      await setDoc(doc(db, 'sellers', payment.sellerId), {
        planId: payment.planId || 'plan_499_30days',
        subscriptionStatus: 'active',
        accountPaused: false,
        subscriptionStartDate: startDate.toISOString(),
        subscriptionExpiryDate: expiryDate.toISOString(),
        ...(payment.upiTransactionRef ? { upiTransactionRef: payment.upiTransactionRef } : {}),
        updatedAt: serverTimestamp(),
      }, { merge: true });

      await setDoc(doc(db, 'users', payment.sellerId), {
        subscriptionStatus: 'active',
        subscriptionStartDate: startDate.toISOString(),
        subscriptionExpiryDate: expiryDate.toISOString(),
        updatedAt: serverTimestamp(),
      }, { merge: true }).catch(() => {});

      await updateDoc(doc(db, 'payments', payment.paymentId), {
        paymentStatus: 'paid',
        webhookVerified: true,
        activatedByAdmin: true,
        updatedAt: serverTimestamp(),
      });

      await logAdminAction(
        user.uid,
        'ACTIVATE_SUBSCRIPTION',
        'SellerSubscription',
        payment.subscriptionId || payment.paymentId,
        `Activated 30-day subscription (₹499) for seller ${payment.sellerId} (UTR: ${payment.upiTransactionRef || payment.razorpayPaymentId || 'Verified'})`
      );

      setAdminMessage(`Activated 30-day ₹499 subscription for seller ${payment.sellerName || payment.sellerId}.`);
    } catch (error: any) {
      console.error('Error activating subscription:', error);
      setAdminMessage(error?.message || 'Failed to activate seller subscription.');
    } finally {
      setActivatingPaymentId(null);
    }
  };

  const activateSeller30DaySubDirect = async (sellerObj: Seller) => {
    if (!user) return;
    const startDate = new Date();
    const expiryDate = new Date(startDate.getTime() + 30 * 24 * 60 * 60 * 1000);
    await setDoc(doc(db, 'sellers', sellerObj.sellerId), {
      subscriptionStatus: 'active',
      accountPaused: false,
      subscriptionStartDate: startDate.toISOString(),
      subscriptionExpiryDate: expiryDate.toISOString(),
      updatedAt: serverTimestamp(),
    }, { merge: true });
    await setDoc(doc(db, 'users', sellerObj.uid), {
      subscriptionStatus: 'active',
      subscriptionStartDate: startDate.toISOString(),
      subscriptionExpiryDate: expiryDate.toISOString(),
      updatedAt: serverTimestamp(),
    }, { merge: true }).catch(() => {});
    await logAdminAction(user.uid, 'VERIFY_UPI_SUBSCRIPTION', 'Seller', sellerObj.sellerId, `Verified ₹499 UPI Ref (${sellerObj.upiTransactionRef || 'UTR'}) & activated for 30 days`);
    setAdminMessage(`Activated 30-day subscription for ${sellerObj.ownerName} until ${expiryDate.toLocaleDateString('en-IN')}.`);
  };

  const pauseSellerAccountSub = async (sellerObj: Seller) => {
    if (!user) return;
    await setDoc(doc(db, 'sellers', sellerObj.sellerId), {
      subscriptionStatus: 'paused',
      accountPaused: true,
      updatedAt: serverTimestamp(),
    }, { merge: true });
    await logAdminAction(user.uid, 'PAUSE_SELLER_SUBSCRIPTION', 'Seller', sellerObj.sellerId, 'Paused seller account awaiting ₹499 renewal');
    setAdminMessage(`Paused seller account for ${sellerObj.ownerName}. Seller will be prompted to pay ₹499 to resume.`);
  };

  const toggleSellerGstPermission = async (sellerObj: Seller) => {
    const actorUid = user?.uid || 'admin_console';
    const matchingRes = restaurants.find(
      (r) => r.restaurantId === sellerObj.restaurantId || r.sellerId === sellerObj.sellerId || r.sellerId === sellerObj.uid
    );
    const currentGst = Boolean(sellerObj.gstEnabled || matchingRes?.gstEnabled);
    const nextGst = !currentGst;

    try {
      await setDoc(
        doc(db, 'sellers', sellerObj.sellerId),
        {
          gstEnabled: nextGst,
          gstRate: nextGst ? 5 : 0,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
      await setDoc(
        doc(db, 'users', sellerObj.uid || sellerObj.sellerId),
        {
          gstEnabled: nextGst,
          gstRate: nextGst ? 5 : 0,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      ).catch(() => {});

      const targetRestId = matchingRes?.restaurantId || sellerObj.restaurantId || `rest_${sellerObj.uid}`;
      await setDoc(
        doc(db, 'restaurants', targetRestId),
        {
          gstEnabled: nextGst,
          gstRate: nextGst ? 5 : 0,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      ).catch(() => {});

      await logAdminAction(
        actorUid,
        nextGst ? 'ENABLE_SELLER_5_PERCENT_GST' : 'DISABLE_SELLER_5_PERCENT_GST',
        'Seller',
        sellerObj.sellerId,
        `${nextGst ? 'Allowed' : 'Disabled'} separate 5% GST billing for seller ${sellerObj.ownerName}`
      ).catch(() => {});

      reportGlobalButtonStatus({
        buttonName: `${nextGst ? 'Allow' : 'Disable'} 5% GST (${sellerObj.ownerName})`,
        screen: 'AdminDashboard (Sellers)',
        backendPath: `sellers/${sellerObj.sellerId} & restaurants/${targetRestId}`,
        dbUpdated: 'UPDATED',
        statusType: 'success',
        message: `5% GST billing ${nextGst ? 'ENABLED' : 'DISABLED'} for ${sellerObj.ownerName}. Separate 5% GST line will ${nextGst ? 'now appear' : 'not appear'} on Customer & Seller bills.`,
      });
      setAdminMessage(
        `5% GST on bills ${nextGst ? 'ALLOWED' : 'DISABLED'} for ${sellerObj.ownerName}.`
      );
    } catch (err: any) {
      setAdminMessage(err?.message || 'Failed to update 5% GST permission.');
    }
  };

  const toggleRestaurantGstPermission = async (res: Restaurant) => {
    const actorUid = user?.uid || 'admin_console';
    const nextGst = !res.gstEnabled;
    try {
      await setDoc(
        doc(db, 'restaurants', res.restaurantId),
        {
          gstEnabled: nextGst,
          gstRate: nextGst ? 5 : 0,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
      if (res.sellerId) {
        await setDoc(
          doc(db, 'sellers', res.sellerId),
          {
            gstEnabled: nextGst,
            gstRate: nextGst ? 5 : 0,
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        ).catch(() => {});
      }
      await logAdminAction(
        actorUid,
        nextGst ? 'ENABLE_RESTAURANT_5_PERCENT_GST' : 'DISABLE_RESTAURANT_5_PERCENT_GST',
        'Restaurant',
        res.restaurantId,
        `${nextGst ? 'Allowed' : 'Disabled'} 5% GST for restaurant ${res.restaurantName}`
      ).catch(() => {});
      setAdminMessage(
        `5% GST on bills ${nextGst ? 'ALLOWED' : 'DISABLED'} for ${res.restaurantName}.`
      );
    } catch (err: any) {
      setAdminMessage(err?.message || 'Failed to update restaurant GST permission.');
    }
  };

  // Renderers
  const renderSellers = () => (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h2 className="text-2xl font-black text-slate-900">Seller Applications, KYC & 5% GST Control ({allSellers.length})</h2>
          <p className="text-xs font-bold text-slate-400 mt-0.5">
            All registered sellers and uploaded KYC documents appear here in real time. Approving a seller unlocks product publishing immediately. Toggle <strong>Allow 5% GST</strong> to add a separate 5% GST line on that seller&apos;s and customer&apos;s bills.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="bg-orange-50 border border-orange-200 px-4 py-2 rounded-full text-xs font-black text-orange-700 uppercase tracking-widest">
            {allSellers.filter(s => s.verificationStatus !== 'verified').length} Pending Approval
          </div>
          <div className="bg-emerald-50 border border-emerald-200 px-4 py-2 rounded-full text-xs font-black text-emerald-700 uppercase tracking-widest">
            {allSellers.filter(s => s.verificationStatus === 'verified').length} Verified
          </div>
        </div>
      </div>

      <div className="grid gap-4">
        {allSellers.map((seller) => {
          const sellerUser = users.find(u => u.uid === seller.uid || u.uid === seller.sellerId);
          const sellerDocs = documents.filter(d => d.sellerId === seller.sellerId || d.sellerId === seller.uid);
          const matchingRes = restaurants.find(
            (r) => r.restaurantId === seller.restaurantId || r.sellerId === seller.sellerId || r.sellerId === seller.uid
          );
          const isGstAllowed = Boolean(seller.gstEnabled || matchingRes?.gstEnabled);
          const isSuspended = sellerUser?.accountStatus === 'suspended';
          const noteVal = noteInputBySeller[seller.sellerId] ?? '';
          const bizLicense = seller.businessLicenseNumber || sellerDocs.find(d => d.businessLicenseNumber)?.businessLicenseNumber || sellerDocs.find(d => d.documentType === 'gst_certificate')?.documentNumber || '';
          const fssaiNum = seller.fssaiLicenseNumber || sellerDocs.find(d => d.fssaiLicenseNumber)?.fssaiLicenseNumber || sellerDocs.find(d => d.documentType === 'fssai_license')?.documentNumber || '';
          const aadhaarPan = seller.aadhaarOrPanNumber || sellerDocs.find(d => d.aadhaarOrPanNumber)?.aadhaarOrPanNumber || sellerDocs.find(d => d.documentType === 'id_proof')?.documentNumber || '';

          return (
            <div key={seller.sellerId} className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center text-slate-400">
                    <Users size={24} />
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900">{seller.ownerName}</h4>
                    <p className="text-xs text-slate-500 font-medium">
                      Phone: <span className="font-bold text-slate-800">{seller.businessPhone || sellerUser?.phone || 'Not set'}</span> • Email: {sellerUser?.email || 'N/A'} • UID: {seller.uid.substring(0, 8)}...
                    </p>
                    <div className="flex flex-wrap items-center gap-2 mt-1.5">
                      <span className={`text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full ${
                        seller.verificationStatus === 'verified' ? 'bg-green-100 text-green-700' :
                        seller.verificationStatus === 'rejected' ? 'bg-red-100 text-red-600' :
                        'bg-orange-100 text-orange-600'
                      }`}>
                        KYC: {seller.verificationStatus}
                      </span>
                      <span className={`text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full ${
                        seller.subscriptionStatus === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
                      }`}>
                        Sub: {seller.subscriptionStatus}
                      </span>
                      <span className={`text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full ${
                        isGstAllowed ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600'
                      }`}>
                        {isGstAllowed ? '5% GST Allowed on Bills' : '0% GST (Disabled)'}
                      </span>
                      <span className="text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700">
                        Uploaded Docs: {sellerDocs.length}
                      </span>
                      {isSuspended && (
                        <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-red-600 text-white">
                          Suspended
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => toggleSellerGstPermission(seller)}
                    className={`p-3 rounded-xl transition-colors flex items-center gap-1.5 text-xs font-black uppercase tracking-wider border ${
                      isGstAllowed
                        ? 'bg-emerald-600 text-white border-emerald-600 hover:bg-emerald-700'
                        : 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                    }`}
                    title="Allow or disable separate 5% GST on this seller's and customer's bills"
                  >
                    <CreditCard size={15} />
                    {isGstAllowed ? '5% GST Allowed (Disable)' : 'Allow 5% GST on Bills'}
                  </button>
                  <button 
                    onClick={() => setActiveTab('documents')}
                    className="p-3 bg-slate-50 text-slate-700 rounded-xl hover:bg-slate-100 transition-colors flex items-center gap-2 text-xs font-bold"
                  >
                    <FileText size={18} />
                    Review Docs ({sellerDocs.length})
                  </button>
                  <button 
                    onClick={() => requestInfo(seller.sellerId, noteVal)}
                    className="p-3 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-100 transition-colors flex items-center gap-1 text-xs font-bold"
                    title="Request Additional Documents"
                  >
                    <MessageSquare size={16} />
                    Request Docs
                  </button>
                  {seller.verificationStatus !== 'verified' && (
                    <button 
                      onClick={() => approveSeller(seller.sellerId)}
                      className="p-3 bg-green-600 text-white rounded-xl hover:bg-green-700 transition-colors flex items-center gap-1 text-xs font-black uppercase tracking-wider shadow-sm"
                    >
                      <CheckCircle2 size={16} /> Approve Seller
                    </button>
                  )}
                  {seller.verificationStatus !== 'rejected' && (
                    <button 
                      onClick={() => rejectSeller(seller.sellerId, noteVal)}
                      className="p-3 bg-amber-50 text-amber-700 rounded-xl hover:bg-amber-100 transition-colors flex items-center gap-1 text-xs font-bold"
                    >
                      <XCircle size={16} /> Reject
                    </button>
                  )}
                  <button 
                    onClick={() => toggleSuspendUser(seller.uid, sellerUser?.accountStatus)}
                    className={`p-3 rounded-xl transition-colors flex items-center gap-1 text-xs font-bold ${
                      isSuspended ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600 hover:bg-red-100'
                    }`}
                  >
                    <Ban size={16} />
                    {isSuspended ? 'Unsuspend' : 'Suspend'}
                  </button>
                </div>
              </div>

              {/* Permanent License Numbers, UPI Transaction Ref & Uploaded Documents Quick View */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3 pt-3 border-t border-slate-100">
                <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Business License / GST Number</span>
                  <span className="text-xs font-black text-slate-900 mt-0.5 block font-mono">
                    {bizLicense || 'Not entered yet'}
                  </span>
                </div>
                <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">FSSAI License Number</span>
                  <span className="text-xs font-black text-slate-900 mt-0.5 block font-mono">
                    {fssaiNum || 'Not entered yet'}
                  </span>
                </div>
                <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Aadhaar Card / PAN Number</span>
                  <span className="text-xs font-black text-slate-900 mt-0.5 block font-mono">
                    {aadhaarPan || 'Not entered yet'}
                  </span>
                </div>
                <div className="bg-emerald-50/70 p-3 rounded-2xl border border-emerald-200 space-y-1.5">
                  <span className="text-[9px] font-black text-emerald-800 uppercase tracking-widest block">
                    UPI Ref (8825018335@axl • ₹499)
                  </span>
                  <div className="flex items-center justify-between gap-1.5">
                    <span className="text-xs font-black text-emerald-950 font-mono truncate">
                      {seller.upiTransactionRef || sellerUser?.upiTransactionRef || 'No UTR submitted'}
                    </span>
                    {(seller.upiTransactionRef || sellerUser?.upiTransactionRef) && (
                      <button
                        type="button"
                        onClick={() => handleCopyRef(seller.upiTransactionRef || sellerUser?.upiTransactionRef || '')}
                        className="px-2 py-1 bg-white hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-lg text-[10px] font-black uppercase flex items-center gap-1 shrink-0"
                        title="Copy UPI Transaction Reference"
                      >
                        {copiedRefText === (seller.upiTransactionRef || sellerUser?.upiTransactionRef) ? (
                          <Check size={11} />
                        ) : (
                          <Copy size={11} />
                        )}
                        Copy
                      </button>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 pt-1">
                    <button
                      type="button"
                      onClick={() => activateSeller30DaySubDirect(seller)}
                      className="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[9px] font-black uppercase tracking-wider"
                    >
                      Verify 30d
                    </button>
                    <button
                      type="button"
                      onClick={() => pauseSellerAccountSub(seller)}
                      className="px-2 py-1 bg-amber-100 hover:bg-amber-200 text-amber-800 rounded-lg text-[9px] font-black uppercase tracking-wider"
                    >
                      Pause Sub
                    </button>
                  </div>
                </div>
              </div>

              {sellerDocs.length > 0 && (
                <div className="pt-2 space-y-2">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Uploaded Verification Files:</p>
                  <div className="flex flex-wrap gap-2">
                    {sellerDocs.map(docItem => (
                      <div key={docItem.documentId} className="flex items-center gap-2 bg-slate-50 border border-slate-200 px-3 py-2 rounded-xl text-xs">
                        <span className="font-black text-slate-800 uppercase text-[10px]">
                          {docItem.documentType.replace(/_/g, ' ')}
                        </span>
                        {docItem.documentNumber && (
                          <span className="font-mono text-[10px] bg-white px-1.5 py-0.5 rounded border border-slate-200 text-slate-700">
                            #{docItem.documentNumber}
                          </span>
                        )}
                        <span className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded ${
                          docItem.verificationStatus === 'verified' ? 'bg-green-100 text-green-700' :
                          docItem.verificationStatus === 'rejected' ? 'bg-red-100 text-red-600' :
                          'bg-amber-100 text-amber-700'
                        }`}>
                          {docItem.verificationStatus}
                        </span>
                        <button
                          type="button"
                          onClick={() => downloadSellerDocumentFile(docItem)}
                          className="p-1 bg-blue-50 text-blue-600 rounded hover:bg-blue-100"
                          title="Download Document"
                        >
                          <Download size={13} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleOpenPreviewDoc(docItem)}
                          className="p-1 bg-slate-200 text-slate-700 rounded hover:bg-slate-300"
                          title="Preview Document"
                        >
                          <Eye size={13} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex items-center gap-2 pt-2 border-t border-slate-50">
                <input
                  type="text"
                  value={noteVal}
                  onChange={e => setNoteInputBySeller(prev => ({ ...prev, [seller.sellerId]: e.target.value }))}
                  placeholder="Optional admin note for document request or rejection..."
                  className="flex-1 h-10 px-3 bg-slate-50 rounded-xl text-xs font-medium outline-none border border-transparent focus:border-orange-500"
                />
                {seller.verificationNotes && (
                  <span className="text-[11px] text-slate-400 italic truncate max-w-xs">
                    Last note: {seller.verificationNotes}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  const renderRestaurants = () => (
    <div className="space-y-6">
      <h2 className="text-2xl font-black text-slate-900 mb-6">Manage Restaurants & 5% GST Billing</h2>
      <div className="grid gap-4">
        {restaurants.map(res => (
          <div key={res.restaurantId} className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex flex-wrap items-center gap-4">
            <img src={res.logoPath || 'https://picsum.photos/seed/rest/100/100'} alt="" className="w-16 h-16 rounded-2xl object-cover border border-slate-50" />
            <div className="flex-1 min-w-[200px]">
              <h4 className="font-bold text-slate-900">{res.restaurantName}</h4>
              <p className="text-xs text-slate-400">{res.address}</p>
              <div className="flex flex-wrap items-center gap-2 mt-1">
                <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
                  res.approvalStatus === 'approved' ? 'bg-green-100 text-green-600' :
                  res.approvalStatus === 'rejected' ? 'bg-red-100 text-red-600' :
                  'bg-orange-100 text-orange-600'
                }`}>
                  {res.approvalStatus || 'Pending Approval'}
                </span>
                <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
                  res.gstEnabled ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600'
                }`}>
                  {res.gstEnabled ? '5% GST Enabled' : '0% GST'}
                </span>
                <span className="text-[10px] font-bold text-slate-400 uppercase">
                  Max Delivery: {res.maximumDeliveryDistanceKm || 10} km
                </span>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => toggleRestaurantGstPermission(res)}
                className={`px-3.5 py-2 rounded-xl text-xs font-black uppercase tracking-wider border transition-colors ${
                  res.gstEnabled
                    ? 'bg-emerald-600 text-white border-emerald-600 hover:bg-emerald-700'
                    : 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                }`}
              >
                {res.gstEnabled ? '5% GST Allowed (Disable)' : 'Allow 5% GST'}
              </button>
              {res.approvalStatus !== 'approved' && (
                <button 
                  onClick={() => approveRestaurant(res.restaurantId)}
                  className="px-4 py-2 bg-green-500 text-white rounded-xl text-xs font-bold uppercase tracking-widest shadow-lg shadow-green-100"
                >
                  Approve
                </button>
              )}
              <button
                onClick={() => toggleSuspendRestaurant(res)}
                className="p-3 bg-red-50 text-red-600 rounded-xl hover:bg-red-100 transition-colors flex items-center gap-1 text-xs font-bold"
              >
                <Ban size={16} />
                {res.approvalStatus === 'rejected' ? 'Restore' : 'Suspend'}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const filteredAdminProducts = adminProductCategoryFilter === 'all'
    ? products
    : products.filter(p => p.categoryId === adminProductCategoryFilter);

  const renderProducts = () => (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900">Manage Products ({products.length})</h2>
          <p className="text-xs font-bold text-slate-400 mt-1">
            Delete any test or seller product, toggle availability, or seed all Indian food categories & test products.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={seedingCatalog}
            onClick={handleSeedIndianCatalog}
            className="px-4 py-2.5 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white rounded-2xl text-xs font-black uppercase tracking-wider flex items-center gap-2 shadow-sm transition-colors"
          >
            {seedingCatalog ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
            Seed All Indian Categories & Test Products
          </button>
          <button
            type="button"
            disabled={seedingCatalog}
            onClick={handleDeleteAllTestProducts}
            className="px-4 py-2.5 bg-red-50 hover:bg-red-100 disabled:opacity-50 text-red-600 border border-red-200 rounded-2xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 transition-colors"
          >
            <Trash2 size={14} />
            Delete All Test Products
          </button>
        </div>
      </div>

      {/* Category Filter Pills */}
      <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
        <button
          type="button"
          onClick={() => setAdminProductCategoryFilter('all')}
          className={`px-3.5 py-1.5 rounded-xl text-[11px] font-black uppercase tracking-wider whitespace-nowrap border ${
            adminProductCategoryFilter === 'all'
              ? 'bg-slate-900 text-white border-slate-900'
              : 'bg-white text-slate-600 border-slate-200'
          }`}
        >
          All Categories ({products.length})
        </button>
        {categories.map(cat => {
          const cnt = products.filter(p => p.categoryId === cat.categoryId).length;
          return (
            <button
              key={cat.categoryId}
              type="button"
              onClick={() => setAdminProductCategoryFilter(cat.categoryId)}
              className={`px-3.5 py-1.5 rounded-xl text-[11px] font-black uppercase tracking-wider whitespace-nowrap border ${
                adminProductCategoryFilter === cat.categoryId
                  ? 'bg-orange-500 text-white border-orange-500'
                  : 'bg-white text-slate-600 border-slate-200'
              }`}
            >
              {cat.name} ({cnt})
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredAdminProducts.map(prod => {
          const isTest = Boolean(prod.isTestProduct || prod.productId?.startsWith('test_prod_'));
          const displayPrice = prod.price ?? prod.basePrice ?? 0;
          return (
            <div key={prod.productId} className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm flex items-center gap-4">
              <img
                src={prod.imagePaths?.[0] || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=200&h=200&fit=crop'}
                alt={prod.name}
                className="w-16 h-16 rounded-2xl object-cover bg-slate-100 shrink-0"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <h4 className="font-bold text-slate-900 truncate">{prod.name}</h4>
                  {isTest && (
                    <span className="px-2 py-0.5 bg-amber-100 text-amber-800 rounded-md text-[9px] font-black uppercase shrink-0">
                      Test
                    </span>
                  )}
                </div>
                <p className="text-xs font-black text-orange-500 mt-0.5">₹{displayPrice}</p>
                <p className="text-[10px] text-slate-400 uppercase font-bold mt-0.5 truncate">
                  {prod.categoryId} • {prod.foodType || (prod.isVeg ? 'veg' : 'non-veg')} • {prod.isAvailable ? 'Available' : 'Hidden'}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => handleToggleProductAvailability(prod)}
                  className={`px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest ${
                    prod.isAvailable ? 'bg-green-50 text-green-600' : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  {prod.isAvailable ? 'Active' : 'Hidden'}
                </button>
                <button
                  type="button"
                  onClick={() => handleDeleteProduct(prod)}
                  className="px-3 py-2 bg-red-50 text-red-600 rounded-xl hover:bg-red-100 text-[10px] font-black uppercase tracking-widest flex items-center gap-1 transition-colors"
                  title="Delete Product"
                >
                  <Trash2 size={14} />
                  <span>Delete</span>
                </button>
              </div>
            </div>
          );
        })}
        {filteredAdminProducts.length === 0 && (
          <div className="col-span-full bg-white p-10 rounded-3xl text-center space-y-3">
            <p className="text-sm text-slate-400 italic">No products found in this view.</p>
            <button
              type="button"
              onClick={handleSeedIndianCatalog}
              className="px-4 py-2 bg-orange-500 text-white rounded-xl text-xs font-black uppercase tracking-widest"
            >
              Seed Indian Food Categories & Test Products
            </button>
          </div>
        )}
      </div>
    </div>
  );

  const renderCategories = () => (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-black text-slate-900">Indian Food Categories & Subcategories ({categories.length})</h2>
          <p className="text-xs font-bold text-slate-400 mt-1">
            Manage all Indian food categories and regional specialties across the platform.
          </p>
        </div>
        <button
          type="button"
          disabled={seedingCatalog}
          onClick={handleSeedIndianCatalog}
          className="px-4 py-2.5 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white rounded-2xl text-xs font-black uppercase tracking-wider flex items-center gap-2 shadow-sm"
        >
          {seedingCatalog ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
          Seed All 20 Indian Categories & Test Products
        </button>
      </div>

      <form onSubmit={handleCreateCategory} className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm space-y-4">
        <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest">Create Category / Subcategories</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <input
            type="text"
            required
            value={newCategory.name}
            onChange={e => setNewCategory({ ...newCategory, name: e.target.value })}
            placeholder="Category Name (e.g. Biryani)"
            className="h-12 px-4 bg-slate-50 rounded-xl text-sm font-bold outline-none border border-transparent focus:border-orange-500"
          />
          <select
            value={newCategory.parentCategoryId}
            onChange={e => setNewCategory({ ...newCategory, parentCategoryId: e.target.value })}
            className="h-12 px-4 bg-slate-50 rounded-xl text-sm font-bold outline-none border border-transparent focus:border-orange-500"
          >
            <option value="">Top-Level Category</option>
            {categories.map(c => (
              <option key={c.categoryId} value={c.categoryId}>Parent: {c.name}</option>
            ))}
          </select>
          <input
            type="text"
            value={newCategory.subcategoriesText}
            onChange={e => setNewCategory({ ...newCategory, subcategoriesText: e.target.value })}
            placeholder="Subcategories (comma separated)"
            className="h-12 px-4 bg-slate-50 rounded-xl text-sm font-bold outline-none border border-transparent focus:border-orange-500"
          />
        </div>
        <button
          type="submit"
          className="px-6 py-3 bg-slate-900 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-orange-500 transition-colors flex items-center gap-2"
        >
          <Plus size={16} /> Add Category
        </button>
      </form>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {categories.map(cat => (
          <div key={cat.categoryId} className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm flex items-start justify-between gap-3">
            <div className="flex items-start gap-3 min-w-0">
              {cat.imagePath && (
                <img
                  src={cat.imagePath}
                  alt={cat.name}
                  className="w-12 h-12 rounded-2xl object-cover bg-slate-100 shrink-0"
                />
              )}
              <div className="min-w-0">
                <h4 className="font-bold text-slate-900 truncate">{cat.name}</h4>
                <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mt-0.5">
                  {cat.isGlobal !== false ? 'Global Indian Category' : `Restaurant: ${cat.restaurantId?.substring(0, 6)}`}
                </p>
                {(cat as any).subcategories?.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {(cat as any).subcategories.map((sub: string, i: number) => (
                      <span key={i} className="text-[10px] font-bold bg-orange-50 text-orange-600 px-2 py-0.5 rounded-lg">
                        {sub}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={() => handleDeleteCategory(cat)}
              className="p-2 bg-red-50 text-red-600 rounded-xl hover:bg-red-100 shrink-0"
              title="Delete Category"
            >
              <Trash2 size={16} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );

  const renderPayments = () => (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-black text-slate-900">UPI Subscription Payments (₹499 / 30 Days)</h2>
          <p className="text-xs font-bold text-slate-400 mt-1">
            Copy seller UPI Transaction Reference IDs (paid to <strong>8825018335@axl</strong>) and activate 30-day subscriptions.
          </p>
        </div>
        <div className="bg-emerald-50 border border-emerald-200 px-4 py-2 rounded-2xl text-xs font-black text-emerald-700 uppercase tracking-widest">
          UPI: 8825018335@axl • Exact ₹499 / 30 Days
        </div>
      </div>

      <div className="bg-white rounded-[32px] border border-slate-100 shadow-sm overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-100">
              <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Date</th>
              <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Seller & Plan</th>
              <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Amount</th>
              <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Copiable UPI Transaction Ref (UTR)</th>
              <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Status</th>
              <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Admin Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {payments.map(p => {
              const utrRef = p.upiTransactionRef || p.razorpayPaymentId || p.razorpayPaymentLinkId || '';
              return (
                <tr key={p.paymentId}>
                  <td className="px-6 py-4 text-xs font-bold text-slate-400">
                    {p.createdAt?.toDate ? format(p.createdAt.toDate(), 'MMM dd, HH:mm') : 'Recent'}
                  </td>
                  <td className="px-6 py-4">
                    <p className="font-bold text-slate-900 text-sm">{p.sellerName || `${p.sellerId.substring(0, 8)}...`}</p>
                    <p className="text-[11px] font-bold text-orange-500 uppercase">{p.planName || p.planId} ({p.durationDays || 30}d)</p>
                    <p className="text-[10px] font-mono text-slate-500 mt-0.5">
                      GSTIN: {p.gstNumber || '01BMAPL3192D1CY'}
                    </p>
                  </td>
                  <td className="px-6 py-4 font-black text-slate-900">
                    <div>₹{p.baseAmount || 499} <span className="text-[10px] text-emerald-600 font-bold">+ ₹{p.gstAmount ?? 89.82} GST</span></div>
                    <div className="text-[11px] font-bold text-slate-600">Total w/ 18% GST: ₹{p.totalWithGst ?? 588.82}</div>
                  </td>
                  <td className="px-6 py-4 text-xs font-mono text-slate-700">
                    <div className="flex items-center gap-2">
                      <span className="font-black bg-slate-100 px-2.5 py-1 rounded-lg">{utrRef || 'N/A'}</span>
                      {utrRef && (
                        <button
                          type="button"
                          onClick={() => handleCopyRef(utrRef)}
                          className="px-2.5 py-1 bg-orange-50 hover:bg-orange-100 text-orange-600 rounded-lg text-[10px] font-black uppercase flex items-center gap-1"
                        >
                          {copiedRefText === utrRef ? <Check size={12} /> : <Copy size={12} />}
                          {copiedRefText === utrRef ? 'Copied' : 'Copy UTR'}
                        </button>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`text-[10px] font-black uppercase px-2.5 py-1 rounded-lg ${
                      p.activatedByAdmin || p.paymentStatus === 'paid' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                    }`}>
                      {p.activatedByAdmin ? 'Verified & Active (30d)' : `Submitted (${p.paymentStatus})`}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    {p.activatedByAdmin ? (
                      <span className="inline-flex items-center gap-1.5 text-xs font-black text-green-600 uppercase tracking-widest">
                        <CheckCircle2 size={16} /> Active (30 Days)
                      </span>
                    ) : (
                      <button
                        onClick={() => activateEligibleSubscription(p)}
                        disabled={activatingPaymentId === p.paymentId}
                        className="px-4 py-2 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-orange-500 transition-colors flex items-center gap-1.5"
                      >
                        {activatingPaymentId === p.paymentId ? (
                          <Loader2 size={14} className="animate-spin" />
                        ) : (
                          <ShieldCheck size={14} />
                        )}
                        Verify & Activate 30 Days
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
            {payments.length === 0 && (
              <tr>
                <td colSpan={6} className="px-6 py-10 text-center text-sm text-slate-400 italic">
                  No subscription payment records yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderLogs = () => (
    <div className="space-y-6">
      <h2 className="text-2xl font-black text-slate-900 mb-6">System Audit Logs</h2>
      <div className="space-y-2">
        {logs.map(log => (
          <div key={log.logId} className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
            <div className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center text-slate-400">
              <History size={18} />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase text-orange-500">{log.action}</span>
                <span className="text-slate-300">•</span>
                <span className="text-xs font-bold text-slate-600">{log.targetType}: {log.targetId.substring(0, 8)}...</span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">{log.details}</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{log.timestamp?.toDate ? format(log.timestamp.toDate(), 'MMM dd, HH:mm:ss') : 'N/A'}</p>
              <p className="text-[9px] text-slate-300 font-bold uppercase">Admin: {log.adminId.substring(0, 5)}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const renderSettings = () => (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900">Admin Profile, Legal Registrations & Global Settings</h2>
          <p className="text-xs font-bold text-slate-500 mt-1">
            Official corporate profile of Food India (A Unit of KulgamKart • kulgamkart.in) saved in Firestore.
          </p>
        </div>
        <button
          type="button"
          onClick={() => navigate('/terms')}
          className="px-4 py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-2xl text-xs font-black uppercase tracking-widest flex items-center gap-2 shadow-sm"
        >
          <ExternalLink size={14} /> View Terms, Privacy & About Page
        </button>
      </div>

      {/* Official Admin Profile Summary Banner */}
      <div className="bg-slate-900 text-white p-6 rounded-[32px] border border-orange-500/30 shadow-xl space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <span className="text-[10px] font-black uppercase tracking-widest bg-orange-500 text-white px-3 py-1 rounded-full">
              Official Admin & Corporate Profile
            </span>
            <h3 className="text-xl font-black mt-2">
              Food India is a unit of KulgamKart
            </h3>
            <p className="text-xs text-slate-300 mt-0.5">
              Official Website:{' '}
              <a
                href="https://kulgamkart.in"
                target="_blank"
                rel="noopener noreferrer"
                className="text-orange-400 font-black underline"
              >
                kulgamkart.in
              </a>
            </p>
          </div>
          <div className="bg-emerald-500/20 border border-emerald-400/30 px-4 py-2 rounded-2xl text-right">
            <span className="text-[10px] font-black uppercase tracking-widest text-emerald-300 block">
              Plan ₹499 + 18% GST
            </span>
            <span className="text-sm font-black text-white">
              ₹499.00 + ₹89.82 GST = ₹588.82
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 pt-2">
          <div className="bg-white/5 border border-white/10 rounded-2xl p-3.5">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 block">
              Parent Unit & Website
            </span>
            <span className="text-xs font-black text-white mt-1 block">
              KulgamKart (kulgamkart.in)
            </span>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-2xl p-3.5">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 block">
              Udyam Registration Number
            </span>
            <span className="text-xs font-mono font-black text-emerald-300 mt-1 block">
              {settings?.udyamRegistrationNumber || 'UDYAM-JK-11-0018721'}
            </span>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-2xl p-3.5">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 block">
              Official GST Number (GSTIN)
            </span>
            <span className="text-xs font-mono font-black text-amber-300 mt-1 block">
              {settings?.gstNumber || '01BMAPL3192D1CY'}
            </span>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-2xl p-3.5">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 block">
              FSSAI License Number
            </span>
            <span className="text-xs font-mono font-black text-orange-300 mt-1 block">
              {settings?.fssaiLicenseNumber || 'अनुज्ञिप्त संख्या / License Number: 11026999000072'}
            </span>
          </div>
        </div>
      </div>

      <form onSubmit={updateGlobalSettings} className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm space-y-4 md:col-span-2">
          <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
            <Award size={16} className="text-orange-500" />
            Admin Profile — Corporate, GST, FSSAI & Udyam Registration Details
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                Company / Unit Name
              </label>
              <input
                type="text"
                value={settings?.companyName || 'Food India (A Unit of KulgamKart)'}
                onChange={e => setSettings(s => ({ ...s, companyName: e.target.value }))}
                className="w-full h-12 px-4 bg-slate-50 rounded-2xl text-xs font-bold border border-transparent focus:border-orange-500 outline-none"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                Parent Enterprise
              </label>
              <input
                type="text"
                value={settings?.parentUnitName || 'KulgamKart'}
                onChange={e => setSettings(s => ({ ...s, parentUnitName: e.target.value }))}
                className="w-full h-12 px-4 bg-slate-50 rounded-2xl text-xs font-bold border border-transparent focus:border-orange-500 outline-none"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                Official Website (kulgamkart.in)
              </label>
              <input
                type="text"
                value={settings?.parentWebsite || 'https://kulgamkart.in'}
                onChange={e => setSettings(s => ({ ...s, parentWebsite: e.target.value }))}
                className="w-full h-12 px-4 bg-slate-50 rounded-2xl text-xs font-bold border border-transparent focus:border-orange-500 outline-none"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                Udyam Registration Number
              </label>
              <input
                type="text"
                value={settings?.udyamRegistrationNumber || 'UDYAM-JK-11-0018721'}
                onChange={e => setSettings(s => ({ ...s, udyamRegistrationNumber: e.target.value }))}
                className="w-full h-12 px-4 bg-slate-50 rounded-2xl text-xs font-mono font-bold border border-transparent focus:border-orange-500 outline-none"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                Official GST Number (GSTIN)
              </label>
              <input
                type="text"
                value={settings?.gstNumber || '01BMAPL3192D1CY'}
                onChange={e => setSettings(s => ({ ...s, gstNumber: e.target.value }))}
                className="w-full h-12 px-4 bg-slate-50 rounded-2xl text-xs font-mono font-bold border border-transparent focus:border-orange-500 outline-none"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                FSSAI अनुज्ञिप्त संख्या / License Number
              </label>
              <input
                type="text"
                value={settings?.fssaiLicenseNumber || 'अनुज्ञिप्त संख्या / License Number: 11026999000072'}
                onChange={e => setSettings(s => ({ ...s, fssaiLicenseNumber: e.target.value }))}
                className="w-full h-12 px-4 bg-slate-50 rounded-2xl text-xs font-mono font-bold border border-transparent focus:border-orange-500 outline-none"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                Seller Plan Base Price (₹)
              </label>
              <input
                type="number"
                value={settings?.plan499BaseAmount ?? 499}
                onChange={e => setSettings(s => ({ ...s, plan499BaseAmount: parseFloat(e.target.value) || 499 }))}
                className="w-full h-12 px-4 bg-slate-50 rounded-2xl text-xs font-bold border border-transparent focus:border-orange-500 outline-none"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                Plan GST Rate (%)
              </label>
              <input
                type="number"
                value={settings?.plan499GstRate ?? 18}
                onChange={e => setSettings(s => ({ ...s, plan499GstRate: parseFloat(e.target.value) || 18 }))}
                className="w-full h-12 px-4 bg-slate-50 rounded-2xl text-xs font-bold border border-transparent focus:border-orange-500 outline-none"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                Computed GST & Total (₹)
              </label>
              <div className="h-12 px-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center justify-between text-xs font-black text-emerald-800">
                <span>GST: ₹{(((settings?.plan499BaseAmount ?? 499) * (settings?.plan499GstRate ?? 18)) / 100).toFixed(2)}</span>
                <span>Total: ₹{((settings?.plan499BaseAmount ?? 499) * (1 + (settings?.plan499GstRate ?? 18) / 100)).toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm space-y-4">
          <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
            <Truck size={16} className="text-orange-500" />
            Delivery Configurations
          </h3>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Maximum Distance (Km)</label>
            <input 
              type="number" 
              value={settings?.deliveryLimits?.maximumDistanceKm || 10} 
              onChange={e => setSettings(s => ({ ...s, deliveryLimits: { ...s.deliveryLimits, maximumDistanceKm: parseFloat(e.target.value) || 10 } }))}
              className="w-full h-14 px-4 bg-slate-50 rounded-2xl text-sm font-bold border border-transparent focus:border-orange-500 outline-none"
            />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Default Base Charge (₹)</label>
            <input 
              type="number" 
              value={settings?.deliveryLimits?.globalBaseCharge || 20} 
              onChange={e => setSettings(s => ({ ...s, deliveryLimits: { ...s.deliveryLimits, globalBaseCharge: parseFloat(e.target.value) || 20 } }))}
              className="w-full h-14 px-4 bg-slate-50 rounded-2xl text-sm font-bold border border-transparent focus:border-orange-500 outline-none"
            />
          </div>
        </div>

        <div className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm space-y-4">
          <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
            <Globe size={16} className="text-orange-500" />
            Legal & Support Links
          </h3>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Privacy Policy URL</label>
            <input 
              type="text" 
              value={settings?.privacyPolicyURL || '/terms'} 
              onChange={e => setSettings(s => ({ ...s, privacyPolicyURL: e.target.value }))}
              className="w-full h-14 px-4 bg-slate-50 rounded-2xl text-sm font-bold border border-transparent focus:border-orange-500 outline-none"
              placeholder="/terms"
            />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Terms & Conditions URL</label>
            <input 
              type="text" 
              value={settings?.termsAndConditionsURL || '/terms'} 
              onChange={e => setSettings(s => ({ ...s, termsAndConditionsURL: e.target.value }))}
              className="w-full h-14 px-4 bg-slate-50 rounded-2xl text-sm font-bold border border-transparent focus:border-orange-500 outline-none"
              placeholder="/terms"
            />
          </div>
        </div>

        <div className="md:col-span-2">
          <button type="submit" className="w-full h-16 bg-slate-900 text-white font-black uppercase tracking-widest rounded-2xl shadow-xl shadow-slate-200 active:scale-95 transition-all">
            Save Admin Profile & Platform Configuration to Firestore
          </button>
        </div>
      </form>
    </div>
  );

  // Delivery Integration Actions
  const handleToggleProvider = async (prov: DeliveryProvider) => {
    if (!user) return;
    const nextEnabled = !prov.isEnabled;
    await updateDoc(doc(db, 'deliveryProviders', prov.providerId), {
      isEnabled: nextEnabled,
      updatedAt: serverTimestamp(),
    });
    await logAdminAction(user.uid, 'TOGGLE_DELIVERY_PROVIDER', 'DeliveryProvider', prov.providerId, `Set ${prov.name} enabled=${nextEnabled}`);
    setAdminMessage(`Delivery provider "${prov.name}" ${nextEnabled ? 'enabled' : 'disabled'}.`);
  };

  const handleTestProvider = async (prov: DeliveryProvider) => {
    if (!user) return;
    setTestingProviderId(prov.providerId);
    try {
      const res = await deliveryService.testProvider(prov.providerId);
      setAdminMessage(res.message);
      await logAdminAction(user.uid, 'TEST_DELIVERY_PROVIDER', 'DeliveryProvider', prov.providerId, res.message);
    } catch (err: any) {
      setAdminMessage(err.message || 'Provider connection test failed');
    } finally {
      setTestingProviderId(null);
    }
  };

  const handleUpdateProviderPriority = async (prov: DeliveryProvider, priority: number, fallbackProviderId: string) => {
    if (!user) return;
    await updateDoc(doc(db, 'deliveryProviders', prov.providerId), {
      priority,
      fallbackProviderId,
      updatedAt: serverTimestamp(),
    });
    await logAdminAction(user.uid, 'UPDATE_DELIVERY_PRIORITY', 'DeliveryProvider', prov.providerId, `Priority=${priority}, Fallback=${fallbackProviderId}`);
    setAdminMessage(`Updated priority and fallback for ${prov.name}.`);
  };

  const handleCreateDeliveryProvider = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newProviderForm.name.trim() || !newProviderForm.providerCode.trim()) return;
    const cleanCode = newProviderForm.providerCode.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_');
    const reqVars = newProviderForm.requiredEnvVarsText.split(',').map(s => s.trim()).filter(Boolean);

    await setDoc(doc(db, 'deliveryProviders', cleanCode), {
      providerId: cleanCode,
      providerCode: cleanCode,
      name: newProviderForm.name.trim(),
      logoUrl: 'https://cdn-icons-png.flaticon.com/512/2830/2830305.png',
      providerType: newProviderForm.providerType,
      integrationStatus: newProviderForm.providerType === 'sandbox_test_provider' ? 'active_sandbox' : 'unsupported_unconfigured',
      isEnabled: true,
      isTestMockProvider: newProviderForm.providerType === 'sandbox_test_provider',
      priority: parseInt(newProviderForm.priority, 10) || 8,
      fallbackProviderId: newProviderForm.fallbackProviderId || 'restaurant_staff',
      apiBaseUrl: newProviderForm.apiBaseUrl.trim(),
      webhookEndpoint: `/api/delivery/webhook/${cleanCode}`,
      supportsLiveQuotes: true,
      supportsWebhooks: true,
      supportsCancellation: true,
      supportsCodCollection: true,
      baseFee: parseFloat(newProviderForm.baseFee) || 30,
      perKmFee: parseFloat(newProviderForm.perKmFee) || 9,
      maxDistanceKm: parseFloat(newProviderForm.maxDistanceKm) || 15,
      conditionsNote: newProviderForm.conditionsNote.trim(),
      onboardingRequirements: newProviderForm.onboardingRequirements.trim(),
      requiredEnvVars: reqVars,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    await logAdminAction(user.uid, 'CREATE_DELIVERY_PROVIDER', 'DeliveryProvider', cleanCode, `Added provider ${newProviderForm.name}`);
    setShowAddProviderModal(false);
    setAdminMessage(`Added delivery provider "${newProviderForm.name}".`);
  };

  const handleCreateServiceArea = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newAreaForm.providerId || !newAreaForm.state.trim() || !newAreaForm.city.trim()) return;
    const areaId = `area_${newAreaForm.providerId}_${Date.now()}`;
    const prov = deliveryProviders.find(p => p.providerId === newAreaForm.providerId);
    const pincodes = newAreaForm.pincodesText.split(',').map(p => p.trim()).filter(Boolean);

    await setDoc(doc(db, 'deliveryServiceAreas', areaId), {
      areaId,
      providerId: newAreaForm.providerId,
      providerName: prov?.name || newAreaForm.providerId,
      state: newAreaForm.state.trim(),
      city: newAreaForm.city.trim(),
      district: newAreaForm.district.trim() || newAreaForm.city.trim(),
      pincodes: pincodes.length > 0 ? pincodes : ['*'],
      centerLatitude: parseFloat(newAreaForm.centerLatitude) || 28.6139,
      centerLongitude: parseFloat(newAreaForm.centerLongitude) || 77.2090,
      radiusKm: parseFloat(newAreaForm.radiusKm) || 25,
      isActive: true,
      areaRulesNote: newAreaForm.areaRulesNote.trim(),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    await logAdminAction(user.uid, 'CREATE_SERVICE_AREA', 'DeliveryServiceArea', areaId, `Added service area ${newAreaForm.city}, ${newAreaForm.state} for ${newAreaForm.providerId}`);
    setAdminMessage(`Service area added for ${newAreaForm.city}, ${newAreaForm.state}.`);
  };

  const handleDeleteServiceArea = async (area: DeliveryServiceArea) => {
    if (!user) return;
    await deleteDoc(doc(db, 'deliveryServiceAreas', area.areaId));
    await logAdminAction(user.uid, 'DELETE_SERVICE_AREA', 'DeliveryServiceArea', area.areaId, `Deleted area ${area.city}, ${area.state}`);
    setAdminMessage(`Removed service area ${area.city}, ${area.state}.`);
  };

  const handleToggleRestaurantOwnStaff = async (res: Restaurant) => {
    if (!user) return;
    const nextVal = res.allowOwnDeliveryStaff === false ? true : false;
    await updateDoc(doc(db, 'restaurants', res.restaurantId), {
      allowOwnDeliveryStaff: nextVal,
      updatedAt: serverTimestamp(),
    });
    await logAdminAction(user.uid, 'TOGGLE_RESTAURANT_OWN_STAFF', 'Restaurant', res.restaurantId, `Set allowOwnDeliveryStaff=${nextVal}`);
    setAdminMessage(`Updated in-house delivery staff permission for ${res.restaurantName}.`);
  };

  const handleSaveLocalDeliveryCompanyApi = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingLocalDeliveryApi(true);
    setLocalDeliveryTestResult(null);
    try {
      const cleanPayload = {
        companyName: localDeliveryApi.companyName.trim() || 'Local Express Food Delivery Co.',
        apiEndpointUrl: localDeliveryApi.apiEndpointUrl.trim() || 'https://httpbin.org/post',
        apiKey: localDeliveryApi.apiKey.trim(),
        authHeaderName: localDeliveryApi.authHeaderName.trim() || 'Authorization',
        webhookSecret: localDeliveryApi.webhookSecret.trim(),
        supportPhone: localDeliveryApi.supportPhone.trim() || '+91 8825018335',
        cityCoverage: localDeliveryApi.cityCoverage.trim() || 'All Cities',
        baseFee: parseFloat(localDeliveryApi.baseFee) || 25,
        perKmFee: parseFloat(localDeliveryApi.perKmFee) || 8,
        autoDispatchOnOrder: Boolean(localDeliveryApi.autoDispatchOnOrder),
        isEnabled: Boolean(localDeliveryApi.isEnabled),
        updatedAt: serverTimestamp(),
      };

      await setDoc(doc(db, 'adminSettings', 'localDeliveryCompanyApi'), cleanPayload, { merge: true });

      // Also upsert the #1 priority live delivery provider in `deliveryProviders/local_delivery_company`
      await setDoc(doc(db, 'deliveryProviders', 'local_delivery_company'), {
        providerId: 'local_delivery_company',
        providerCode: 'local_delivery_company',
        name: cleanPayload.companyName,
        logoUrl: 'https://cdn-icons-png.flaticon.com/512/2830/2830305.png',
        providerType: 'third_party_api',
        integrationStatus: 'active_live',
        isEnabled: cleanPayload.isEnabled,
        isTestMockProvider: false,
        priority: 1,
        fallbackProviderId: 'food_india_fleet',
        apiBaseUrl: cleanPayload.apiEndpointUrl,
        apiKey: cleanPayload.apiKey,
        authHeaderName: cleanPayload.authHeaderName,
        webhookSecret: cleanPayload.webhookSecret,
        supportPhone: cleanPayload.supportPhone,
        webhookEndpoint: '/api/delivery/webhook/local_delivery_company',
        supportsLiveQuotes: true,
        supportsWebhooks: true,
        supportsCancellation: true,
        supportsCodCollection: true,
        baseFee: cleanPayload.baseFee,
        perKmFee: cleanPayload.perKmFee,
        maxDistanceKm: 25,
        conditionsNote: `Real Local Food Delivery Partner API (${cleanPayload.cityCoverage}) — Auto-dispatches live orders to ${cleanPayload.apiEndpointUrl}`,
        onboardingRequirements: `Connected to ${cleanPayload.apiEndpointUrl} (Support: ${cleanPayload.supportPhone})`,
        requiredEnvVars: ['LOCAL_DELIVERY_API_KEY'],
        updatedAt: serverTimestamp(),
      }, { merge: true });

      reportGlobalButtonStatus({
        buttonName: 'Save Local Food Delivery Company API Integration',
        screen: 'AdminDashboard (Delivery Partners)',
        backendPath: 'adminSettings/localDeliveryCompanyApi & deliveryProviders/local_delivery_company',
        dbUpdated: 'UPDATED',
        statusType: 'success',
        message: `Saved real Local Food Delivery API settings (${cleanPayload.companyName} → ${cleanPayload.apiEndpointUrl}).`,
        suggestion: 'Click "Send Real Test Delivery Order to API" to verify live HTTP order dispatch.',
      });
      setAdminMessage(`Saved Local Food Delivery Company API ("${cleanPayload.companyName}") and activated live order dispatch!`);
    } catch (err: any) {
      setAdminMessage(err?.message || 'Failed to save Local Delivery API settings.');
    } finally {
      setSavingLocalDeliveryApi(false);
    }
  };

  const handleTestLocalDeliveryOrderDispatch = async () => {
    setTestingLocalDeliveryApi(true);
    setLocalDeliveryTestResult(null);
    try {
      const response = await fetch('/api/delivery/dispatch-local-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyName: localDeliveryApi.companyName,
          apiEndpointUrl: localDeliveryApi.apiEndpointUrl,
          apiKey: localDeliveryApi.apiKey,
          authHeaderName: localDeliveryApi.authHeaderName,
          supportPhone: localDeliveryApi.supportPhone,
        }),
      });
      const data = await response.json();
      const msg = data.message || `Dispatched live test order to ${localDeliveryApi.apiEndpointUrl} (HTTP ${data.httpStatus || response.status})`;
      setLocalDeliveryTestResult(msg);
      setAdminMessage(msg);
      reportGlobalButtonStatus({
        buttonName: 'Send Real Test Delivery Order to Local Delivery API',
        screen: 'AdminDashboard (Delivery Partners)',
        backendPath: `POST /api/delivery/dispatch-local-test → ${localDeliveryApi.apiEndpointUrl}`,
        dbUpdated: 'UPDATED',
        statusType: data.ok !== false ? 'success' : 'warning',
        message: msg,
        suggestion: 'All customer orders will automatically POST their pickup & dropoff GPS payload to this API.',
      });
    } catch (err: any) {
      setLocalDeliveryTestResult(err?.message || 'Failed to dispatch test order');
    } finally {
      setTestingLocalDeliveryApi(false);
    }
  };

  const renderDeliveryIntegrations = () => (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900">Local & Third-Party Food Delivery API Integrations</h2>
          <p className="text-xs font-bold text-slate-400 mt-1">
            Configure your real Local Food Delivery Company API endpoint & credentials to automatically send live delivery orders with pickup/dropoff GPS coordinates.
          </p>
        </div>
        <button
          onClick={() => setShowAddProviderModal(true)}
          className="bg-orange-500 text-white px-5 py-2.5 rounded-2xl font-bold text-xs uppercase tracking-widest shadow-lg shadow-orange-500/20 flex items-center gap-2"
        >
          <Plus size={16} /> Add Delivery Provider
        </button>
      </div>

      {/* Real Local Food Delivery Company Live API Configuration Card */}
      <form
        onSubmit={handleSaveLocalDeliveryCompanyApi}
        className="bg-gradient-to-br from-slate-900 via-slate-900 to-slate-800 text-white p-6 rounded-[32px] border border-orange-500/30 shadow-xl space-y-5"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <span className="text-[10px] font-black uppercase tracking-widest bg-orange-500 text-white px-3 py-1 rounded-full">
              Real Live Order Dispatch Integration
            </span>
            <h3 className="text-lg font-black mt-2">
              Local Food Delivery Company — Live API Integration Settings
            </h3>
            <p className="text-xs text-slate-300 mt-0.5">
              Every customer order placed or accepted by a seller is automatically sent via HTTP POST to this local delivery company API with full restaurant pickup GPS, customer dropoff GPS, items, and COD amount.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={testingLocalDeliveryApi}
              onClick={handleTestLocalDeliveryOrderDispatch}
              className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-[11px] font-black uppercase tracking-wider flex items-center gap-1.5 shadow-lg"
            >
              {testingLocalDeliveryApi ? <Loader2 size={14} className="animate-spin" /> : <Truck size={14} />}
              Send Real Test Order to API
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
              Local Delivery Company Name
            </label>
            <input
              type="text"
              required
              value={localDeliveryApi.companyName}
              onChange={e => setLocalDeliveryApi({ ...localDeliveryApi, companyName: e.target.value })}
              placeholder="e.g. Local Express Food Delivery Co."
              className="w-full h-11 px-3.5 bg-white/10 border border-white/15 rounded-xl text-xs font-bold text-white outline-none focus:border-orange-400"
            />
          </div>
          <div className="space-y-1 md:col-span-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
              Live Order Dispatch API Endpoint URL (HTTP POST)
            </label>
            <input
              type="url"
              required
              value={localDeliveryApi.apiEndpointUrl}
              onChange={e => setLocalDeliveryApi({ ...localDeliveryApi, apiEndpointUrl: e.target.value })}
              placeholder="https://api.yourlocaldelivery.in/v1/orders/create"
              className="w-full h-11 px-3.5 bg-white/10 border border-white/15 rounded-xl text-xs font-mono font-bold text-emerald-300 outline-none focus:border-orange-400"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
              API Key / Bearer Token
            </label>
            <input
              type="text"
              value={localDeliveryApi.apiKey}
              onChange={e => setLocalDeliveryApi({ ...localDeliveryApi, apiKey: e.target.value })}
              placeholder="Enter partner API key or token"
              className="w-full h-11 px-3.5 bg-white/10 border border-white/15 rounded-xl text-xs font-mono font-bold text-white outline-none focus:border-orange-400"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
              Auth Header Name
            </label>
            <input
              type="text"
              value={localDeliveryApi.authHeaderName}
              onChange={e => setLocalDeliveryApi({ ...localDeliveryApi, authHeaderName: e.target.value })}
              placeholder="Authorization or X-API-Key"
              className="w-full h-11 px-3.5 bg-white/10 border border-white/15 rounded-xl text-xs font-mono font-bold text-white outline-none focus:border-orange-400"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
              Webhook Secret (HMAC Signature)
            </label>
            <input
              type="text"
              value={localDeliveryApi.webhookSecret}
              onChange={e => setLocalDeliveryApi({ ...localDeliveryApi, webhookSecret: e.target.value })}
              placeholder="whsec_..."
              className="w-full h-11 px-3.5 bg-white/10 border border-white/15 rounded-xl text-xs font-mono font-bold text-white outline-none focus:border-orange-400"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
              Company Dispatch Support Phone
            </label>
            <input
              type="text"
              value={localDeliveryApi.supportPhone}
              onChange={e => setLocalDeliveryApi({ ...localDeliveryApi, supportPhone: e.target.value })}
              placeholder="+91 8825018335"
              className="w-full h-11 px-3.5 bg-white/10 border border-white/15 rounded-xl text-xs font-bold text-white outline-none focus:border-orange-400"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
              Base Delivery Fee (₹)
            </label>
            <input
              type="number"
              value={localDeliveryApi.baseFee}
              onChange={e => setLocalDeliveryApi({ ...localDeliveryApi, baseFee: e.target.value })}
              className="w-full h-11 px-3.5 bg-white/10 border border-white/15 rounded-xl text-xs font-bold text-white outline-none focus:border-orange-400"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
              Per KM Rate (₹/km)
            </label>
            <input
              type="number"
              value={localDeliveryApi.perKmFee}
              onChange={e => setLocalDeliveryApi({ ...localDeliveryApi, perKmFee: e.target.value })}
              className="w-full h-11 px-3.5 bg-white/10 border border-white/15 rounded-xl text-xs font-bold text-white outline-none focus:border-orange-400"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4 pt-2 border-t border-white/10">
          <label className="flex items-center gap-2.5 text-xs font-bold text-slate-200 cursor-pointer">
            <input
              type="checkbox"
              checked={localDeliveryApi.autoDispatchOnOrder}
              onChange={e => setLocalDeliveryApi({ ...localDeliveryApi, autoDispatchOnOrder: e.target.checked })}
              className="w-4 h-4 accent-orange-500 rounded"
            />
            <span>Automatically dispatch delivery order to this API when order is placed / accepted</span>
          </label>
          <button
            type="submit"
            disabled={savingLocalDeliveryApi}
            className="px-6 py-3 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-xs font-black uppercase tracking-widest shadow-lg"
          >
            {savingLocalDeliveryApi ? 'Saving API Config...' : 'Save Local Delivery API Settings'}
          </button>
        </div>

        {localDeliveryTestResult && (
          <div className="p-3.5 rounded-2xl bg-emerald-500/20 border border-emerald-400/40 text-xs font-mono text-emerald-200">
            {localDeliveryTestResult}
          </div>
        )}
      </form>

      {/* Sub-navigation */}
      <div className="flex flex-wrap gap-2 bg-white p-2 rounded-2xl border border-slate-100 shadow-sm">
        {[
          { id: 'providers', label: `Providers & Credentials (${deliveryProviders.length})` },
          { id: 'areas', label: `Service Areas (${serviceAreas.length})` },
          { id: 'bookings', label: `Bookings & Webhooks (${deliveryBookings.length})` },
          { id: 'restaurants', label: `Restaurant Own-Staff Rules (${restaurants.length})` },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setDeliverySubTab(tab.id as any)}
            className={`px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
              deliverySubTab === tab.id ? 'bg-slate-900 text-white' : 'text-slate-500 hover:bg-slate-50'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {showAddProviderModal && (
        <form onSubmit={handleCreateDeliveryProvider} className="bg-white p-6 rounded-[32px] border border-orange-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">Register New Delivery Provider</h3>
            <button type="button" onClick={() => setShowAddProviderModal(false)} className="text-xs font-bold text-slate-400">Cancel</button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <input
              type="text"
              required
              placeholder="Provider Code (e.g. borzo_in)"
              value={newProviderForm.providerCode}
              onChange={e => setNewProviderForm({ ...newProviderForm, providerCode: e.target.value })}
              className="h-12 px-4 bg-slate-50 rounded-xl text-xs font-bold outline-none"
            />
            <input
              type="text"
              required
              placeholder="Display Name (e.g. Borzo Hyperlocal India)"
              value={newProviderForm.name}
              onChange={e => setNewProviderForm({ ...newProviderForm, name: e.target.value })}
              className="h-12 px-4 bg-slate-50 rounded-xl text-xs font-bold outline-none"
            />
            <select
              value={newProviderForm.providerType}
              onChange={e => setNewProviderForm({ ...newProviderForm, providerType: e.target.value as any })}
              className="h-12 px-4 bg-slate-50 rounded-xl text-xs font-bold outline-none"
            >
              <option value="third_party_api">Official Third-Party Partner API</option>
              <option value="sandbox_test_provider">Sandbox / Test Provider</option>
              <option value="food_india_fleet">Food India Local Fleet</option>
            </select>
            <input
              type="text"
              placeholder="API Base URL"
              value={newProviderForm.apiBaseUrl}
              onChange={e => setNewProviderForm({ ...newProviderForm, apiBaseUrl: e.target.value })}
              className="h-12 px-4 bg-slate-50 rounded-xl text-xs font-bold outline-none"
            />
            <input
              type="number"
              placeholder="Base Fee (₹)"
              value={newProviderForm.baseFee}
              onChange={e => setNewProviderForm({ ...newProviderForm, baseFee: e.target.value })}
              className="h-12 px-4 bg-slate-50 rounded-xl text-xs font-bold outline-none"
            />
            <input
              type="number"
              placeholder="Per Km Fee (₹)"
              value={newProviderForm.perKmFee}
              onChange={e => setNewProviderForm({ ...newProviderForm, perKmFee: e.target.value })}
              className="h-12 px-4 bg-slate-50 rounded-xl text-xs font-bold outline-none"
            />
            <input
              type="number"
              placeholder="Max Distance (Km)"
              value={newProviderForm.maxDistanceKm}
              onChange={e => setNewProviderForm({ ...newProviderForm, maxDistanceKm: e.target.value })}
              className="h-12 px-4 bg-slate-50 rounded-xl text-xs font-bold outline-none"
            />
            <input
              type="number"
              placeholder="Priority (1 = Highest)"
              value={newProviderForm.priority}
              onChange={e => setNewProviderForm({ ...newProviderForm, priority: e.target.value })}
              className="h-12 px-4 bg-slate-50 rounded-xl text-xs font-bold outline-none"
            />
            <input
              type="text"
              placeholder="Required Server .env Keys (comma-separated)"
              value={newProviderForm.requiredEnvVarsText}
              onChange={e => setNewProviderForm({ ...newProviderForm, requiredEnvVarsText: e.target.value })}
              className="h-12 px-4 bg-slate-50 rounded-xl text-xs font-bold outline-none"
            />
          </div>
          <textarea
            rows={2}
            placeholder="Onboarding & Official API Documentation Note..."
            value={newProviderForm.onboardingRequirements}
            onChange={e => setNewProviderForm({ ...newProviderForm, onboardingRequirements: e.target.value })}
            className="w-full p-3 bg-slate-50 rounded-xl text-xs font-bold outline-none"
          />
          <button type="submit" className="px-6 py-3 bg-slate-900 text-white rounded-xl text-xs font-black uppercase tracking-widest">
            Save Delivery Provider
          </button>
        </form>
      )}

      {deliverySubTab === 'providers' && (
        <div className="grid gap-4">
          {deliveryProviders.map(prov => {
            const envMeta = providerEnvStatus[prov.providerCode];
            return (
              <div key={prov.providerId} className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-4">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="flex items-start gap-4">
                    <img
                      src={prov.logoUrl || 'https://cdn-icons-png.flaticon.com/512/2830/2830305.png'}
                      alt={prov.name}
                      className="w-12 h-12 rounded-2xl object-contain bg-slate-50 p-2 border border-slate-100"
                    />
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="font-black text-slate-900 text-base">{prov.name}</h4>
                        {prov.isTestMockProvider && (
                          <span className="text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800">
                            Sandbox / Test Provider (Demo)
                          </span>
                        )}
                        <span className={`text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full ${
                          !prov.isEnabled ? 'bg-slate-100 text-slate-500' :
                          prov.integrationStatus === 'active_live' ? 'bg-green-100 text-green-700' :
                          prov.integrationStatus === 'active_sandbox' ? 'bg-blue-100 text-blue-700' :
                          'bg-red-100 text-red-600'
                        }`}>
                          {!prov.isEnabled ? 'Disabled' : prov.integrationStatus.replace(/_/g, ' ')}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-1">{prov.conditionsNote}</p>
                      <p className="text-[11px] font-mono text-slate-400 mt-1">
                        Code: {prov.providerCode} • Base: ₹{prov.baseFee} + ₹{prov.perKmFee}/km (Max {prov.maxDistanceKm} km) • Priority #{prov.priority}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={() => handleTestProvider(prov)}
                      disabled={testingProviderId === prov.providerId}
                      className="px-3.5 py-2 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-orange-500 transition-colors flex items-center gap-1.5"
                    >
                      {testingProviderId === prov.providerId ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                      Test Adapter
                    </button>
                    <button
                      onClick={() => handleToggleProvider(prov)}
                      className={`px-3.5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest ${
                        prov.isEnabled ? 'bg-red-50 text-red-600 hover:bg-red-100' : 'bg-green-50 text-green-600 hover:bg-green-100'
                      }`}
                    >
                      {prov.isEnabled ? 'Disable' : 'Enable'}
                    </button>
                  </div>
                </div>

                {/* Priority, Fallback & Server Credential Security Info */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-3 border-t border-slate-100 text-xs">
                  <div className="bg-slate-50 p-3 rounded-xl">
                    <span className="text-[10px] font-black text-slate-400 uppercase block">Backend Secret Status</span>
                    <span className="font-bold text-slate-800 mt-0.5 block">
                      {envMeta?.envLabel || prov.onboardingRequirements || 'Server-managed credentials'}
                    </span>
                    {prov.webhookEndpoint && (
                      <span className="text-[10px] font-mono text-slate-500 block mt-1">
                        Webhook: {prov.webhookEndpoint}
                      </span>
                    )}
                  </div>

                  <div className="bg-slate-50 p-3 rounded-xl">
                    <span className="text-[10px] font-black text-slate-400 uppercase block">Onboarding & Access Requirements</span>
                    <span className="text-[11px] text-slate-600 mt-0.5 block">
                      {prov.onboardingRequirements}
                    </span>
                  </div>

                  <div className="bg-slate-50 p-3 rounded-xl flex items-center justify-between gap-2">
                    <div>
                      <span className="text-[10px] font-black text-slate-400 uppercase block">Priority & Fallback</span>
                      <span className="text-[11px] font-bold text-slate-700">
                        Priority #{prov.priority} → Fallback: {prov.fallbackProviderId || 'None'}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleUpdateProviderPriority(prov, Math.max(1, Number(prov.priority || 1) - 1), prov.fallbackProviderId || 'restaurant_staff')}
                        className="px-2 py-1 bg-white border border-slate-200 rounded text-[10px] font-black"
                        title="Increase Priority"
                      >
                        ↑
                      </button>
                      <button
                        onClick={() => handleUpdateProviderPriority(prov, Number(prov.priority || 1) + 1, prov.fallbackProviderId || 'restaurant_staff')}
                        className="px-2 py-1 bg-white border border-slate-200 rounded text-[10px] font-black"
                        title="Decrease Priority"
                      >
                        ↓
                      </button>
                    </div>
                  </div>
                </div>

                {prov.lastTestResult && (
                  <p className="text-[11px] font-bold text-orange-600 bg-orange-50 px-3 py-2 rounded-xl">
                    Last Test Result: {prov.lastTestResult}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {deliverySubTab === 'areas' && (
        <div className="space-y-6">
          <form onSubmit={handleCreateServiceArea} className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm space-y-4">
            <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
              <MapPin size={16} className="text-orange-500" />
              Add State / City / District / PIN / GPS Service Area
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <select
                value={newAreaForm.providerId}
                onChange={e => setNewAreaForm({ ...newAreaForm, providerId: e.target.value })}
                className="h-12 px-3 bg-slate-50 rounded-xl text-xs font-bold outline-none"
              >
                {deliveryProviders.map(p => (
                  <option key={p.providerId} value={p.providerId}>{p.name}</option>
                ))}
              </select>
              <input
                type="text"
                required
                placeholder="State (e.g. Maharashtra)"
                value={newAreaForm.state}
                onChange={e => setNewAreaForm({ ...newAreaForm, state: e.target.value })}
                className="h-12 px-3 bg-slate-50 rounded-xl text-xs font-bold outline-none"
              />
              <input
                type="text"
                required
                placeholder="City (e.g. Pune)"
                value={newAreaForm.city}
                onChange={e => setNewAreaForm({ ...newAreaForm, city: e.target.value })}
                className="h-12 px-3 bg-slate-50 rounded-xl text-xs font-bold outline-none"
              />
              <input
                type="text"
                required
                placeholder="District (e.g. Pune)"
                value={newAreaForm.district}
                onChange={e => setNewAreaForm({ ...newAreaForm, district: e.target.value })}
                className="h-12 px-3 bg-slate-50 rounded-xl text-xs font-bold outline-none"
              />
              <input
                type="text"
                placeholder="PIN Codes (comma-separated or *)"
                value={newAreaForm.pincodesText}
                onChange={e => setNewAreaForm({ ...newAreaForm, pincodesText: e.target.value })}
                className="h-12 px-3 bg-slate-50 rounded-xl text-xs font-bold outline-none"
              />
              <input
                type="number"
                step="any"
                placeholder="Center Latitude"
                value={newAreaForm.centerLatitude}
                onChange={e => setNewAreaForm({ ...newAreaForm, centerLatitude: e.target.value })}
                className="h-12 px-3 bg-slate-50 rounded-xl text-xs font-bold outline-none"
              />
              <input
                type="number"
                step="any"
                placeholder="Center Longitude"
                value={newAreaForm.centerLongitude}
                onChange={e => setNewAreaForm({ ...newAreaForm, centerLongitude: e.target.value })}
                className="h-12 px-3 bg-slate-50 rounded-xl text-xs font-bold outline-none"
              />
              <input
                type="number"
                placeholder="GPS Radius (Km)"
                value={newAreaForm.radiusKm}
                onChange={e => setNewAreaForm({ ...newAreaForm, radiusKm: e.target.value })}
                className="h-12 px-3 bg-slate-50 rounded-xl text-xs font-bold outline-none"
              />
            </div>
            <button type="submit" className="px-6 py-3 bg-slate-900 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-orange-500 transition-colors">
              Save Service Coverage Area
            </button>
          </form>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {serviceAreas.map(area => (
              <div key={area.areaId} className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm flex items-start justify-between gap-4">
                <div>
                  <span className="text-[10px] font-black uppercase text-orange-500 tracking-widest">{area.providerName || area.providerId}</span>
                  <h4 className="font-bold text-slate-900 text-sm mt-0.5">
                    {area.city}, {area.state} ({area.district})
                  </h4>
                  <p className="text-xs text-slate-500 mt-1">
                    PINs: {(area.pincodes || []).join(', ')} • GPS Zone: {area.radiusKm} km radius
                  </p>
                  {area.areaRulesNote && (
                    <p className="text-[11px] text-slate-400 mt-1 italic">{area.areaRulesNote}</p>
                  )}
                </div>
                <button
                  onClick={() => handleDeleteServiceArea(area)}
                  className="p-2.5 bg-red-50 text-red-600 rounded-xl hover:bg-red-100"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {deliverySubTab === 'bookings' && (
        <div className="space-y-6">
          <div className="bg-white rounded-[32px] border border-slate-100 shadow-sm overflow-x-auto">
            <div className="p-5 border-b border-slate-100">
              <h3 className="font-black text-slate-900 text-sm uppercase tracking-wider">Delivery Bookings & Provider Charges</h3>
            </div>
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th className="px-5 py-3.5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Order / Booking Ref</th>
                  <th className="px-5 py-3.5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Provider</th>
                  <th className="px-5 py-3.5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Quoted Fee</th>
                  <th className="px-5 py-3.5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Status</th>
                  <th className="px-5 py-3.5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Notes / Error</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {deliveryBookings.map(b => (
                  <tr key={b.bookingId}>
                    <td className="px-5 py-4 text-xs">
                      <p className="font-bold text-slate-900">#{b.orderNumber}</p>
                      <p className="font-mono text-slate-400">{b.providerBookingRef} ({b.trackingRef || 'No Track'})</p>
                    </td>
                    <td className="px-5 py-4 text-xs font-bold text-slate-700">{b.providerName}</td>
                    <td className="px-5 py-4 text-xs font-black text-slate-900">₹{b.quotedFee}</td>
                    <td className="px-5 py-4">
                      <span className={`text-[10px] font-black uppercase px-2.5 py-1 rounded-lg ${
                        b.bookingStatus === 'delivered' ? 'bg-green-100 text-green-700' :
                        b.bookingStatus === 'failed' || b.bookingStatus === 'cancelled' ? 'bg-red-100 text-red-600' :
                        'bg-blue-100 text-blue-700'
                      }`}>
                        {b.bookingStatus.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-xs text-slate-500">
                      {b.failureReason || b.cancellationReason || (b.webhookVerifiedDelivery ? 'Verified via HMAC Webhook' : 'Active')}
                    </td>
                  </tr>
                ))}
                {deliveryBookings.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-5 py-8 text-center text-xs text-slate-400 italic">
                      No delivery bookings created yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="bg-white rounded-[32px] border border-slate-100 shadow-sm overflow-x-auto">
            <div className="p-5 border-b border-slate-100">
              <h3 className="font-black text-slate-900 text-sm uppercase tracking-wider">Verified Delivery Webhook Events</h3>
            </div>
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th className="px-5 py-3.5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Event ID</th>
                  <th className="px-5 py-3.5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Provider</th>
                  <th className="px-5 py-3.5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Signature</th>
                  <th className="px-5 py-3.5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Summary</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {webhookEvents.map(ev => (
                  <tr key={ev.eventId}>
                    <td className="px-5 py-3.5 text-xs font-mono text-slate-600">{ev.eventId}</td>
                    <td className="px-5 py-3.5 text-xs font-bold uppercase text-orange-600">{ev.providerCode}</td>
                    <td className="px-5 py-3.5">
                      <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded ${
                        ev.signatureVerified ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                      }`}>
                        {ev.signatureVerified ? 'HMAC Verified' : 'Rejected'}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-xs text-slate-600">{ev.payloadSummary}</td>
                  </tr>
                ))}
                {webhookEvents.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-5 py-8 text-center text-xs text-slate-400 italic">
                      No delivery webhook events received yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {deliverySubTab === 'restaurants' && (
        <div className="grid gap-3">
          {restaurants.map(res => (
            <div key={res.restaurantId} className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm flex items-center justify-between gap-4">
              <div>
                <h4 className="font-bold text-slate-900">{res.restaurantName}</h4>
                <p className="text-xs text-slate-400">{res.address} • Max Distance: {res.maximumDeliveryDistanceKm || 10} km</p>
              </div>
              <button
                onClick={() => handleToggleRestaurantOwnStaff(res)}
                className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest ${
                  res.allowOwnDeliveryStaff !== false ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'
                }`}
              >
                {res.allowOwnDeliveryStaff !== false ? 'Own Staff: Allowed' : 'Own Staff: Disabled'}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row">
      {/* Sidebar */}
      <aside className="w-full md:w-64 bg-slate-900 text-white flex flex-col p-4 md:p-6 md:fixed md:h-full z-20 overflow-y-auto no-scrollbar">
        <div className="flex items-center justify-between md:justify-start gap-3 mb-4 md:mb-10 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-orange-500 rounded-xl flex items-center justify-center font-black italic shadow-lg shadow-orange-500/20">FI</div>
            <div>
              <h1 className="font-black tracking-tighter leading-none text-lg">FOOD INDIA</h1>
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Admin Control</span>
            </div>
          </div>
          <button
            onClick={async () => {
              await authService.logout();
              navigate('/welcome');
            }}
            className="md:hidden p-2 text-red-400 hover:bg-red-400/10 rounded-xl"
          >
            <LogOut size={18} />
          </button>
        </div>

        <nav className="flex md:flex-col gap-1 overflow-x-auto no-scrollbar pb-2 md:pb-0 flex-1">
          <p className="hidden md:block text-[9px] font-black text-slate-500 uppercase tracking-[0.2em] mb-2 px-4">Marketplace</p>
          <button onClick={() => setActiveTab('sellers')} className={`shrink-0 flex items-center justify-between gap-2 md:gap-3 px-4 py-2.5 md:py-3 rounded-2xl transition-all ${activeTab === 'sellers' ? 'bg-orange-500 text-white' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}>
            <span className="flex items-center gap-2"><ClipboardCheck size={18} /> <span className="font-bold text-xs md:text-sm">Sellers</span></span>
            <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-white/15 text-white">{allSellers.length}</span>
          </button>
          <button onClick={() => setActiveTab('documents')} className={`shrink-0 flex items-center justify-between gap-2 md:gap-3 px-4 py-2.5 md:py-3 rounded-2xl transition-all ${activeTab === 'documents' ? 'bg-orange-500 text-white' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}>
            <span className="flex items-center gap-2"><FileText size={18} /> <span className="font-bold text-xs md:text-sm">Seller Docs</span></span>
            <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-white/15 text-white">{documents.length}</span>
          </button>
          <button onClick={() => setActiveTab('restaurants')} className={`shrink-0 flex items-center justify-between gap-2 md:gap-3 px-4 py-2.5 md:py-3 rounded-2xl transition-all ${activeTab === 'restaurants' ? 'bg-orange-500 text-white' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}>
            <span className="flex items-center gap-2"><Store size={18} /> <span className="font-bold text-xs md:text-sm">Restaurants</span></span>
            <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-white/15 text-white">{restaurants.length}</span>
          </button>
          <button onClick={() => setActiveTab('products')} className={`shrink-0 flex items-center gap-2 md:gap-3 px-4 py-2.5 md:py-3 rounded-2xl transition-all ${activeTab === 'products' ? 'bg-orange-500 text-white' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}>
            <ShoppingBag size={18} /> <span className="font-bold text-xs md:text-sm">Products ({products.length})</span>
          </button>
          <button onClick={() => setActiveTab('categories')} className={`shrink-0 flex items-center gap-2 md:gap-3 px-4 py-2.5 md:py-3 rounded-2xl transition-all ${activeTab === 'categories' ? 'bg-orange-500 text-white' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}>
            <Layers size={18} /> <span className="font-bold text-xs md:text-sm">Categories ({categories.length})</span>
          </button>
          <button onClick={() => setActiveTab('orders')} className={`shrink-0 flex items-center justify-between gap-2 md:gap-3 px-4 py-2.5 md:py-3 rounded-2xl transition-all ${activeTab === 'orders' ? 'bg-orange-500 text-white' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}>
            <span className="flex items-center gap-2"><Package size={18} /> <span className="font-bold text-xs md:text-sm">Orders</span></span>
            <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-white/15 text-white">{orders.length}</span>
          </button>
          <button onClick={() => setActiveTab('delivery')} className={`shrink-0 flex items-center gap-2 md:gap-3 px-4 py-2.5 md:py-3 rounded-2xl transition-all ${activeTab === 'delivery' ? 'bg-orange-500 text-white' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}>
            <Truck size={18} /> <span className="font-bold text-xs md:text-sm">Delivery Partners</span>
          </button>
          
          <p className="hidden md:block text-[9px] font-black text-slate-500 uppercase tracking-[0.2em] mt-6 mb-2 px-4">Monetization</p>
          <button onClick={() => setActiveTab('plans')} className={`shrink-0 flex items-center gap-2 md:gap-3 px-4 py-2.5 md:py-3 rounded-2xl transition-all ${activeTab === 'plans' ? 'bg-orange-500 text-white' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}>
            <CreditCard size={18} /> <span className="font-bold text-xs md:text-sm">Plans</span>
          </button>
          <button onClick={() => setActiveTab('payments')} className={`shrink-0 flex items-center gap-2 md:gap-3 px-4 py-2.5 md:py-3 rounded-2xl transition-all ${activeTab === 'payments' ? 'bg-orange-500 text-white' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}>
            <DollarSign size={18} /> <span className="font-bold text-xs md:text-sm">Payments</span>
          </button>

          <p className="hidden md:block text-[9px] font-black text-slate-500 uppercase tracking-[0.2em] mt-6 mb-2 px-4">Plugins</p>
          <button onClick={() => setActiveTab('restaurant_map')} className={`shrink-0 flex items-center gap-2 md:gap-3 px-4 py-2.5 md:py-3 rounded-2xl transition-all ${activeTab === 'restaurant_map' ? 'bg-orange-500 text-white' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}>
            <MapPin size={18} /> <span className="font-bold text-xs md:text-sm">Restaurant Map (ON/OFF)</span>
          </button>

          <p className="hidden md:block text-[9px] font-black text-slate-500 uppercase tracking-[0.2em] mt-6 mb-2 px-4">System</p>
          <button onClick={() => setActiveTab('users')} className={`shrink-0 flex items-center justify-between gap-2 md:gap-3 px-4 py-2.5 md:py-3 rounded-2xl transition-all ${activeTab === 'users' ? 'bg-orange-500 text-white' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}>
            <span className="flex items-center gap-2"><Users size={18} /> <span className="font-bold text-xs md:text-sm">Customers & Users</span></span>
            <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-white/15 text-white">{trueCustomers.length}</span>
          </button>
          <button onClick={() => setActiveTab('logs')} className={`shrink-0 flex items-center gap-2 md:gap-3 px-4 py-2.5 md:py-3 rounded-2xl transition-all ${activeTab === 'logs' ? 'bg-orange-500 text-white' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}>
            <History size={18} /> <span className="font-bold text-xs md:text-sm">Audit Logs</span>
          </button>
          <button onClick={() => setActiveTab('settings')} className={`shrink-0 flex items-center gap-2 md:gap-3 px-4 py-2.5 md:py-3 rounded-2xl transition-all ${activeTab === 'settings' ? 'bg-orange-500 text-white' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}>
            <Settings size={18} /> <span className="font-bold text-xs md:text-sm">Settings</span>
          </button>
          <button
            type="button"
            onClick={() => setErrorWindowOpen(true)}
            className="shrink-0 flex items-center gap-2 md:gap-3 px-4 py-2.5 md:py-3 rounded-2xl transition-all text-amber-400 hover:bg-white/10"
          >
            <Bug size={18} />
            <span className="font-bold text-xs md:text-sm">
              Status & Error Log ({errors.length + actionLogs.length})
            </span>
          </button>
        </nav>

        <button
          onClick={async () => {
            await authService.logout();
            navigate('/welcome');
          }}
          className="hidden md:flex mt-8 items-center gap-3 px-4 py-3 text-red-400 hover:bg-red-400/10 rounded-2xl transition-all shrink-0"
        >
          <LogOut size={20} /> <span className="font-bold text-sm">Exit Admin</span>
        </button>
      </aside>

      {/* Main Content */}
      <main className="flex-1 md:ml-64 p-4 md:p-10 overflow-y-auto">
        {/* Always-Visible True Live Platform Counter Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
          <button
            type="button"
            onClick={() => setActiveTab('users')}
            className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm text-left hover:border-orange-300 transition-all"
          >
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 block">
              True Customers
            </span>
            <span className="text-2xl font-black text-slate-900 mt-1 block">{trueCustomers.length}</span>
            <span className="text-[10px] font-bold text-emerald-600">Live Customer Accounts</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('sellers')}
            className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm text-left hover:border-orange-300 transition-all"
          >
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 block">
              True Sellers
            </span>
            <span className="text-2xl font-black text-orange-600 mt-1 block">{allSellers.length}</span>
            <span className="text-[10px] font-bold text-slate-500">
              {allSellers.filter(s => s.verificationStatus === 'verified').length} Verified • {allSellers.filter(s => s.verificationStatus !== 'verified').length} Pending
            </span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('documents')}
            className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm text-left hover:border-orange-300 transition-all"
          >
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 block">
              Seller KYC Docs
            </span>
            <span className="text-2xl font-black text-blue-600 mt-1 block">{documents.length}</span>
            <span className="text-[10px] font-bold text-slate-500">Exact Binary Downloads</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('orders')}
            className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm text-left hover:border-orange-300 transition-all"
          >
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 block">
              Live Orders
            </span>
            <span className="text-2xl font-black text-emerald-600 mt-1 block">{orders.length}</span>
            <span className="text-[10px] font-bold text-slate-500">
              {orders.filter(o => o.orderStatus === 'pending').length} Pending Kitchen
            </span>
          </button>
          <button
            type="button"
            onClick={() => setErrorWindowOpen(true)}
            className="bg-slate-900 text-white p-4 rounded-2xl border border-slate-800 shadow-sm text-left hover:bg-slate-800 transition-all"
          >
            <span className="text-[10px] font-black uppercase tracking-widest text-orange-400 block">
              Whole-App Logs
            </span>
            <span className="text-2xl font-black text-white mt-1 block">{errors.length + actionLogs.length}</span>
            <span className="text-[10px] font-bold text-amber-300">Admin-Only Error & DB Console</span>
          </button>
        </div>

        {adminMessage && (
          <div className="mb-6 p-4 bg-slate-900 text-white rounded-2xl flex items-center justify-between text-xs font-bold">
            <span>{adminMessage}</span>
            <button onClick={() => setAdminMessage(null)} className="text-slate-400 hover:text-white uppercase text-[10px] font-black">
              Dismiss
            </button>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="animate-spin text-orange-500" size={32} />
          </div>
        ) : (
          <>
            {activeTab === 'sellers' && renderSellers()}
            {activeTab === 'restaurants' && renderRestaurants()}
            {activeTab === 'products' && renderProducts()}
            {activeTab === 'categories' && renderCategories()}
            {activeTab === 'delivery' && renderDeliveryIntegrations()}
            {activeTab === 'payments' && renderPayments()}
            {activeTab === 'logs' && renderLogs()}
            {activeTab === 'settings' && (
              <div className="space-y-8">
                {renderSettings()}
                <div className="pt-6 border-t border-slate-200">
                  <h3 className="text-xl font-black text-slate-900 mb-4">Plugin Controls</h3>
                  <PluginAdminSettings />
                </div>
              </div>
            )}
            {activeTab === 'restaurant_map' && <PluginAdminSettings />}
            {activeTab === 'orders' && (
              <div className="space-y-6">
                <div className="flex flex-wrap items-center justify-between gap-4 mb-2">
                  <div>
                    <h2 className="text-2xl font-black text-slate-900">
                      Recent Platform Orders ({orders.length})
                    </h2>
                    <p className="text-xs font-bold text-slate-500 mt-1">
                      Live real-time Firestore order stream • Update status directly to sync with Customer, Seller &amp; Delivery Partner
                    </p>
                  </div>
                </div>
                <div className="bg-white rounded-[32px] border border-slate-100 shadow-sm overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-100">
                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Order ID</th>
                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Customer &amp; Cell</th>
                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Restaurant, Seller &amp; Items</th>
                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Live GPS Location</th>
                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">COD Total &amp; GST</th>
                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Live Status &amp; Notify</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {orders.map(o => {
                        const lat = o.addressSnapshot?.latitude ?? o.customerLatitude;
                        const lng = o.addressSnapshot?.longitude ?? o.customerLongitude;
                        const mapsUrl =
                          o.addressSnapshot?.googleMapsLink ||
                          (typeof lat === 'number' && typeof lng === 'number'
                            ? `https://www.google.com/maps?q=${lat},${lng}`
                            : '');
                        const waUrl = notificationService.buildOrderWhatsAppUrl(o, 'customer');
                        const smsUrl = notificationService.buildOrderSmsInboxUrl(o, 'seller');
                        const orderItems = o.itemsSnapshot || o.items || [];
                        return (
                          <tr key={o.orderId}>
                            <td className="px-6 py-4 font-bold text-slate-900 text-xs">
                              <div>#{o.orderNumber?.split('-')[2] || o.orderNumber || o.orderId.slice(0, 8)}</div>
                              <div className="text-[10px] font-mono text-slate-400 mt-0.5">{o.orderNumber}</div>
                            </td>
                            <td className="px-6 py-4">
                              <p className="text-sm font-bold text-slate-900">{o.customerName || 'Customer'}</p>
                              <p className="text-xs font-mono text-emerald-700 font-bold flex items-center gap-1 mt-0.5">
                                <Phone size={11} /> {o.customerPhone || 'N/A'}
                              </p>
                            </td>
                            <td className="px-6 py-4">
                              <p className="text-sm font-bold text-slate-800">{o.restaurantName || 'Food India Kitchen'}</p>
                              <p className="text-[10px] font-mono text-slate-400">
                                Seller: {o.sellerId || 'N/A'}
                              </p>
                              <p className="text-xs text-slate-600 font-semibold mt-1">
                                {orderItems.map((i: any) => `${i.quantity || 1}x ${i.name}`).join(', ') || '1x Dish'}
                              </p>
                            </td>
                            <td className="px-6 py-4 text-xs">
                              <p className="text-slate-600 font-medium line-clamp-2 max-w-[220px]">
                                {o.addressSnapshot?.formattedAddress || o.deliveryAddress || 'Live GPS Location'}
                              </p>
                              {mapsUrl && (
                                <a
                                  href={mapsUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 text-[10px] font-black text-blue-600 hover:underline uppercase mt-1"
                                >
                                  <Navigation size={11} />
                                  {typeof lat === 'number' && typeof lng === 'number'
                                    ? `${lat.toFixed(5)}, ${lng.toFixed(5)}`
                                    : 'Open Maps'}
                                </a>
                              )}
                            </td>
                            <td className="px-6 py-4">
                              <p className="font-black text-slate-900 text-sm">₹{o.totalAmount}</p>
                              {o.gstEnabled && Number(o.gstAmount || 0) > 0 && (
                                <p className="text-[10px] font-bold text-emerald-600">
                                  Incl. 5% GST: ₹{Number(o.gstAmount).toFixed(2)}
                                </p>
                              )}
                              <span className="text-[10px] font-bold uppercase text-slate-400">
                                {o.paymentMethod || 'COD'}
                              </span>
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex flex-col items-start gap-2">
                                <select
                                  value={o.orderStatus || 'pending'}
                                  onChange={async (e) => {
                                    const nextStatus = e.target.value as any;
                                    try {
                                      await orderService.updateOrderStatus(
                                        o.orderId,
                                        nextStatus,
                                        `Updated by Admin to ${nextStatus}`
                                      );
                                      reportGlobalButtonStatus({
                                        buttonName: `Admin Update Order #${o.orderNumber} Status`,
                                        backendPath: `Firestore: orders/${o.orderId}`,
                                        dbUpdated: 'UPDATED',
                                        statusType: 'success',
                                        message: `Order #${o.orderNumber} status updated to ${nextStatus.toUpperCase()} in Firestore.`,
                                      });
                                    } catch (err: any) {
                                      reportGlobalError(
                                        err?.message || 'Failed to update order status',
                                        err?.stack,
                                        'backend',
                                        {
                                          buttonName: `Admin Update Order #${o.orderNumber} Status`,
                                          backendPath: `orders/${o.orderId}`,
                                          dbUpdated: 'NOT_UPDATED',
                                          statusType: 'error',
                                        }
                                      );
                                    }
                                  }}
                                  className="px-2.5 py-1.5 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-wider cursor-pointer border border-slate-700 focus:outline-none focus:border-orange-500"
                                >
                                  <option value="pending">PENDING</option>
                                  <option value="confirmed">CONFIRMED</option>
                                  <option value="preparing">PREPARING</option>
                                  <option value="ready_for_pickup">READY FOR PICKUP</option>
                                  <option value="out_for_delivery">OUT FOR DELIVERY</option>
                                  <option value="delivered">DELIVERED</option>
                                  <option value="cancelled">CANCELLED</option>
                                </select>
                                <div className="flex flex-wrap items-center gap-1.5">
                                  <a
                                    href={waUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="px-2.5 py-1 bg-green-600 hover:bg-green-700 text-white rounded-lg text-[9px] font-black uppercase tracking-wider flex items-center gap-1"
                                  >
                                    <MessageCircle size={11} /> WhatsApp
                                  </a>
                                  <a
                                    href={smsUrl}
                                    className="px-2.5 py-1 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-[9px] font-black uppercase tracking-wider flex items-center gap-1"
                                  >
                                    <Phone size={11} /> SMS
                                  </a>
                                </div>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
            {activeTab === 'users' && (
              <div className="space-y-6">
                <h2 className="text-2xl font-black text-slate-900 mb-6">Customers & System Users</h2>
                <div className="bg-white rounded-[32px] border border-slate-100 shadow-sm overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-100">
                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Full Name</th>
                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Email / Phone</th>
                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Live GPS Profile</th>
                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Role</th>
                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Status</th>
                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {users.map(u => (
                        <tr key={u.uid}>
                          <td className="px-6 py-4 font-bold text-slate-900 text-sm">{u.fullName}</td>
                          <td className="px-6 py-4 text-slate-500 text-xs">{u.email}<br /><span className="font-bold text-slate-800">{u.phone || 'No phone'}</span></td>
                          <td className="px-6 py-4 text-xs">
                            {u.liveGps?.latitude ? (
                              <a
                                href={u.liveGps.googleMapsLink || `https://www.google.com/maps?q=${u.liveGps.latitude},${u.liveGps.longitude}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-600 font-bold hover:underline flex items-center gap-1"
                              >
                                <MapPin size={12} /> {u.liveGps.latitude.toFixed(4)}, {u.liveGps.longitude.toFixed(4)}
                              </a>
                            ) : (
                              <span className="text-slate-400 italic">Not captured yet</span>
                            )}
                          </td>
                          <td className="px-6 py-4 uppercase text-[10px] font-black tracking-widest text-slate-400">{u.role}</td>
                          <td className={`px-6 py-4 uppercase text-[10px] font-black tracking-widest ${u.accountStatus === 'suspended' ? 'text-red-600' : 'text-green-600'}`}>
                            {u.accountStatus || 'active'}
                          </td>
                          <td className="px-6 py-4">
                            <button
                              onClick={() => toggleSuspendUser(u.uid, u.accountStatus)}
                              className="p-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors text-xs font-bold flex items-center gap-1"
                            >
                              <Ban size={14} />
                              {u.accountStatus === 'suspended' ? 'Restore' : 'Suspend'}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
            {activeTab === 'plans' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-2xl font-black text-slate-900">Seller Subscription Plans</h2>
                    <p className="text-xs font-bold text-slate-400 mt-1">
                      Configure flat-rate subscription plans billed via Razorpay Payment Links (0% order commission).
                    </p>
                  </div>
                  <button
                    onClick={() => setShowPlanModal(true)}
                    className="bg-orange-500 text-white px-6 py-2.5 rounded-2xl font-bold text-sm shadow-lg shadow-orange-500/20 flex items-center gap-2"
                  >
                    <Plus size={18} /> New Plan
                  </button>
                </div>

                {showPlanModal && (
                  <form
                    onSubmit={handleCreatePlan}
                    className="bg-white p-6 rounded-[32px] border border-orange-200 shadow-sm space-y-4 mb-6"
                  >
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">
                        Create Subscription Plan
                      </h3>
                      <button
                        type="button"
                        onClick={() => setShowPlanModal(false)}
                        className="text-xs font-bold text-slate-400 hover:text-slate-600"
                      >
                        Cancel
                      </button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      <div className="space-y-1">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                          Plan Name
                        </label>
                        <input
                          type="text"
                          required
                          value={newPlan.name}
                          onChange={e => setNewPlan({ ...newPlan, name: e.target.value })}
                          placeholder="e.g. Monthly Pro Partner"
                          className="w-full h-12 px-4 bg-slate-50 rounded-xl text-sm font-bold outline-none border border-transparent focus:border-orange-500"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                          Price
                        </label>
                        <input
                          type="number"
                          required
                          min="1"
                          value={newPlan.price}
                          onChange={e => setNewPlan({ ...newPlan, price: e.target.value })}
                          placeholder="999"
                          className="w-full h-12 px-4 bg-slate-50 rounded-xl text-sm font-bold outline-none border border-transparent focus:border-orange-500"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                          Currency
                        </label>
                        <input
                          type="text"
                          required
                          value={newPlan.currency}
                          onChange={e => setNewPlan({ ...newPlan, currency: e.target.value })}
                          className="w-full h-12 px-4 bg-slate-50 rounded-xl text-sm font-bold outline-none border border-transparent focus:border-orange-500"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                          Duration (Days)
                        </label>
                        <input
                          type="number"
                          required
                          min="1"
                          value={newPlan.durationDays}
                          onChange={e => setNewPlan({ ...newPlan, durationDays: e.target.value })}
                          className="w-full h-12 px-4 bg-slate-50 rounded-xl text-sm font-bold outline-none border border-transparent focus:border-orange-500"
                        />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                        Features (One per line)
                      </label>
                      <textarea
                        rows={4}
                        value={newPlan.featuresText}
                        onChange={e => setNewPlan({ ...newPlan, featuresText: e.target.value })}
                        className="w-full p-4 bg-slate-50 rounded-xl text-xs font-bold outline-none border border-transparent focus:border-orange-500"
                      />
                    </div>
                    <button
                      type="submit"
                      className="px-6 py-3 bg-slate-900 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-orange-500 transition-colors"
                    >
                      Save Subscription Plan
                    </button>
                  </form>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {plans.map(plan => (
                    <div key={plan.planId} className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm relative overflow-hidden flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between">
                          <h4 className="text-lg font-black text-slate-900 uppercase tracking-tight">{plan.name}</h4>
                          <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${plan.isActive ? 'bg-green-100 text-green-600' : 'bg-slate-100 text-slate-400'}`}>
                            {plan.isActive ? 'Active' : 'Disabled'}
                          </span>
                        </div>
                        <p className="text-3xl font-black text-orange-500 mt-2">
                          {plan.currency === 'INR' ? '₹' : `${plan.currency} `}{plan.price}
                          <span className="text-xs font-black text-emerald-600 ml-2">
                            + 18% GST (₹{plan.gstAmount ?? Number(((plan.price * 18) / 100).toFixed(2))})
                          </span>
                        </p>
                        <p className="text-xs font-bold text-slate-700 mt-1">
                          Total Payable w/ GST: ₹{plan.totalWithGst ?? Number((plan.price * 1.18).toFixed(2))}
                        </p>
                        <p className="text-[10px] font-mono text-slate-500 mt-0.5">
                          GSTIN: {plan.gstNumber || '01BMAPL3192D1CY'} • FSSAI: 11026999000072
                        </p>
                        <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">{plan.durationDays} Days • 0% Commission</p>
                        <ul className="mt-6 space-y-2">
                          {(plan.features || []).map((f: string, i: number) => (
                            <li key={i} className="flex items-center gap-2 text-xs font-medium text-slate-600">
                              <CheckCircle2 size={14} className="text-green-500 shrink-0" /> {f}
                            </li>
                          ))}
                        </ul>
                      </div>
                      <button
                        onClick={() => togglePlanActive(plan)}
                        className="mt-6 w-full py-2.5 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-xl text-[10px] font-black uppercase tracking-widest transition-colors"
                      >
                        {plan.isActive ? 'Disable Plan' : 'Enable Plan'}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {activeTab === 'documents' && (
              <div className="space-y-6">
                <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
                  <div>
                    <h2 className="text-2xl font-black text-slate-900">Seller KYC Documents & License Numbers ({documents.length})</h2>
                    <p className="text-xs font-bold text-slate-400 mt-1">
                      Download or preview uploaded seller documents, verify Business License / GST, FSSAI, and Aadhaar / PAN numbers, and Approve or Reject.
                    </p>
                  </div>
                </div>

                <div className="bg-white rounded-[32px] border border-slate-100 shadow-sm overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-100">
                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Seller</th>
                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Document Type & Number</th>
                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Seller License Numbers</th>
                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Download / Preview</th>
                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Status</th>
                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Admin Decision</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {documents.map(document => {
                        const sellerObj = allSellers.find(s => s.sellerId === document.sellerId || s.uid === document.sellerId);
                        const bizLic = document.businessLicenseNumber || sellerObj?.businessLicenseNumber || '';
                        const fssaiLic = document.fssaiLicenseNumber || sellerObj?.fssaiLicenseNumber || '';
                        const idNum = document.aadhaarOrPanNumber || sellerObj?.aadhaarOrPanNumber || '';

                        return (
                          <tr key={document.documentId}>
                            <td className="px-6 py-4">
                              <p className="font-bold text-slate-900 text-sm">
                                {document.sellerName || sellerObj?.ownerName || `${document.sellerId.substring(0, 8)}...`}
                              </p>
                              <p className="text-[11px] text-slate-400 font-mono">
                                {document.sellerPhone || sellerObj?.businessPhone || document.sellerId.substring(0, 10)}
                              </p>
                            </td>
                            <td className="px-6 py-4">
                              <span className="uppercase text-[10px] font-black tracking-widest text-orange-600 bg-orange-50 px-2.5 py-1 rounded-lg">
                                {document.documentType.replace(/_/g, ' ')}
                              </span>
                              {document.documentNumber && (
                                <p className="text-xs font-black font-mono text-slate-800 mt-1.5">
                                  No: {document.documentNumber}
                                </p>
                              )}
                              {document.fileName && (
                                <p className="text-[11px] text-slate-500 font-bold mt-0.5 truncate max-w-[200px]">
                                  File: {document.fileName}
                                </p>
                              )}
                            </td>
                            <td className="px-6 py-4 text-[11px] space-y-1 font-mono">
                              <div><span className="text-slate-400 font-sans font-bold">GST/Biz:</span> <span className="font-bold text-slate-800">{bizLic || '—'}</span></div>
                              <div><span className="text-slate-400 font-sans font-bold">FSSAI:</span> <span className="font-bold text-slate-800">{fssaiLic || '—'}</span></div>
                              <div><span className="text-slate-400 font-sans font-bold">Aadhaar/PAN:</span> <span className="font-bold text-slate-800">{idNum || '—'}</span></div>
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex flex-wrap items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => downloadSellerDocumentFile(document)}
                                  className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 shadow-sm transition-colors"
                                >
                                  <Download size={13} /> Download Original File
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleOpenPreviewDoc(document)}
                                  className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 transition-colors"
                                >
                                  <Eye size={13} /> Preview
                                </button>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <span className={`text-[10px] font-black uppercase px-2.5 py-1 rounded-lg ${
                                document.verificationStatus === 'verified' ? 'bg-green-100 text-green-700' :
                                document.verificationStatus === 'rejected' ? 'bg-red-100 text-red-600' :
                                'bg-orange-100 text-orange-600'
                              }`}>
                                {document.verificationStatus}
                              </span>
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => approveSellerDocument(document)}
                                  className="px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center gap-1 shadow-sm"
                                  title="Approve Document & Unlock Seller Publishing"
                                >
                                  <CheckCircle2 size={14} /> Approve
                                </button>
                                <button
                                  type="button"
                                  onClick={() => rejectSellerDocument(document)}
                                  className="px-3 py-2 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center gap-1"
                                  title="Reject Document"
                                >
                                  <XCircle size={14} /> Reject
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                      {documents.length === 0 && (
                        <tr>
                          <td colSpan={6} className="px-6 py-10 text-center text-sm text-slate-400 italic">
                            No seller verification documents uploaded yet.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}

        {/* Document Preview & Download Modal */}
        {previewDoc && (
          <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[90vh]">
              <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-black uppercase tracking-widest text-orange-400">
                    Seller KYC Document Inspection
                  </span>
                  <h3 className="text-base font-black mt-0.5">
                    {previewDoc.documentType.replace(/_/g, ' ').toUpperCase()} — {previewDoc.fileName || 'Document'}
                  </h3>
                </div>
                <button
                  onClick={() => setPreviewDoc(null)}
                  className="p-2 rounded-xl bg-white/10 text-slate-300 hover:text-white"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="p-6 overflow-y-auto space-y-4 flex-1">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-100 text-xs">
                  <div>
                    <span className="text-[9px] font-black uppercase text-slate-400 block">Original File Name</span>
                    <span className="font-mono font-black text-slate-900">{previewDoc.fileName || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-[9px] font-black uppercase text-slate-400 block">Business / GST License</span>
                    <span className="font-mono font-black text-slate-900">{previewDoc.businessLicenseNumber || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-[9px] font-black uppercase text-slate-400 block">FSSAI / Aadhaar-PAN</span>
                    <span className="font-mono font-black text-slate-900">
                      {previewDoc.fssaiLicenseNumber || previewDoc.aadhaarOrPanNumber || 'N/A'}
                    </span>
                  </div>
                </div>

                {loadingPreviewUrl ? (
                  <div className="p-10 flex items-center justify-center gap-2 text-xs font-bold text-slate-500">
                    <Loader2 size={18} className="animate-spin text-orange-500" />
                    <span>Loading original uploaded file binary...</span>
                  </div>
                ) : previewResolvedUrl ? (
                  previewResolvedUrl.startsWith('data:image/') ? (
                    <div className="bg-slate-100 rounded-2xl p-4 flex items-center justify-center">
                      <img
                        src={previewResolvedUrl}
                        alt={previewDoc.fileName || 'KYC Document'}
                        className="max-h-[420px] rounded-xl object-contain"
                      />
                    </div>
                  ) : (
                    <iframe
                      src={previewResolvedUrl}
                      title={previewDoc.fileName || 'KYC Document'}
                      className="w-full h-[400px] rounded-2xl border border-slate-200"
                    />
                  )
                ) : (
                  <div className="bg-slate-50 rounded-2xl p-8 text-center space-y-2 border border-slate-200">
                    <FileText size={36} className="mx-auto text-slate-400" />
                    <p className="text-sm font-bold text-slate-700">
                      {previewDoc.fileName || previewDoc.storagePath}
                    </p>
                    <p className="text-xs text-slate-500">
                      Click "Download Exact Uploaded File" below to save and inspect the original file.
                    </p>
                  </div>
                )}
              </div>

              <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => downloadSellerDocumentFile(previewDoc)}
                  className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2"
                >
                  <Download size={15} /> Download Exact Uploaded File ({previewDoc.fileName || 'Document'})
                </button>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={async () => {
                      await approveSellerDocument(previewDoc);
                      setPreviewDoc(null);
                    }}
                    className="px-4 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5"
                  >
                    <CheckCircle2 size={15} /> Approve Document
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      await rejectSellerDocument(previewDoc);
                      setPreviewDoc(null);
                    }}
                    className="px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5"
                  >
                    <XCircle size={15} /> Reject Document
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
