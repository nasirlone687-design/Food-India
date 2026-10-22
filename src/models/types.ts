// Updated type definitions for the full Food India backend & Third-Party Delivery Integration System

export type UserRole = 'customer' | 'seller' | 'admin';
export type AccountStatus = 'active' | 'pending' | 'pending_verification' | 'suspended';

export interface Address {
  id?: string;
  addressId: string;
  customerId?: string;
  label: string;
  fullAddress: string;
  landmark?: string;
  city?: string;
  district?: string;
  state?: string;
  pincode?: string;
  latitude: number;
  longitude: number;
  googleMapsLink?: string;
  isDefault?: boolean;
  createdAt?: any;
}

export interface DeliveryRange {
  minKm: number;
  maxKm: number;
  price: number;
  charge?: number;
}

export interface User {
  uid: string;
  fullName: string;
  email: string;
  phone?: string;
  role: UserRole;
  photoURL?: string;
  accountStatus: AccountStatus;
  businessLicenseNumber?: string;
  fssaiLicenseNumber?: string;
  aadhaarOrPanNumber?: string;
  liveGps?: {
    latitude: number;
    longitude: number;
    address: string;
    googleMapsUrl: string;
    googleMapsLink?: string;
    updatedAt?: string;
  };
  registrationDate: any; // ServerTimestamp
  createdAt: any;
  updatedAt: any;
  lastLoginAt?: any;
  isActive?: boolean;
  isVerified?: boolean;
  acceptedTermsAt?: any;
  upiTransactionRef?: string;
  subscriptionStatus?: string;
  subscriptionStartDate?: any;
  subscriptionExpiryDate?: any;
  accountPaused?: boolean;
  submittedReviewsCount?: number;
}

export interface Customer {
  uid: string;
  customerId?: string;
  fullName?: string;
  email?: string;
  phone?: string;
  savedAddresses: (string | Address)[];
  defaultAddressId?: string;
  liveGps?: {
    latitude: number;
    longitude: number;
    address: string;
    googleMapsUrl: string;
    googleMapsLink?: string;
    updatedAt?: string;
  };
  orderIds?: string[];
  totalOrders: number;
  completedOrders?: number;
  cancelledOrders?: number;
  acceptedTermsAt?: any;
  registrationDate?: any;
  createdAt: any;
  updatedAt: any;
  lastOrderAt?: any;
}

export interface Seller {
  sellerId: string;
  uid: string;
  ownerName: string;
  businessName?: string;
  email?: string;
  phone?: string;
  businessPhone?: string;
  restaurantId?: string;
  businessLicenseNumber?: string;
  fssaiLicenseNumber?: string;
  aadhaarOrPanNumber?: string;
  state?: string;
  city?: string;
  district?: string;
  pincode?: string;
  latitude?: number;
  longitude?: number;
  googleMapsLink?: string;
  allowOwnDeliveryStaff?: boolean;
  deliveryPricingMode?: string;
  deliveryRanges?: DeliveryRange[];
  registrationDate?: any;
  verificationStatus: 'pending' | 'verified' | 'rejected';
  verificationNotes?: string;
  approvedAt?: any;
  planId?: string;
  subscriptionStatus?: 'active' | 'pending_verification' | 'expired' | 'paused' | 'inactive' | string;
  upiTransactionRef?: string;
  upiIdPaidTo?: string;
  subscriptionAmountPaid?: number;
  subscriptionSubmittedAt?: any;
  subscriptionStartDate?: any;
  subscriptionExpiryDate?: any;
  accountPaused?: boolean;
  acceptedTermsAt?: any;
  lastDocumentUploadedAt?: any;
  gstEnabled?: boolean;
  gstRate?: number;
  createdAt?: any;
  updatedAt?: any;
}

export interface Restaurant {
  restaurantId: string;
  sellerId: string;
  restaurantName: string;
  description?: string;
  cuisineTypes?: string[];
  logoPath?: string;
  coverImagePath?: string;
  bannerPath?: string;
  phone: string;
  email?: string;
  businessLicenseNumber?: string;
  fssaiLicenseNumber?: string;
  aadhaarOrPanNumber?: string;
  address: string;
  locality?: string;
  district?: string;
  state?: string;
  postalCode?: string;
  city?: string;
  pincode?: string;
  latitude: number;
  longitude: number;
  googleMapsLink?: string;
  openingHours?: any;
  isOpen: boolean;
  preparationTime?: string;
  deliveryPricingMode?: string;
  baseDeliveryCharge?: number;
  deliveryPricePerKm?: number;
  perKmDeliveryCharge?: number;
  deliveryRanges?: DeliveryRange[];
  maximumDeliveryDistanceKm?: number;
  allowOwnDeliveryStaff?: boolean;
  approvalStatus: string;
  gstEnabled?: boolean;
  gstRate?: number;
  rating?: number;
  totalReviews?: number;
  reviewCount?: number;
  distanceKm?: number;
  createdAt: any;
  updatedAt: any;
}

