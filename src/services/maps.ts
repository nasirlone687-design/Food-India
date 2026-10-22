import { DeliveryRange } from '../models/types';

function computeHaversineMeters(
  origin: { lat: number; lng: number },
  destination: { lat: number; lng: number }
): number {
  const R = 6371000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(destination.lat - origin.lat);
  const dLng = toRad(destination.lng - origin.lng);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(origin.lat)) *
      Math.cos(toRad(destination.lat)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.max(250, Math.round(R * c));
}

export const mapsService = {
  // Compute route between origin and destination using Google Maps JS Routes library (durationMillis) with safe Haversine fallback
  async computeRoute(
    origin: { lat: number; lng: number },
    destination: { lat: number; lng: number }
  ): Promise<{ distanceMeters: number; durationSeconds: number } | null> {
    const fallbackMeters = computeHaversineMeters(origin, destination);
    const fallbackDurationSeconds = Math.max(300, Math.round((fallbackMeters / 1000) * 180));

    try {
      if (typeof google === 'undefined' || !google.maps?.importLibrary) {
        return {
          distanceMeters: fallbackMeters,
          durationSeconds: fallbackDurationSeconds,
        };
      }

      const routesLib = (await google.maps.importLibrary('routes')) as google.maps.RoutesLibrary;
      const { routes } = await routesLib.Route.computeRoutes({
        origin,
        destination,
        travelMode: google.maps.TravelMode.DRIVING,
        fields: ['distanceMeters', 'durationMillis'],
      });

      if (routes && routes.length > 0) {
        const route = routes[0] as any;
        const distanceMeters = Number(route.distanceMeters) || fallbackMeters;
        const durationMillis = Number(route.durationMillis) || 0;
        const durationSeconds =
          durationMillis > 0 ? Math.round(durationMillis / 1000) : fallbackDurationSeconds;
        return {
          distanceMeters,
          durationSeconds,
        };
      }
      return {
        distanceMeters: fallbackMeters,
        durationSeconds: fallbackDurationSeconds,
      };
    } catch {
      // Gracefully fall back to Haversine distance so Cart & Checkout never fail
      return {
        distanceMeters: fallbackMeters,
        durationSeconds: fallbackDurationSeconds,
      };
    }
  },

  // Calculate delivery charge based on distance and restaurant rules
  calculateDeliveryCharge(
    distanceMeters: number,
    mode: 'base_km' | 'range',
    baseCharge: number = 20,
    perKmCharge: number = 5,
    ranges: DeliveryRange[] = []
  ): number {
    const distanceKm = distanceMeters / 1000;

    if (mode === 'base_km') {
      return Math.round(baseCharge + distanceKm * perKmCharge);
    } else if (mode === 'range' && ranges.length > 0) {
      const matchingRange = ranges.find(
        (r) => distanceKm >= r.minKm && distanceKm <= r.maxKm
      );
      if (matchingRange) {
        return matchingRange.price ?? matchingRange.charge ?? baseCharge;
      }
      const sorted = [...ranges].sort((a, b) => b.maxKm - a.maxKm);
      if (distanceKm > sorted[0].maxKm) {
        const highestCharge = sorted[0].price ?? sorted[0].charge ?? baseCharge;
        return highestCharge + Math.round((distanceKm - sorted[0].maxKm) * perKmCharge);
      }
      return sorted[sorted.length - 1].price ?? sorted[sorted.length - 1].charge ?? baseCharge;
    }

    return baseCharge;
  },

  // Generate Google Maps direction link
  generateMapsLink(lat: number, lng: number, label?: string): string {
    const query = label ? `${encodeURIComponent(label)}@${lat},${lng}` : `${lat},${lng}`;
    return `https://www.google.com/maps/dir/?api=1&destination=${query}`;
  },
};
