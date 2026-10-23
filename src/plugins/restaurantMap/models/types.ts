export interface PluginMapSettings {
  isEnabled: boolean;
  pluginTitle?: string;
  defaultLat?: number;
  defaultLng?: number;
  defaultZoom?: number;
  allowPublicRegistration?: boolean;
  autoApproveNewRestaurants?: boolean;
  updatedAt?: any;
}

export interface PluginRestaurant {
  restaurantId: string;
  sellerId: string;
  name: string;
  slug: string; // e.g. 'royal-kashmiri-darbar'
  description?: string;
  ownerName: string;
  ownerEmail: string;
  phone: string;
  address: string;
  latitude: number;
  longitude: number;
  cuisineTypes: string[];
  logoUrl?: string;
  coverUrl?: string;
  rating?: number;
  totalReviews?: number;
  deliveryRadiusKm?: number;
  baseDeliveryFee?: number;
  minOrderAmount?: number;
  isOpen: boolean;
  isApproved: boolean;
  approvalStatus: 'approved' | 'pending' | 'rejected';
  createdAt?: any;
  updatedAt?: any;
}

export interface PluginMenuItem {
  itemId: string;
  restaurantId: string;
  name: string;
  description?: string;
  category: string;
  price: number;
  foodType: 'veg' | 'non-veg' | 'egg';
  isAvailable: boolean;
  imageUrl?: string;
  preparationMins?: number;
  createdAt?: any;
  updatedAt?: any;
}

export interface PluginCartItem {
  itemId: string;
  name: string;
  price: number;
  quantity: number;
  foodType: 'veg' | 'non-veg' | 'egg';
  imageUrl?: string;
}

export interface PluginCart {
  cartId: string;
  userId: string;
  restaurantId: string;
  restaurantName: string;
  items: PluginCartItem[];
  itemSubtotal: number;
  deliveryFee: number;
  totalAmount: number;
  updatedAt?: any;
}

export type PluginOrderStatus =
  | 'pending'
  | 'accepted'
  | 'rejected'
  | 'preparing'
  | 'ready_for_pickup'
  | 'delivering'
  | 'delivered'
  | 'cancelled';

export interface PluginDeliveryPartner {
  partnerId: string;
  userId?: string;
  name: string;
  phone: string;
  whatsappNumber?: string;
  vehicleType: 'bike' | 'scooter' | 'auto' | 'van';
  vehicleNumber: string;

  // Document URLs / Base64 / Descriptions
  identityDocUrl?: string; // Aadhaar / PAN / Govt ID
  licenseDocUrl?: string;  // Driving License
  vehicleRcUrl?: string;   // Vehicle RC (Registration Certificate)
  vehicleInsuranceUrl?: string; // Vehicle Insurance / Permit Document

  // Location
  latitude: number;
  longitude: number;
  currentAddress?: string;
  isOnline: boolean;

  // Custom Pricing per Km
  baseDeliveryPrice: number; // e.g. ₹20
  pricePerKm: number;       // e.g. ₹10 per km

  // Approval & ₹299 Monthly Subscription Status
  approvalStatus: 'approved' | 'pending' | 'rejected';
  subscriptionStatus: 'active' | 'expired' | 'pending_payment';
  monthlyFeeAmount: number; // 299
  subscriptionExpiryDate?: string;

  rating?: number;
  totalDeliveries?: number;
  createdAt?: any;
  updatedAt?: any;
}

export interface PluginOrder {
  orderId: string;
  orderNumber: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  deliveryAddress: string;
  deliveryNote?: string;
  customerLat?: number;
  customerLng?: number;
  restaurantId: string;
  restaurantName: string;
  restaurantPhone?: string;
  sellerId: string;
  items: PluginCartItem[];
  itemSubtotal: number;
  deliveryFee: number;
  totalAmount: number;
  paymentMethod: 'COD';
  orderStatus: PluginOrderStatus;
  rejectionReason?: string;

  // Delivery Partner Dispatch Fields
  deliveryType?: 'restaurant_delivery' | 'map_partner_delivery';
  deliveryPartnerId?: string;
  deliveryPartnerName?: string;
  deliveryPartnerPhone?: string;
  roundTripDistanceKm?: number;

  statusHistory: {
    status: PluginOrderStatus;
    timestamp: string;
    note?: string;
  }[];
  createdAt?: any;
  updatedAt?: any;
}