export interface Category {
  categoryId: string;
  name: string;
  description?: string;
  imagePath?: string;
  parentCategoryId?: string | null;
  subcategories?: string[];
  isGlobal?: boolean;
  restaurantId?: string | null;
  displayOrder?: number;
  sortOrder?: number;
  isActive: boolean;
  createdAt: any;
  updatedAt?: any;
}

export interface AddOnOption {
  id?: string;
  name: string;
  price: number;
  isAvailable?: boolean;
}

export interface AddOnGroup {
  id: string;
  name: string;
  options: AddOnOption[];
  isRequired: boolean;
  minSelections: number;
  maxSelections: number;
}

export interface ProductVariant {
  id: string;
  name: string;
  price: number;
}

export interface Product {
  productId: string;
  restaurantId: string;
  sellerId: string;
  name: string;
  description?: string;
  categoryId: string;
  subcategoryId?: string;
  price: number; // Base price
  basePrice?: number;
  foodType: 'veg' | 'non-veg' | 'egg';
  isVeg?: boolean;
  imagePaths: string[]; // Up to 5
  variants: ProductVariant[];
  addOnGroups: AddOnGroup[];
  preparationTime: number | string; // in minutes or label
  preparationTimeMinutes?: number;
  isAvailable: boolean;
  isTestProduct?: boolean;
  rating?: number;
  reviewCount?: number;
  distanceKm?: number;
  restaurantName?: string;
  createdAt: any;
  updatedAt: any;
}

export interface CartItem {
  cartItemId: string;
  productId: string;
  name: string;
  image: string;
  basePrice: number;
  price?: number;
  variant?: ProductVariant;
  selectedAddOns: { groupName: string; option: AddOnOption }[];
  quantity: number;
  lineTotal: number;
}

export interface Cart {
  cartId: string;
  customerId: string;
  restaurantId: string;
  restaurantName: string;
  restaurantImage: string;
  items: CartItem[];
  subtotal: number;
  deliveryCharge: number;
  total: number;
  updatedAt: any;
}

export type DeliveryProviderType =
  | 'restaurant_staff'
  | 'food_india_fleet'
  | 'sandbox_test_provider'
  | 'third_party_api';

export type DeliveryIntegrationStatus =
  | 'active_sandbox'
  | 'active_live'
  | 'unsupported_unconfigured'
  | 'disabled';

export interface DeliveryProvider {
  providerId: string;
  providerCode: string; // e.g., 'sandbox_test', 'food_india_fleet', 'porter_api', 'shadowfax_api', 'shiprocket_hyperlocal', 'dunzo_b2b'
  name: string;
  logoUrl?: string;
  providerType: DeliveryProviderType;
  integrationStatus: DeliveryIntegrationStatus;
  isEnabled: boolean;
  isTestMockProvider?: boolean;
  priority: number; // Lower number = higher priority (1, 2, 3...)
  fallbackProviderId?: string;
  apiBaseUrl?: string;
  webhookEndpoint?: string;
  supportsLiveQuotes: boolean;
  supportsWebhooks: boolean;
  supportsCancellation: boolean;
  supportsCodCollection: boolean;
  baseFee: number;
  perKmFee: number;
  maxDistanceKm: number;
  conditionsNote?: string;
  onboardingRequirements?: string;
  requiredEnvVars?: string[];
  credentialsConfigured?: boolean;
  lastTestedAt?: any;
  lastTestResult?: string;
  createdAt?: any;
  updatedAt?: any;
}

export interface DeliveryServiceArea {
  areaId: string;
  providerId: string;
  providerName?: string;
  state: string; // e.g. 'Delhi', 'Maharashtra', 'Karnataka', 'All India'
  city: string;  // e.g. 'New Delhi', 'Mumbai', 'Bengaluru'
  district: string; // e.g. 'Central Delhi', 'Mumbai Suburban', 'Bengaluru Urban'
  pincodes: string[]; // e.g. ['110001', '110002'] or ['*']
  centerLatitude?: number;
  centerLongitude?: number;
  radiusKm: number;
  isActive: boolean;
  areaRulesNote?: string;
  createdAt?: any;
  updatedAt?: any;
}

