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
  deleteDoc,
} from 'firebase/firestore';
import { db } from '../../../firebase/config';
import { PluginRestaurant, PluginMenuItem } from '../models/types';
import { v4 as uuidv4 } from 'uuid';

const RESTAURANTS_COL = collection(db, 'plugin_map_restaurants');
const MAIN_RESTAURANTS_COL = collection(db, 'restaurants');
const MENUS_COL = collection(db, 'plugin_map_menus');
const MAIN_PRODUCTS_COL = collection(db, 'products');

export const slugify = (text: string): string => {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
};

const mapMainRestaurantToPlugin = (data: any, id: string): PluginRestaurant => {
  const name = data.restaurantName || data.name || 'Indian Kitchen';
  const lat = typeof data.latitude === 'number' && Number.isFinite(data.latitude) ? data.latitude : 33.7297;
  const lng = typeof data.longitude === 'number' && Number.isFinite(data.longitude) ? data.longitude : 75.1498;

  return {
    restaurantId: id,
    sellerId: data.sellerId || `seller_${id}`,
    name,
    slug: slugify(name) || id,
    description: data.description || 'Official Food India Partner Kitchen',
    ownerName: data.ownerName || 'Restaurant Manager',
    ownerEmail: data.ownerEmail || 'contact@foodindia.sbs',
    phone: data.phone || '+919876543210',
    address: data.address || `${data.city || 'Kashmir'}, India`,
    latitude: lat,
    longitude: lng,
    cuisineTypes: Array.isArray(data.cuisineTypes)
      ? data.cuisineTypes
      : Array.isArray(data.cuisines)
      ? data.cuisines
      : ['Authentic Indian', 'Local Cuisine'],
    logoUrl: data.logoUrl || data.bannerUrl || data.imageUrl || 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=400&fit=crop',
    coverUrl: data.coverUrl || data.bannerUrl,
    rating: typeof data.rating === 'number' ? data.rating : 4.8,
    totalReviews: data.reviewCount || data.totalReviews || 18,
    deliveryRadiusKm: data.maximumDeliveryDistanceKm || 20,
    baseDeliveryFee: data.baseDeliveryCharge || data.baseDeliveryFee || 25,
    minOrderAmount: data.minOrderAmount || 100,
    isOpen: data.isOpen ?? true,
    isApproved: data.approvalStatus !== 'rejected',
    approvalStatus: data.approvalStatus === 'rejected' ? 'rejected' : 'approved',
  };
};

const DEMO_FALLBACK_RESTAURANTS: PluginRestaurant[] = [
  {
    restaurantId: 'demo_royal_zaika',
    sellerId: 'test_seller_foodindia',
    name: 'Royal Zaika Indian Kitchen',
    slug: 'royal-zaika-indian-kitchen',
    description: 'Official Food India flagship kitchen serving authentic North Indian & Biryani.',
    ownerName: 'Chef Rahul Sharma',
    ownerEmail: 'royalzaika@foodindia.sbs',
    phone: '+919876543210',
    address: 'Lal Chowk, Srinagar, Jammu and Kashmir',
    latitude: 34.0837,
    longitude: 74.7973,
    cuisineTypes: ['North Indian', 'Biryani', 'Mughlai'],
    logoUrl: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=400&fit=crop',
    rating: 4.9,
    totalReviews: 42,
    deliveryRadiusKm: 25,
    baseDeliveryFee: 25,
    minOrderAmount: 150,
    isOpen: true,
    isApproved: true,
    approvalStatus: 'approved',
  },
  {
    restaurantId: 'demo_kashmiri_wazwan',
    sellerId: 'test_seller_wazwan',
    name: 'Kashmiri Wazwan Palace',
    slug: 'kashmiri-wazwan-palace',
    description: 'Specialty Kashmiri Rista, Rogan Josh, Gushtaba and Wazwan feast.',
    ownerName: 'Ustaad Ghulam Ahmad',
    ownerEmail: 'wazwan@foodindia.sbs',
    phone: '+919906123456',
    address: 'Boulevard Road, Dal Lake, Srinagar, Kashmir',
    latitude: 34.088,
    longitude: 74.832,
    cuisineTypes: ['Kashmiri Wazwan', 'Mutton Specialties', 'Traditional'],
    logoUrl: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=400&fit=crop',
    rating: 4.9,
    totalReviews: 56,
    deliveryRadiusKm: 30,
    baseDeliveryFee: 30,
    minOrderAmount: 200,
    isOpen: true,
    isApproved: true,
    approvalStatus: 'approved',
  },
];

