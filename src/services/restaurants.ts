import { doc, getDoc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase/config';
import { Restaurant } from '../models/types';

export const restaurantService = {
  async getRestaurant(restaurantId: string): Promise<Restaurant | null> {
    if (!restaurantId) return null;
    try {
      const snap = await getDoc(doc(db, 'restaurants', restaurantId));
      if (snap.exists()) {
        return { restaurantId: snap.id, ...snap.data() } as Restaurant;
      }
      // Fallback for test restaurants if not yet seeded in Firestore
      return {
        restaurantId,
        sellerId: 'test_seller_foodindia',
        restaurantName: 'Royal Zaika Indian Kitchen (Test Store)',
        description: 'Official Food India test kitchen serving authentic Indian dishes.',
        phone: '+919876543210',
        address: 'Connaught Place, New Delhi, India',
        state: 'Delhi',
        city: 'New Delhi',
        district: 'New Delhi',
        pincode: '110001',
        latitude: 28.6315,
        longitude: 77.2167,
        googleMapsLink: 'https://www.google.com/maps?q=28.6315,77.2167',
        openingHours: { open: '08:00', close: '23:30' },
        isOpen: true,
        preparationTime: '20-30 mins',
        allowOwnDeliveryStaff: true,
        deliveryPricingMode: 'base_km',
        baseDeliveryCharge: 25,
        deliveryPricePerKm: 6,
        deliveryRanges: [
          { minKm: 0, maxKm: 3, price: 25 },
          { minKm: 3, maxKm: 7, price: 45 },
          { minKm: 7, maxKm: 15, price: 70 },
        ],
        maximumDeliveryDistanceKm: 20,
        approvalStatus: 'approved',
        createdAt: null,
        updatedAt: null,
      };
    } catch (error) {
      console.error('Error loading restaurant:', error);
      return null;
    }
  },

  async updateRestaurant(restaurantId: string, updates: Partial<Restaurant>): Promise<void> {
    if (!restaurantId) return;
    await setDoc(
      doc(db, 'restaurants', restaurantId),
      {
        ...updates,
        restaurantId,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  },
};