export interface DeliveryQuote {
  quoteId: string;
  providerId: string;
  providerCode: string;
  providerName: string;
  providerLogo?: string;
  providerType: DeliveryProviderType;
  isTestMockProvider?: boolean;
  restaurantId: string;
  pickupState?: string;
  pickupCity?: string;
  pickupDistrict?: string;
  dropState?: string;
  dropCity?: string;
  dropDistrict?: string;
  dropPincode?: string;
  distanceKm: number;
  estimatedFee: number;
  currency: string;
  estimatedDurationMin: number;
  coverageMatchDetails: string;
  bookingStatusLabel: string;
  conditionsNote: string;
  priceChangeExplanation: string;
  isEligible: boolean;
  ineligibilityReason?: string;
  expiresAt: string;
  createdAt?: any;
}

export type DeliveryBookingStatus =
  | 'awaiting_restaurant_acceptance'
  | 'ready_to_book'
  | 'booking_in_progress'
  | 'booked'
  | 'rider_assigned'
  | 'picked_up'
  | 'in_transit'
  | 'delivered'
  | 'cancelled'
  | 'failed';

export interface DeliveryBooking {
  bookingId: string;
  idempotencyKey: string; // Prevents duplicate bookings/charges for the same order attempt
  orderId: string;
  orderNumber: string;
  customerId: string;
  sellerId: string;
  restaurantId: string;
  providerId: string;
  providerCode: string;
  providerName: string;
  providerType: DeliveryProviderType;
  isTestMockProvider?: boolean;
  quoteId?: string;
  providerBookingRef: string;
  trackingRef: string;
  trackingUrl?: string;
  quotedFee: number;
  finalFee?: number;
  currency: string;
  estimatedEtaMin: number;
  bookingStatus: DeliveryBookingStatus;
  riderName?: string;
  riderPhone?: string;
  pickupAddress: string;
  dropAddress: string;
  distanceKm: number;
  failureReason?: string;
  cancellationReason?: string;
  refundStatus?: 'not_applicable' | 'cod_fee_waived' | 'reassigned_no_extra_charge';
  webhookVerifiedDelivery?: boolean;
  createdAt: any;
  updatedAt: any;
}

export interface DeliveryStatusHistoryItem {
  historyId: string;
  bookingId: string;
  orderId: string;
  providerCode: string;
  status: DeliveryBookingStatus;
  timestamp: string;
  source: 'system' | 'provider_api' | 'verified_webhook' | 'seller' | 'customer' | 'admin';
  note: string;
  createdAt?: any;
}

export interface DeliveryWebhookEvent {
  eventId: string;
  providerCode: string;
  bookingId?: string;
  orderId?: string;
  eventType: string;
  signatureVerified: boolean;
  processingStatus: 'processed' | 'duplicate_ignored' | 'rejected_signature' | 'failed';
  payloadSummary: string;
  errorDetails?: string;
  receivedAt: any;
}

export interface Order {
  orderId: string;
  orderNumber: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  sellerId: string;
  restaurantId: string;
  restaurantName: string;
  restaurantPhone?: string;
  items?: {
    productId: string;
    name: string;
    price: number;
    quantity: number;
  }[];
  itemsSnapshot: CartItem[];
  itemSubtotal: number;
  gstEnabled?: boolean;
  gstRate?: number;
  gstAmount?: number;
  deliveryCharge: number;
  totalAmount: number;
  paymentMethod: 'COD';
  paymentStatus: 'pending' | 'pending_cod' | 'paid' | 'failed';
  orderStatus: 'pending' | 'confirmed' | 'preparing' | 'ready_for_pickup' | 'out_for_delivery' | 'delivered' | 'cancelled';
  statusHistory?: {
    status: string;
    timestamp: string;
    note?: string;
    updatedBy?: string;
  }[];
  addressSnapshot: any;
  deliveryAddress?: string;
  customerLatitude?: number;
  customerLongitude?: number;
  restaurantLatitude?: number;
  restaurantLongitude?: number;
  distanceKm?: number;
  // Third-Party / Delivery Method Integration fields
  selectedDeliveryProviderId?: string;
  selectedDeliveryProviderCode?: string;
  selectedDeliveryProviderName?: string;
  selectedDeliveryProviderType?: DeliveryProviderType;
  selectedDeliveryQuoteId?: string;
  deliveryEstimatedEtaMin?: number;
  deliveryBookingId?: string;
  deliveryBookingStatus?: DeliveryBookingStatus;
  deliveryTrackingRef?: string;
  deliveryProviderBookingRef?: string;
  deliveryRiderName?: string;
  deliveryRiderPhone?: string;
  deliveryVerifiedByWebhook?: boolean;
  whatsappNotificationUrl?: string;
  smsNotificationUrl?: string;
  emailNotificationSubject?: string;
  createdAt: any;
  updatedAt: any;
  deliveredAt?: any;
}

