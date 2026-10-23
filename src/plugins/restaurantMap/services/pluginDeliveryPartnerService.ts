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
import { PluginDeliveryPartner } from '../models/types';
import { v4 as uuidv4 } from 'uuid';
import { calculateDistance } from '../../../utils/location';

const PARTNERS_COL = collection(db, 'plugin_map_delivery_partners');

// Helper to calculate 3-leg round trip distance:
// Leg 1: Partner vehicle to Restaurant
// Leg 2: Restaurant to Customer
// Leg 3: Customer back to Partner vehicle
export const calculateRoundTripDistanceKm = (
  partnerLat: number,
  partnerLng: number,
  restaurantLat: number,
  restaurantLng: number,
  customerLat: number,
  customerLng: number
): number => {
  const leg1 = calculateDistance(partnerLat, partnerLng, restaurantLat, restaurantLng);
  const leg2 = calculateDistance(restaurantLat, restaurantLng, customerLat, customerLng);
  const leg3 = calculateDistance(customerLat, customerLng, partnerLat, partnerLng);

  const total = leg1 + leg2 + leg3;
  return Math.round(total * 100) / 100; // 2 decimal places
};

// Calculate delivery charge based on round-trip distance & partner pricing
export const calculatePartnerDeliveryCharge = (
  roundTripKm: number,
  basePrice: number = 20,
  pricePerKm: number = 10
): number => {
  const variableCharge = roundTripKm * pricePerKm;
  const total = basePrice + variableCharge;
  return Math.round(total);
};

const DEMO_PARTNERS: PluginDeliveryPartner[] = [
  {
    partnerId: 'partner_demo_1',
    name: 'Aamir Khan (Fast Express)',
    phone: '+919876512345',
    whatsappNumber: '919876512345',
    vehicleType: 'scooter',
    vehicleNumber: 'JK01-AB-1234',
    identityDocUrl: 'Aadhaar Verified (Doc ID: 4891-2093-1102)',
    licenseDocUrl: 'Driving Licence Verified (DL: JK-2022-88192)',
    vehicleRcUrl: 'Vehicle RC Verified (JK01-AB-1234)',
    latitude: 34.085,
    longitude: 74.805,
    currentAddress: 'Lal Chowk Market, Srinagar',
    isOnline: true,
    baseDeliveryPrice: 20,
    pricePerKm: 10,
    approvalStatus: 'approved',
    subscriptionStatus: 'active',
    monthlyFeeAmount: 299,
    rating: 4.9,
    totalDeliveries: 142,
  },
  {
    partnerId: 'partner_demo_2',
    name: 'Tariq Ahmad (Kashmir Riders)',
    phone: '+919906987654',
    whatsappNumber: '919906987654',
    vehicleType: 'bike',
    vehicleNumber: 'JK03-C-5678',
    identityDocUrl: 'PAN Card Verified (Doc ID: ABCDE1234F)',
    licenseDocUrl: 'Driving Licence Verified (DL: JK-2021-99201)',
    vehicleRcUrl: 'Vehicle RC Verified (JK03-C-5678)',
    latitude: 34.091,
    longitude: 74.825,
    currentAddress: 'Dal Lake Boulevard, Srinagar',
    isOnline: true,
    baseDeliveryPrice: 25,
    pricePerKm: 12,
    approvalStatus: 'approved',
    subscriptionStatus: 'active',
    monthlyFeeAmount: 299,
    rating: 4.8,
    totalDeliveries: 98,
  },
];

