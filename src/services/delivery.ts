import { DeliveryBooking, DeliveryQuote } from '../models/types';

export interface DiscoverQuotesParams {
  restaurantId: string;
  pickupLat?: number;
  pickupLng?: number;
  pickupAddress?: string;
  pickupState?: string;
  pickupCity?: string;
  pickupDistrict?: string;
  pickupPincode?: string;
  dropLat: number;
  dropLng: number;
  dropAddress: string;
  dropState?: string;
  dropCity?: string;
  dropDistrict?: string;
  dropPincode?: string;
  distanceKm?: number;
}

export interface DiscoverQuotesResponse {
  pickupLocation: {
    state: string;
    city: string;
    district: string;
    pincode: string;
    lat: number;
    lng: number;
  };
  dropLocation: {
    state: string;
    city: string;
    district: string;
    pincode: string;
    lat: number;
    lng: number;
  };
  distanceKm: number;
  eligibleQuotes: DeliveryQuote[];
  ineligibleQuotes?: DeliveryQuote[];
  unavailableProviders: {
    providerId: string;
    providerCode: string;
    providerName: string;
    providerType: string;
    reason: string;
  }[];
}

export const deliveryService = {
  async discoverQuotes(params: DiscoverQuotesParams): Promise<DiscoverQuotesResponse> {
    const res = await fetch('/api/delivery/discover-quotes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Failed to discover local delivery providers');
    }
    return data;
  },

  async bookDelivery(params: {
    orderId: string;
    providerId?: string;
    quoteId?: string;
    confirmedByRole?: 'customer' | 'seller' | 'admin';
    simulateFailure?: boolean;
  }): Promise<{ idempotentReplay: boolean; booking: DeliveryBooking; message?: string }> {
    const res = await fetch('/api/delivery/book', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    const data = await res.json();
    if (!res.ok) {
      const err: any = new Error(data.error || 'Failed to create delivery booking');
      err.booking = data.booking;
      throw err;
    }
    return data;
  },

  async cancelOrReassignBooking(params: {
    orderId: string;
    bookingId?: string;
    newProviderId?: string;
    reason?: string;
    actorRole?: 'customer' | 'seller' | 'admin';
  }): Promise<{ status: string; orderId: string; newProviderId: string | null }> {
    const res = await fetch('/api/delivery/cancel-or-reassign', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Failed to cancel or reassign delivery booking');
    }
    return data;
  },

  async triggerSandboxWebhook(params: {
    bookingId: string;
    orderId?: string;
    targetStatus: 'rider_assigned' | 'picked_up' | 'in_transit' | 'delivered';
  }): Promise<any> {
    const res = await fetch('/api/delivery/sandbox-webhook', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Failed to trigger sandbox delivery webhook');
    }
    return data;
  },

  async getAdminStatus(): Promise<{
    providers: Record<string, { configured: boolean; envLabel: string; webhookEndpoint: string }>;
  }> {
    const res = await fetch('/api/delivery/admin-status');
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Failed to fetch delivery provider status');
    }
    return data;
  },

  async testProvider(providerId: string): Promise<{
    providerId: string;
    integrationStatus: string;
    credentialsConfigured: boolean;
    message: string;
  }> {
    const res = await fetch('/api/delivery/test-provider', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ providerId }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Failed to test delivery provider');
    }
    return data;
  },
};