export interface SubscriptionPlan {
  planId: string;
  name: string;
  price: number;
  basePrice?: number;
  gstRate?: number;
  gstAmount?: number;
  totalWithGst?: number;
  gstNumber?: string;
  fssaiLicenseNumber?: string;
  currency: string;
  durationDays: number;
  features: string[];
  isActive: boolean;
  createdAt?: any;
  updatedAt?: any;
}

export interface SellerSubscription {
  subscriptionId: string;
  sellerId: string;
  planId: string;
  planName?: string;
  durationDays?: number;
  amount: number;
  basePrice?: number;
  gstRate?: number;
  gstAmount?: number;
  totalWithGst?: number;
  gstNumber?: string;
  fssaiLicenseNumber?: string;
  currency?: string;
  paymentId?: string;
  upiTransactionRef?: string;
  upiId?: string;
  razorpayPaymentLinkId?: string;
  razorpayPaymentLinkUrl?: string;
  paymentStatus: 'pending' | 'paid' | 'failed';
  activationStatus: 'pending_payment' | 'pending_admin_review' | 'active' | 'expired' | 'rejected';
  startDate?: any;
  expiryDate?: any;
  activatedBy?: string;
  createdAt?: any;
  updatedAt?: any;
}

export interface Payment {
  paymentId: string;
  sellerId: string;
  sellerName?: string;
  sellerPhone?: string;
  sellerEmail?: string;
  planId: string;
  planName?: string;
  durationDays?: number;
  subscriptionId: string;
  paymentMethod?: 'UPI' | 'RAZORPAY';
  upiId?: string;
  upiTransactionRef?: string;
  razorpayPaymentLinkId: string;
  razorpayPaymentLinkUrl?: string;
  razorpayReferenceId?: string;
  razorpayPaymentId?: string;
  amount: number;
  basePrice?: number;
  baseAmount?: number;
  gstRate?: number;
  gstAmount?: number;
  totalWithGst?: number;
  gstNumber?: string;
  fssaiLicenseNumber?: string;
  currency: string;
  paymentStatus: 'pending' | 'pending_verification' | 'paid' | 'captured' | 'failed';
  webhookVerified?: boolean;
  webhookEventId?: string;
  verifiedAt?: any;
  activatedByAdmin?: boolean;
  environment?: 'test' | 'live';
  createdAt: any;
  updatedAt?: any;
}

export interface Review {
  reviewId: string;
  targetType: 'product' | 'restaurant';
  targetId: string;
  productId?: string;
  productName?: string;
  restaurantId: string;
  restaurantName?: string;
  customerId: string;
  customerName: string;
  rating: number;
  comment: string;
  createdAt: any;
}

export interface SellerDocument {
  documentId: string;
  sellerId: string;
  sellerName?: string;
  sellerEmail?: string;
  sellerPhone?: string;
  restaurantId?: string;
  restaurantName?: string;
  documentType: 'id_proof' | 'fssai_license' | 'gst_certificate';
  documentNumber?: string;
  businessLicenseNumber?: string;
  fssaiLicenseNumber?: string;
  aadhaarOrPanNumber?: string;
  storagePath: string;
  fileName?: string;
  fileSize?: number;
  mimeType?: string;
  fileDataUrl?: string;
  uploadDurationMs?: number;
  verificationStatus: 'pending' | 'verified' | 'rejected';
  reviewNotes?: string;
  uploadedAt: any;
  reviewedAt?: any;
}

export interface AppNotification {
  notificationId: string;
  recipientUid: string;
  recipientRole: 'customer' | 'seller' | 'admin';
  recipientEmail?: string;
  recipientPhone?: string;
  orderId?: string;
  orderNumber?: string;
  title: string;
  body: string;
  channels: ('app' | 'email' | 'whatsapp')[];
  whatsappUrl?: string;
  mailtoUrl?: string;
  readAt?: any;
  createdAt: any;
}

export interface AdminSettings {
  settingId?: string;
  companyName?: string;
  privacyPolicyURL: string;
  termsAndConditionsURL: string;
  privacyPolicyUrl?: string;
  termsUrl?: string;
  parentUnitName?: string;
  parentWebsite?: string;
  udyamRegistrationNumber?: string;
  gstNumber?: string;
  fssaiLicenseNumber?: string;
  plan499BaseAmount?: number;
  plan499GstRate?: number;
  plan499GstAmount?: number;
  plan499TotalAmount?: number;
  deliveryLimits: {
    maximumDistanceKm: number;
    globalBaseCharge: number;
    minOrderValue?: number;
  };
  cancellationRules?: any;
  updatedAt: any;
}

export interface AuditLog {
  logId: string;
  adminId: string;
  action: string;
  targetType: string;
  targetId: string;
  details: string;
  timestamp: any;
}