export const pluginDeliveryPartnerService = {
  // Subscribe to all approved and online delivery partners for map rendering
  subscribeLivePartners(callback: (partners: PluginDeliveryPartner[]) => void) {
    let dbPartners: PluginDeliveryPartner[] = [];

    const publish = () => {
      const partnerMap = new Map<string, PluginDeliveryPartner>();
      DEMO_PARTNERS.forEach((p) => partnerMap.set(p.partnerId, p));
      dbPartners.forEach((p) => partnerMap.set(p.partnerId, p));

      const onlineApproved = Array.from(partnerMap.values()).filter(
        (p) => p.approvalStatus === 'approved' && p.isOnline
      );
      callback(onlineApproved);
    };

    return onSnapshot(
      PARTNERS_COL,
      (snap) => {
        dbPartners = snap.docs.map((d) => ({ ...d.data(), partnerId: d.id } as PluginDeliveryPartner));
        publish();
      },
      (err) => {
        console.warn('Error subscribing to plugin_map_delivery_partners:', err);
        publish();
      }
    );
  },

  // Subscribe to all delivery partners (for Admin dashboard management & approval)
  subscribeAllPartners(callback: (partners: PluginDeliveryPartner[]) => void) {
    let dbPartners: PluginDeliveryPartner[] = [];

    const publish = () => {
      const partnerMap = new Map<string, PluginDeliveryPartner>();
      DEMO_PARTNERS.forEach((p) => partnerMap.set(p.partnerId, p));
      dbPartners.forEach((p) => partnerMap.set(p.partnerId, p));
      callback(Array.from(partnerMap.values()));
    };

    return onSnapshot(
      PARTNERS_COL,
      (snap) => {
        dbPartners = snap.docs.map((d) => ({ ...d.data(), partnerId: d.id } as PluginDeliveryPartner));
        publish();
      },
      (err) => {
        console.warn('Error subscribing to all delivery partners:', err);
        publish();
      }
    );
  },

  // Helper to sanitize Firestore documents (removes undefined fields)
  sanitizePayload<T extends Record<string, any>>(obj: T): Record<string, any> {
    const clean: Record<string, any> = {};
    Object.keys(obj).forEach((key) => {
      if (obj[key] !== undefined) {
        clean[key] = obj[key];
      }
    });
    return clean;
  },

  // Register a new delivery partner
  async registerPartner(
    data: Omit<
      PluginDeliveryPartner,
      'partnerId' | 'approvalStatus' | 'subscriptionStatus' | 'rating' | 'totalDeliveries'
    >
  ): Promise<string> {
    const partnerId = `partner_${Date.now()}`;
    const newPartner: PluginDeliveryPartner = {
      ...data,
      userId: data.userId || '',
      whatsappNumber: data.whatsappNumber || data.phone || '',
      identityDocUrl: data.identityDocUrl || '',
      licenseDocUrl: data.licenseDocUrl || '',
      vehicleRcUrl: data.vehicleRcUrl || '',
      vehicleInsuranceUrl: data.vehicleInsuranceUrl || '',
      currentAddress: data.currentAddress || '',
      partnerId,
      approvalStatus: 'pending', // Pending Admin verification and approval
      subscriptionStatus: 'active', // First month included with registration
      monthlyFeeAmount: 299,
      rating: 5.0,
      totalDeliveries: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Cache in memory array for instant retrieval across app
    DEMO_PARTNERS.unshift(newPartner);

    // Save in localStorage as fallback
    try {
      localStorage.setItem(`delivery_partner_${newPartner.phone}`, JSON.stringify(newPartner));
      localStorage.setItem('current_delivery_partner', JSON.stringify(newPartner));
    } catch {
      // ignore
    }

    // Attempt Firestore persistence
    try {
      const cleanPayload = this.sanitizePayload(newPartner);
      await setDoc(doc(PARTNERS_COL, partnerId), cleanPayload, { merge: true });
    } catch (err) {
      console.warn('Firestore setDoc notice for delivery partner:', err);
    }

    return partnerId;
  },

  // Get partner by ID
  async getPartnerById(partnerId: string): Promise<PluginDeliveryPartner | null> {
    const cached = DEMO_PARTNERS.find((p) => p.partnerId === partnerId);
    if (cached) return cached;

    try {
      const snap = await getDoc(doc(PARTNERS_COL, partnerId));
      if (snap.exists()) {
        return { ...snap.data(), partnerId: snap.id } as PluginDeliveryPartner;
      }
    } catch {
      // fallback
    }

    try {
      const local = localStorage.getItem('current_delivery_partner');
      if (local) {
        const parsed = JSON.parse(local);
        if (parsed.partnerId === partnerId) return parsed;
      }
    } catch {
      // fallback
    }

    return null;
  },

  // Get partner by user ID or phone
  async getPartnerByPhone(phone: string): Promise<PluginDeliveryPartner | null> {
    const cached = DEMO_PARTNERS.find((p) => p.phone === phone);
    if (cached) return cached;

    try {
      const local = localStorage.getItem(`delivery_partner_${phone}`) || localStorage.getItem('current_delivery_partner');
      if (local) {
        const parsed = JSON.parse(local);
        if (parsed.phone === phone) return parsed;
      }
    } catch {
      // fallback
    }

    try {
      const q = query(PARTNERS_COL, where('phone', '==', phone));
      const snap = await getDocs(q);
      if (!snap.empty) {
        const d = snap.docs[0];
        return { ...d.data(), partnerId: d.id } as PluginDeliveryPartner;
      }
    } catch {
      // fallback
    }

    return DEMO_PARTNERS.find((p) => p.phone === phone) || null;
  },

  // Update live location & status
  async updateLocationAndStatus(
    partnerId: string,
    latitude: number,
    longitude: number,
    isOnline: boolean,
    address?: string
  ): Promise<void> {
    const payload = this.sanitizePayload({
      latitude,
      longitude,
      isOnline,
      currentAddress: address || '',
      updatedAt: new Date().toISOString(),
    });

    // Update local cached partner if present
    const cached = DEMO_PARTNERS.find((p) => p.partnerId === partnerId);
    if (cached) {
      cached.latitude = latitude;
      cached.longitude = longitude;
      cached.isOnline = isOnline;
      if (address) cached.currentAddress = address;
    }

    try {
      await setDoc(doc(PARTNERS_COL, partnerId), payload, { merge: true });
    } catch (err) {
      console.warn('Firestore setDoc notice for updateLocationAndStatus:', err);
    }
  },

  // Update delivery partner pricing (Base price & price per km)
  async updatePricing(
    partnerId: string,
    baseDeliveryPrice: number,
    pricePerKm: number
  ): Promise<void> {
    const payload = this.sanitizePayload({
      baseDeliveryPrice,
      pricePerKm,
      updatedAt: new Date().toISOString(),
    });

    const cached = DEMO_PARTNERS.find((p) => p.partnerId === partnerId);
    if (cached) {
      cached.baseDeliveryPrice = baseDeliveryPrice;
      cached.pricePerKm = pricePerKm;
    }

    try {
      await setDoc(doc(PARTNERS_COL, partnerId), payload, { merge: true });
    } catch (err) {
      console.warn('Firestore setDoc notice for updatePricing:', err);
    }
  },

  // Admin Approve Partner
  async approvePartner(partnerId: string): Promise<void> {
    const cached = DEMO_PARTNERS.find((p) => p.partnerId === partnerId);
    if (cached) cached.approvalStatus = 'approved';

    try {
      await setDoc(
        doc(PARTNERS_COL, partnerId),
        { approvalStatus: 'approved', updatedAt: new Date().toISOString() },
        { merge: true }
      );
    } catch (err) {
      console.warn('Firestore setDoc notice for approvePartner:', err);
    }
  },

  // Admin Reject Partner
  async rejectPartner(partnerId: string): Promise<void> {
    const cached = DEMO_PARTNERS.find((p) => p.partnerId === partnerId);
    if (cached) cached.approvalStatus = 'rejected';

    try {
      await setDoc(
        doc(PARTNERS_COL, partnerId),
        { approvalStatus: 'rejected', updatedAt: new Date().toISOString() },
        { merge: true }
      );
    } catch (err) {
      console.warn('Firestore setDoc notice for rejectPartner:', err);
    }
  },

  // Renew ₹299 Monthly Subscription
  async processSubscriptionPayment(partnerId: string, paymentRef: string): Promise<void> {
    const nextExpiry = new Date();
    nextExpiry.setDate(nextExpiry.getDate() + 30);

    const cached = DEMO_PARTNERS.find((p) => p.partnerId === partnerId);
    if (cached) {
      cached.subscriptionStatus = 'active';
      cached.subscriptionExpiryDate = nextExpiry.toISOString();
    }

    try {
      await setDoc(
        doc(PARTNERS_COL, partnerId),
        {
          subscriptionStatus: 'active',
          subscriptionExpiryDate: nextExpiry.toISOString(),
          lastPaymentRef: paymentRef,
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );
    } catch (err) {
      console.warn('Firestore setDoc notice for processSubscriptionPayment:', err);
    }
  },
};