export const pluginRestaurantService = {
  // Subscribe to all registered restaurants so every kitchen permanently appears on open map
  subscribeApprovedRestaurants(callback: (restaurants: PluginRestaurant[]) => void) {
    let pluginResList: PluginRestaurant[] = [];
    let mainResList: PluginRestaurant[] = [];

    const publishCombined = () => {
      const mergedMap = new Map<string, PluginRestaurant>();

      // Add fallbacks first
      DEMO_FALLBACK_RESTAURANTS.forEach((r) => mergedMap.set(r.restaurantId, r));

      // Merge main app restaurants
      mainResList.forEach((r) => mergedMap.set(r.restaurantId, r));

      // Merge plugin map restaurants (overrides if explicit)
      pluginResList.forEach((r) => mergedMap.set(r.restaurantId, r));

      const finalApproved = Array.from(mergedMap.values()).filter(
        (r) => r.approvalStatus !== 'rejected'
      );
      callback(finalApproved);
    };

    const unsubPlugin = onSnapshot(
      RESTAURANTS_COL,
      (snap) => {
        pluginResList = snap.docs
          .map((d) => ({ ...d.data(), restaurantId: d.id } as PluginRestaurant))
          .filter((r) => r.approvalStatus !== 'rejected');
        publishCombined();
      },
      (err) => {
        console.warn('Error subscribing to plugin_map_restaurants:', err);
        publishCombined();
      }
    );

    const unsubMain = onSnapshot(
      MAIN_RESTAURANTS_COL,
      (snap) => {
        mainResList = snap.docs.map((d) => mapMainRestaurantToPlugin(d.data(), d.id));
        publishCombined();
      },
      (err) => {
        console.warn('Error subscribing to main restaurants collection:', err);
        publishCombined();
      }
    );

    return () => {
      unsubPlugin();
      unsubMain();
    };
  },

  // Subscribe to all restaurants (for Admin approval & management)
  subscribeAllRestaurants(callback: (restaurants: PluginRestaurant[]) => void) {
    return this.subscribeApprovedRestaurants(callback);
  },

  // Fetch single restaurant by ID
  async getRestaurantById(restaurantId: string): Promise<PluginRestaurant | null> {
    try {
      const snap = await getDoc(doc(RESTAURANTS_COL, restaurantId));
      if (snap.exists()) {
        return { ...snap.data(), restaurantId: snap.id } as PluginRestaurant;
      }
      return null;
    } catch {
      return null;
    }
  },

  // Fetch restaurant by URL slug for free storefront `/r/:slug`
  async getRestaurantBySlug(slug: string): Promise<PluginRestaurant | null> {
    try {
      const q = query(RESTAURANTS_COL, where('slug', '==', slug));
      const snap = await getDocs(q);
      if (!snap.empty) {
        const d = snap.docs[0];
        return { ...d.data(), restaurantId: d.id } as PluginRestaurant;
      }
      return null;
    } catch {
      return null;
    }
  },

  // Fetch restaurant associated with a seller ID
  async getRestaurantBySellerId(sellerId: string): Promise<PluginRestaurant | null> {
    try {
      const q = query(RESTAURANTS_COL, where('sellerId', '==', sellerId));
      const snap = await getDocs(q);
      if (!snap.empty) {
        const d = snap.docs[0];
        return { ...d.data(), restaurantId: d.id } as PluginRestaurant;
      }
      return null;
    } catch {
      return null;
    }
  },

  // Register a new restaurant in the plugin
  async registerRestaurant(data: Omit<PluginRestaurant, 'restaurantId' | 'slug' | 'approvalStatus' | 'isApproved'>): Promise<string> {
    const restaurantId = uuidv4();
    const rawSlug = slugify(data.name) || `restaurant-${restaurantId.slice(0, 6)}`;
    
    // Ensure unique slug
    let finalSlug = rawSlug;
    const existingSlug = await this.getRestaurantBySlug(rawSlug);
    if (existingSlug) {
      finalSlug = `${rawSlug}-${restaurantId.slice(0, 4)}`;
    }

    const newRestaurant: PluginRestaurant = {
      ...data,
      restaurantId,
      slug: finalSlug,
      approvalStatus: 'approved', // Auto-approve or admin pending
      isApproved: true,
      isOpen: data.isOpen ?? true,
      rating: 4.8,
      totalReviews: 1,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    await setDoc(doc(RESTAURANTS_COL, restaurantId), newRestaurant);
    return restaurantId;
  },

  // Update restaurant profile details
  async updateRestaurant(restaurantId: string, partial: Partial<PluginRestaurant>): Promise<void> {
    await updateDoc(doc(RESTAURANTS_COL, restaurantId), {
      ...partial,
      updatedAt: serverTimestamp(),
    });
  },

  // Admin Approve Restaurant
  async approveRestaurant(restaurantId: string): Promise<void> {
    await updateDoc(doc(RESTAURANTS_COL, restaurantId), {
      approvalStatus: 'approved',
      isApproved: true,
      updatedAt: serverTimestamp(),
    });
  },

  // Admin Reject Restaurant
  async rejectRestaurant(restaurantId: string): Promise<void> {
    await updateDoc(doc(RESTAURANTS_COL, restaurantId), {
      approvalStatus: 'rejected',
      isApproved: false,
      updatedAt: serverTimestamp(),
    });
  },

  // Subscribe to menu items for a specific restaurant (combines plugin_map_menus and products collections)
  subscribeRestaurantMenu(restaurantId: string, callback: (items: PluginMenuItem[]) => void) {
    let pluginMenuItems: PluginMenuItem[] = [];
    let productItems: PluginMenuItem[] = [];

    const DEMO_ITEMS: Record<string, PluginMenuItem[]> = {
      demo_royal_zaika: [
        {
          itemId: 'item_mutton_biryani',
          restaurantId: 'demo_royal_zaika',
          name: 'Royal Mutton Dum Biryani',
          description: 'Slow-cooked aromatic basmati rice layered with tender mutton and saffron.',
          category: 'Biryani & Rice',
          price: 320,
          foodType: 'non-veg',
          isAvailable: true,
          imageUrl: 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=400&fit=crop',
          preparationMins: 25,
        },
        {
          itemId: 'item_butter_chicken',
          restaurantId: 'demo_royal_zaika',
          name: 'Butter Chicken Special',
          description: 'Charcoal-grilled tandoori chicken cooked in rich makhani gravy.',
          category: 'Main Course',
          price: 280,
          foodType: 'non-veg',
          isAvailable: true,
          imageUrl: 'https://images.unsplash.com/photo-1603894584373-5ac82b2ae398?w=400&fit=crop',
          preparationMins: 20,
        },
        {
          itemId: 'item_paneer_tikka',
          restaurantId: 'demo_royal_zaika',
          name: 'Paneer Tikka Masala',
          description: 'Cottage cheese cubes marinated in spiced yogurt, tandoor grilled.',
          category: 'Main Course',
          price: 220,
          foodType: 'veg',
          isAvailable: true,
          imageUrl: 'https://images.unsplash.com/photo-1565557623262-b51c2513a641?w=400&fit=crop',
          preparationMins: 15,
        },
      ],
      demo_kashmiri_wazwan: [
        {
          itemId: 'item_rista',
          restaurantId: 'demo_kashmiri_wazwan',
          name: 'Kashmiri Rista (Wazwan)',
          description: 'Hand-pounded mutton meatballs cooked in red saffron paprika gravy.',
          category: 'Kashmiri Wazwan',
          price: 380,
          foodType: 'non-veg',
          isAvailable: true,
          imageUrl: 'https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=400&fit=crop',
          preparationMins: 30,
        },
        {
          itemId: 'item_rogan_josh',
          restaurantId: 'demo_kashmiri_wazwan',
          name: 'Mutton Rogan Josh',
          description: 'Authentic Kashmiri mutton dish flavored with Alkanet flower and Kashmiri chili.',
          category: 'Kashmiri Wazwan',
          price: 420,
          foodType: 'non-veg',
          isAvailable: true,
          imageUrl: 'https://images.unsplash.com/photo-1585937421612-70a008356fbe?w=400&fit=crop',
          preparationMins: 25,
        },
      ],
    };

    const publishCombinedMenu = () => {
      const itemMap = new Map<string, PluginMenuItem>();

      // Demo items
      if (DEMO_ITEMS[restaurantId]) {
        DEMO_ITEMS[restaurantId].forEach((i) => itemMap.set(i.itemId, i));
      }

      // Products collection items
      productItems.forEach((i) => itemMap.set(i.itemId, i));

      // Plugin map menus items (override)
      pluginMenuItems.forEach((i) => itemMap.set(i.itemId, i));

      callback(Array.from(itemMap.values()));
    };

    const qPlugin = query(MENUS_COL, where('restaurantId', '==', restaurantId));
    const unsubPlugin = onSnapshot(
      qPlugin,
      (snap) => {
        pluginMenuItems = snap.docs.map((d) => ({ ...d.data(), itemId: d.id } as PluginMenuItem));
        publishCombinedMenu();
      },
      (err) => {
        console.warn('Error subscribing to plugin_map_menus:', err);
        publishCombinedMenu();
      }
    );

    const qProducts = query(MAIN_PRODUCTS_COL, where('restaurantId', '==', restaurantId));
    const unsubProducts = onSnapshot(
      qProducts,
      (snap) => {
        productItems = snap.docs.map((d) => {
          const p = d.data();
          return {
            itemId: d.id,
            restaurantId,
            name: p.name || 'Special Dish',
            description: p.description || '',
            category: p.category || p.categoryName || 'General',
            price: p.price ?? p.basePrice ?? 150,
            foodType: p.foodType || (p.isVeg ? 'veg' : 'non-veg'),
            isAvailable: p.isAvailable !== false,
            imageUrl: p.imagePaths?.[0] || p.imageUrl || p.image,
            preparationMins: p.preparationTimeMins || 20,
          };
        });
        publishCombinedMenu();
      },
      (err) => {
        console.warn('Error subscribing to products for map restaurant:', err);
        publishCombinedMenu();
      }
    );

    return () => {
      unsubPlugin();
      unsubProducts();
    };
  },

  // Add menu item
  async addMenuItem(item: Omit<PluginMenuItem, 'itemId'>): Promise<string> {
    const itemId = uuidv4();
    const newItem: PluginMenuItem = {
      ...item,
      itemId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    await setDoc(doc(MENUS_COL, itemId), newItem);
    return itemId;
  },

  // Update menu item
  async updateMenuItem(itemId: string, partial: Partial<PluginMenuItem>): Promise<void> {
    await updateDoc(doc(MENUS_COL, itemId), {
      ...partial,
      updatedAt: serverTimestamp(),
    });
  },

  // Delete menu item
  async deleteMenuItem(itemId: string): Promise<void> {
    await deleteDoc(doc(MENUS_COL, itemId));
  },
};
