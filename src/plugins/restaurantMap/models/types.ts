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
  statusHistory: {
    status: PluginOrderStatus;
    timestamp: string;
    note?: string;
  }[];
  createdAt?: any;
  updatedAt?: any;
}
